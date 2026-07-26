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

export function calculateMergeRatio(
  commitStream: CommitStream,
  isTarget: (commit: Commit) => boolean = (commit) => commit.tags.attribution === 'ai'
): MergeRatio {
  const aiCommits = commitStream.commits.filter(isTarget);
  const result = computeMergeRatio(aiCommits);

  return {
    aiCommitsTotal: result.commitsTotal,
    aiCommitsMerged: result.commitsMerged,
    mergeRatio: result.mergeRatio,
  };
}

export function calculateBaselineMergeRatio(
  commitStream: CommitStream,
  isTarget: (commit: Commit) => boolean = (commit) => commit.tags.attribution === 'human'
): CohortMergeRatio {
  const baselineCommits = commitStream.commits.filter(isTarget);
  return computeMergeRatio(baselineCommits);
}
