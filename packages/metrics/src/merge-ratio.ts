import { Commit, CommitStream } from '@aida-dev/core';
import { CohortMergeRatio, MergeRatio } from './schema/metrics.js';

function computeMergeRatio(commits: Commit[]): CohortMergeRatio {
  const merged = commits.filter((commit) => commit.inDefaultBranchAncestry);

  return {
    commitsTotal: commits.length,
    commitsMerged: merged.length,
    mergeRatio: commits.length > 0 ? merged.length / commits.length : 0,
  };
}

export function calculateMergeRatio(commitStream: CommitStream): MergeRatio {
  const aiCommits = commitStream.commits.filter((commit) => commit.tags.ai);
  const result = computeMergeRatio(aiCommits);

  return {
    aiCommitsTotal: result.commitsTotal,
    aiCommitsMerged: result.commitsMerged,
    mergeRatio: result.mergeRatio,
  };
}

export function calculateBaselineMergeRatio(commitStream: CommitStream): CohortMergeRatio {
  const nonAICommits = commitStream.commits.filter((commit) => !commit.tags.ai);
  return computeMergeRatio(nonAICommits);
}
