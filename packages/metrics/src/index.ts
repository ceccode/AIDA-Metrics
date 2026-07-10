import { CommitStream, formatISODate } from '@aida-dev/core';
import { calculateBaselineMergeRatio, calculateMergeRatio } from './merge-ratio.js';
import { calculateBaselinePersistence, calculatePersistence } from './persistence.js';
import { Metrics } from './schema/metrics.js';

export * from './schema/metrics.js';
export * from './merge-ratio.js';
export * from './persistence.js';

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function calculateMetrics(commitStream: CommitStream): Metrics {
  const mergeRatio = calculateMergeRatio(commitStream);
  const persistence = calculatePersistence(commitStream);
  const baselineMergeRatio = calculateBaselineMergeRatio(commitStream);
  const baselinePersistence = calculateBaselinePersistence(commitStream);

  const delta = {
    mergeRatio: round(mergeRatio.mergeRatio - baselineMergeRatio.mergeRatio, 4),
    avgPersistenceDays: round(persistence.avgDays - baselinePersistence.avgDays, 2),
    medianPersistenceDays: round(persistence.medianDays - baselinePersistence.medianDays, 2),
  };

  const caveats = [
    'Persistence is file-level, not line-level.',
    'Merge ratio: commits from all branches checked against default branch ancestry. Squash merges may undercount unmerged commits.',
    'AI tagging uses heuristic patterns; false positives/negatives possible.',
    'Baseline covers all non-AI-tagged commits; undetected AI usage may leak into the baseline.',
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
    baseline: {
      mergeRatio: baselineMergeRatio,
      persistence: baselinePersistence,
    },
    delta,
    caveats,
  };
}
