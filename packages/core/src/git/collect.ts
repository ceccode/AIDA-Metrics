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
  aiPatterns?: string[];
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
    aiPatterns = [],
    defaultBranch: providedDefaultBranch,
    logger,
  } = options;

  const git = simpleGit(repoPath);

  // Detect default branch
  const defaultBranch = providedDefaultBranch || (await detectDefaultBranch(git));
  logger?.info(`Using default branch: ${defaultBranch}`);

  // Parse date range
  const sinceDate = since ? parseRelativeDate(since) : undefined;
  const untilDate = until ? parseRelativeDate(until) : new Date();

  logger?.info(
    `Collecting commits from ${sinceDate?.toISOString() || 'beginning'} to ${untilDate.toISOString()}`
  );

  // Build log arguments — collect from ALL branches
  const logArgs: string[] = ['--all'];
  if (sinceDate) {
    logArgs.push(`--after=${sinceDate.toISOString()}`);
  }
  logArgs.push(`--before=${untilDate.toISOString()}`);

  // Get commits from all branches
  const logResult = await git.log(logArgs);
  logger?.info(`Found ${logResult.all.length} commits (all branches)`);

  // Get the set of commit hashes reachable from the default branch
  const revListArgs = [defaultBranch];
  if (sinceDate) {
    revListArgs.push(`--after=${sinceDate.toISOString()}`);
  }
  revListArgs.push(`--before=${untilDate.toISOString()}`);
  const defaultBranchHashes = new Set(
    (await git.raw(['rev-list', ...revListArgs])).trim().split('\n').filter(Boolean)
  );
  logger?.info(`Default branch commits: ${defaultBranchHashes.size}`);

  // Create AI tagger
  const aiTagger = createAITagger({ patterns: aiPatterns });

  // Deduplicate commits (same hash can appear from multiple branches)
  const seen = new Set<string>();
  const commits: Commit[] = [];
  for (const gitCommit of logResult.all) {
    if (seen.has(gitCommit.hash)) continue;
    seen.add(gitCommit.hash);

    logger?.debug(`Processing commit ${gitCommit.hash}`);

    // Get diff stats
    const stats = await getDiffStats(repoPath, gitCommit.hash);

    // Tag AI (include body for trailer detection like Co-Authored-By)
    const fullMessage = (gitCommit as any).body
      ? `${gitCommit.message}\n\n${(gitCommit as any).body}`
      : gitCommit.message;
    const aiTag = aiTagger(fullMessage);

    // Parse parents
    const parents = (gitCommit as any).parents
      ? (gitCommit as any).parents.split(' ').filter((p: string) => p)
      : [];

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
