import { simpleGit, SimpleGit } from 'simple-git';
import { Commit, CommitStream } from '../schema/commit.js';
import { createAITagger } from '../tags/ai-tags.js';
import { createAutomatedDetector } from '../tags/automated.js';
import {
  applyManifest,
  indexManifest,
  loadAttributionManifest,
  unmatchedManifestHashes,
} from '../tags/attribution-manifest.js';
import { logWithStats } from './log.js';
import { parseRelativeDate, formatISODate } from '../utils/dates.js';
import { Logger } from '../utils/log.js';

export interface CollectOptions {
  repoPath: string;
  since?: string;
  until?: string;
  diffBase?: string;
  aiPatterns?: string[];
  aiTools?: string[];
  aiTrailerDomains?: string[];
  aiBotBlocklist?: string[];
  defaultBranch?: string;
  logger?: Logger;
}

export async function detectDefaultBranch(git: SimpleGit): Promise<string> {
  try {
    // Try to get the default branch from origin/HEAD
    const result = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    const match = result.match(/refs\/remotes\/origin\/(.+)/);
    if (match) {
      return match[1].trim();
    }
  } catch {
    // Fallback logic
  }

  // Fallback to common branch names
  const branches = await git.branch(['-r']);
  if (branches.all.includes('origin/main')) {
    return 'main';
  }
  if (branches.all.includes('origin/master')) {
    return 'master';
  }

  // Last resort: use current branch
  const current = await git.branch();
  return current.current || 'main';
}

export async function collectCommits(options: CollectOptions): Promise<CommitStream> {
  const {
    repoPath,
    since,
    until,
    diffBase,
    aiPatterns = [],
    aiTools = [],
    aiTrailerDomains = [],
    aiBotBlocklist = [],
    defaultBranch: providedDefaultBranch,
    logger,
  } = options;

  const git = simpleGit(repoPath);

  // Detect default branch
  const defaultBranch = providedDefaultBranch || (await detectDefaultBranch(git));
  logger?.info(`Using default branch: ${defaultBranch}`);

  // Parse dates once (avoids duplicate parsing and timestamp drift)
  const sinceDate = since ? parseRelativeDate(since) : undefined;
  const untilDate = until ? parseRelativeDate(until) : new Date();

  let rangeArgs: string[];

  if (diffBase) {
    // PR-scoped mode: collect only commits between diffBase and HEAD
    logger?.info(`PR-scoped analysis: ${diffBase}..HEAD`);
    rangeArgs = [`${diffBase}..HEAD`];
  } else {
    // Standard mode: collect from all branches within date range
    logger?.info(
      `Collecting commits from ${sinceDate?.toISOString() || 'beginning'} to ${untilDate.toISOString()}`
    );
    rangeArgs = ['--all'];
    if (sinceDate) {
      rangeArgs.push(`--after=${sinceDate.toISOString()}`);
    }
    rangeArgs.push(`--before=${untilDate.toISOString()}`);
  }

  // Single batched pass: metadata, parents, and diff stats for all commits
  const rawCommits = await logWithStats(git, rangeArgs);
  logger?.info(`Found ${rawCommits.length} commits${diffBase ? ' in PR' : ' (all branches)'}`);

  // Get the set of commit hashes reachable from the default branch
  let defaultBranchHashes: Set<string>;
  if (diffBase) {
    // In PR mode compare against diffBase (e.g. `origin/main`), not the bare
    // default-branch name — a PR checkout only has the remote-tracking ref, so
    // `main` is unresolvable while `origin/main` exists.
    try {
      const mergeBase = (await git.raw(['merge-base', diffBase, 'HEAD'])).trim();
      const bounded = (await git.raw(['rev-list', `${mergeBase}..${diffBase}`])).trim().split('\n').filter(Boolean);
      // Include merge-base itself
      bounded.push(mergeBase);
      defaultBranchHashes = new Set(bounded);
    } catch {
      // Fallback: full rev-list if merge-base fails (e.g., unrelated histories)
      const all = (await git.raw(['rev-list', diffBase])).trim().split('\n').filter(Boolean);
      defaultBranchHashes = new Set(all);
    }
  } else {
    // Standard mode: use date filters
    const revListArgs = [defaultBranch];
    if (sinceDate) {
      revListArgs.push(`--after=${sinceDate.toISOString()}`);
    }
    revListArgs.push(`--before=${untilDate.toISOString()}`);
    defaultBranchHashes = new Set(
      (await git.raw(['rev-list', ...revListArgs])).trim().split('\n').filter(Boolean)
    );
  }
  logger?.info(`Default branch commits: ${defaultBranchHashes.size}`);

  // Create AI tagger
  const aiTagger = createAITagger({
    patterns: aiPatterns,
    tools: aiTools,
    trailerDomains: aiTrailerDomains,
    botBlocklist: aiBotBlocklist,
  });

  // Automated detection (#39): merge commits and bot authors
  const detectAutomated = createAutomatedDetector(aiBotBlocklist);

  // Optional retroactive attribution manifest at the repo root (#10)
  const manifest = await loadAttributionManifest(repoPath, logger);
  const manifestIndex = manifest ? indexManifest(manifest) : null;

  // Deduplicate commits (same hash can appear from multiple branches)
  const seen = new Set<string>();
  const commits: Commit[] = [];
  for (const rawCommit of rawCommits) {
    if (seen.has(rawCommit.hash)) continue;
    seen.add(rawCommit.hash);

    logger?.debug(`Processing commit ${rawCommit.hash}`);

    // Tag AI on the full message (body included, for trailers like Co-Authored-By)
    let aiTag = aiTagger(rawCommit.message);
    // Automated detection only when heuristics found no AI signal:
    // in-commit evidence wins over structural heuristics
    if (aiTag.attribution === 'unknown') {
      const automatedSource = detectAutomated(rawCommit);
      if (automatedSource) {
        aiTag = {
          ai: false,
          attribution: 'automated',
          mode: 'none',
          modeEvidence: 'inferred',
          level: 'none',
          sources: [...aiTag.sources, automatedSource],
        };
      }
    }
    // Manifest declarations beat structural heuristics
    if (manifestIndex) {
      aiTag = applyManifest(aiTag, rawCommit.hash, manifestIndex, logger);
    }

    const commit: Commit = {
      hash: rawCommit.hash,
      authorName: rawCommit.authorName,
      authorEmail: rawCommit.authorEmail,
      authorDate: new Date(rawCommit.authorDate).toISOString(),
      committerName: rawCommit.committerName,
      committerEmail: rawCommit.committerEmail,
      committerDate: new Date(rawCommit.committerDate).toISOString(),
      message: rawCommit.message.split('\n')[0],
      parents: rawCommit.parents,
      inDefaultBranchAncestry: defaultBranchHashes.has(rawCommit.hash),
      tags: aiTag,
      stats: rawCommit.stats,
    };

    commits.push(commit);
  }

  if (manifestIndex) {
    const unmatched = unmatchedManifestHashes(manifestIndex);
    if (unmatched.length > 0) {
      logger?.info(
        `Manifest: ${unmatched.length} hash(es) matched no collected commit (rebase, typo, or outside the --since window)`
      );
    }
  }

  return {
    repoPath,
    defaultBranch,
    generatedAt: formatISODate(new Date()),
    since,
    until,
    aiPatterns: [...aiPatterns],
    commits,
  };
}
