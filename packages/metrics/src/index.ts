import { CommitStream, formatISODate } from '@aida-dev/core';
import { calculateMergeRatio } from './merge-ratio.js';
import { calculatePersistence } from './persistence.js';
import { Metrics } from './schema/metrics.js';

export * from './schema/metrics.js';
export * from './merge-ratio.js';
export * from './persistence.js';

export function calculateMetrics(commitStream: CommitStream): Metrics {
  const mergeRatio = calculateMergeRatio(commitStream);
  const persistence = calculatePersistence(commitStream);
  
  const caveats = [
    "Persistence is file-level, not line-level.",
    "Merge ratio computed on default branch only for MVP.",
    "AI tagging uses heuristic patterns; false positives/negatives possible.",
  ];
  
  return {
    generatedAt: formatISODate(new Date()),
    window: {
      since: commitStream.since,
      until: commitStream.until,
    },
    repoPath: commitStream.repoPath,
    defaultBranch: commitStream.defaultBranch,
    mergeRatio,
    persistence,
    caveats,
  };
}
