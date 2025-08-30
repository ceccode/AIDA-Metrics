import { simpleGit, SimpleGit, LogResult } from 'simple-git';
import { Commit, CommitStream } from '../schema/commit.js';
import { createAITagger, AITagConfig } from '../tags/ai-tags.js';
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
  const defaultBranch = providedDefaultBranch || await detectDefaultBranch(git);
  logger?.info(`Using default branch: ${defaultBranch}`);

  // Parse date range
  const sinceDate = since ? parseRelativeDate(since) : undefined;
  const untilDate = until ? parseRelativeDate(until) : new Date();

  logger?.info(`Collecting commits from ${sinceDate?.toISOString() || 'beginning'} to ${untilDate.toISOString()}`);

  // Build log options
  const logOptions: any = {
    from: defaultBranch,
    maxCount: 100, // Limit for demo
  };

  // Get commits
  const logResult = await git.log(logOptions);
  logger?.info(`Found ${logResult.all.length} commits`);

  // Create AI tagger
  const aiTagger = createAITagger({ patterns: aiPatterns });

  // Process commits
  const commits: Commit[] = [];
  for (const gitCommit of logResult.all) {
    logger?.debug(`Processing commit ${gitCommit.hash}`);

    // Get diff stats
    const stats = await getDiffStats(repoPath, gitCommit.hash);

    // Tag AI
    const aiTag = aiTagger(gitCommit.message);

    // Parse parents
    const parents = (gitCommit as any).parents ? (gitCommit as any).parents.split(' ').filter((p: string) => p) : [];

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
      inDefaultBranchAncestry: true, // All commits are from default branch in MVP
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
