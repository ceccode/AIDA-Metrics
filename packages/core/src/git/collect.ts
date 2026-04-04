import { simpleGit, SimpleGit } from 'simple-git';
import { Commit, CommitStream } from '../schema/commit.js';
import { createAITagger } from '../tags/ai-tags.js';
import { getDiffStats } from './diff.js';
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

  let logResult;

  if (diffBase) {
    // PR-scoped mode: collect only commits between diffBase and HEAD
    logger?.info(`PR-scoped analysis: ${diffBase}..HEAD`);
    logResult = await git.log([`${diffBase}..HEAD`]);
    logger?.info(`Found ${logResult.all.length} commits in PR`);
  } else {
    // Standard mode: collect from all branches within date range
    logger?.info(
      `Collecting commits from ${sinceDate?.toISOString() || 'beginning'} to ${untilDate.toISOString()}`
    );

    const logArgs: string[] = ['--all'];
    if (sinceDate) {
      logArgs.push(`--after=${sinceDate.toISOString()}`);
    }
    logArgs.push(`--before=${untilDate.toISOString()}`);

    logResult = await git.log(logArgs);
    logger?.info(`Found ${logResult.all.length} commits (all branches)`);
  }

  // Get the set of commit hashes reachable from the default branch
  let defaultBranchHashes: Set<string>;
  if (diffBase) {
    // In PR mode, use merge-base to bound the rev-list instead of fetching entire history
    try {
      const mergeBase = (await git.raw(['merge-base', defaultBranch, 'HEAD'])).trim();
      const bounded = (await git.raw(['rev-list', `${mergeBase}..${defaultBranch}`])).trim().split('\n').filter(Boolean);
      // Include merge-base itself
      bounded.push(mergeBase);
      defaultBranchHashes = new Set(bounded);
    } catch {
      // Fallback: full rev-list if merge-base fails (e.g., unrelated histories)
      const all = (await git.raw(['rev-list', defaultBranch])).trim().split('\n').filter(Boolean);
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

  // Batch-fetch parent hashes for all commits in a single git call
  const parentMap = new Map<string, string[]>();
  if (logResult.all.length > 0) {
    try {
      const parentArgs = diffBase
        ? ['rev-list', '--parents', `${diffBase}..HEAD`]
        : ['log', '--format=%H %P', '--all',
          ...(sinceDate ? [`--after=${sinceDate.toISOString()}`] : []),
          `--before=${untilDate.toISOString()}`];
      const parentOutput = await git.raw(parentArgs);
      for (const line of parentOutput.trim().split('\n').filter(Boolean)) {
        const parts = line.split(' ').filter(Boolean);
        const [hash, ...parents] = parts;
        parentMap.set(hash, parents);
      }
    } catch {
      // Fallback: parent map will be empty, parents default to []
    }
  }

  // Create AI tagger
  const aiTagger = createAITagger({ patterns: aiPatterns, tools: aiTools, trailerDomains: aiTrailerDomains });

  // Deduplicate commits (same hash can appear from multiple branches)
  const seen = new Set<string>();
  const commits: Commit[] = [];
  for (const gitCommit of logResult.all) {
    if (seen.has(gitCommit.hash)) continue;
    seen.add(gitCommit.hash);

    logger?.debug(`Processing commit ${gitCommit.hash}`);

    // Get diff stats
    const stats = await getDiffStats(git, gitCommit.hash);

    // Tag AI (include body for trailer detection like Co-Authored-By)
    const fullMessage = gitCommit.body
      ? `${gitCommit.message}\n\n${gitCommit.body}`
      : gitCommit.message;
    const aiTag = aiTagger(fullMessage);

    // Get parents from batch-fetched map
    const parents = parentMap.get(gitCommit.hash) || [];

    const inDefaultBranchAncestry = defaultBranchHashes.has(gitCommit.hash);

    const commit: Commit = {
      hash: gitCommit.hash,
      authorName: gitCommit.author_name,
      authorEmail: gitCommit.author_email,
      authorDate: new Date(gitCommit.date).toISOString(),
      committerName: gitCommit.author_name, // Simple-git doesn't separate these easily
      committerEmail: gitCommit.author_email,
      committerDate: new Date(gitCommit.date).toISOString(),
      message: gitCommit.message,
      parents,
      branch: defaultBranch,
      inDefaultBranchAncestry,
      tags: aiTag,
      stats,
    };

    commits.push(commit);
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
