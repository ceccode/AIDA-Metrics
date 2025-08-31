import { CommitStream } from '@aida-dev/core';
import { MergeRatio } from './schema/metrics.js';

export function calculateMergeRatio(commitStream: CommitStream): MergeRatio {
  const aiCommits = commitStream.commits.filter(commit => commit.tags.ai);
  const aiCommitsMerged = aiCommits.filter(commit => commit.inDefaultBranchAncestry);
  
  const aiCommitsTotal = aiCommits.length;
  const aiCommitsMergedCount = aiCommitsMerged.length;
  
  // For MVP, since we're only scanning default branch, merged count equals total
  const mergeRatio = aiCommitsTotal > 0 ? aiCommitsMergedCount / aiCommitsTotal : 0;
  
  return {
    aiCommitsTotal,
    aiCommitsMerged: aiCommitsMergedCount,
    mergeRatio,
  };
}
