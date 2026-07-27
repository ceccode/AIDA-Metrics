import { Commit, CommitStream, formatISODate } from '@aida-dev/core';
import { calculateAgeStats, calculateCategoryCounts } from './cohort.js';
import { calculateBaselineMergeRatio, calculateMergeRatio } from './merge-ratio.js';
import { calculateBaselinePersistence, calculatePersistence } from './persistence.js';
import { Attribution, Metrics } from './schema/metrics.js';

export * from './schema/metrics.js';
export * from './cohort.js';
export * from './merge-ratio.js';
export * from './persistence.js';

export interface MetricsOptions {
  // Prior applied to 'unknown' commits: which cohort (if any) they join.
  defaultAttribution?: 'ai' | 'human' | 'unknown';
  coverageThreshold?: number;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function calculateMetrics(
  commitStream: CommitStream,
  options: MetricsOptions = {}
): Metrics {
  const { defaultAttribution = 'unknown', coverageThreshold = 0.7 } = options;

  const counts = { ai: 0, human: 0, unknown: 0 };
  const modes = { none: 0, autocomplete: 0, assisted: 0, agent: 0, unknown: 0 };
  const modeEvidence = { declared: 0, inferred: 0, none: 0 };
  for (const commit of commitStream.commits) {
    counts[commit.tags.attribution]++;
    modes[commit.tags.mode]++;
    modeEvidence[commit.tags.modeEvidence]++;
  }
  const total = commitStream.commits.length;
  const coverage = total > 0 ? (counts.ai + counts.human) / total : 0;

  const attribution: Attribution = {
    commitsTotal: total,
    ai: counts.ai,
    human: counts.human,
    unknown: counts.unknown,
    coverage: round(coverage, 4),
    defaultAttribution,
    coverageThreshold,
    belowThreshold: coverage < coverageThreshold,
    modes,
    modeEvidence,
  };

  // Cohort membership: unknown commits join a cohort only via the prior.
  // Manifest-excluded commits (release bots, merges) never do — they were
  // excluded precisely to stay out of both cohorts.
  const isExcluded = (commit: Commit) => commit.tags.sources.includes('manifest:excluded');
  const isAI = (commit: Commit) =>
    commit.tags.attribution === 'ai' ||
    (defaultAttribution === 'ai' && commit.tags.attribution === 'unknown' && !isExcluded(commit));
  const isBaseline = (commit: Commit) =>
    commit.tags.attribution === 'human' ||
    (defaultAttribution === 'human' &&
      commit.tags.attribution === 'unknown' &&
      !isExcluded(commit));

  const mergeRatio = calculateMergeRatio(commitStream, isAI);
  const persistence = calculatePersistence(commitStream, isAI);

  // Fairness context (#29, #36): cohort age and task mix
  const now = new Date();
  const aiCommits = commitStream.commits.filter(isAI);
  const baselineCommits = commitStream.commits.filter(isBaseline);
  const cohorts = {
    ai: {
      age: calculateAgeStats(aiCommits, now),
      taskMix: calculateCategoryCounts(aiCommits),
    },
    baseline: {
      age: calculateAgeStats(baselineCommits, now),
      taskMix: calculateCategoryCounts(baselineCommits),
    },
  };

  // No baseline cohort → no baseline, no delta. AIDA does not invent a
  // comparison out of unattributed commits.
  const baselineSize = baselineCommits.length;
  const baselineAssumed = defaultAttribution === 'human' && counts.unknown > 0;

  const baseline =
    baselineSize > 0
      ? {
          assumed: baselineAssumed,
          mergeRatio: calculateBaselineMergeRatio(commitStream, isBaseline),
          persistence: calculateBaselinePersistence(commitStream, isBaseline),
        }
      : null;

  const delta = baseline
    ? {
        mergeRatio: round(mergeRatio.mergeRatio - baseline.mergeRatio.mergeRatio, 4),
        avgPersistenceDays: round(persistence.avgDays - baseline.persistence.avgDays, 2),
        medianPersistenceDays: round(
          persistence.medianDays - baseline.persistence.medianDays,
          2
        ),
      }
    : null;

  const caveats = [
    `Attribution coverage is ${(coverage * 100).toFixed(1)}%: metrics only describe commits whose provenance is known.`,
    'Persistence is file-level, not line-level.',
    'Persistence is survival: days until the first subsequent modification. Files never modified again are censored at collection time. Migrations and generated files (convention-driven lifecycles) are excluded.',
    'Persistence comparisons are only meaningful between cohorts of similar age and task mix — check the cohorts section before reading the delta.',
    'Merge ratio: commits from all branches checked against default branch ancestry. Squash merges may undercount unmerged commits.',
    'Time-windowed collection (--since) also windows the ancestry check: commits merged into the default branch before the window may appear unmerged.',
    'AI tagging uses heuristic patterns; false positives/negatives possible.',
  ];
  if (baseline?.assumed) {
    caveats.push(
      `Baseline includes ${counts.unknown} unattributed commit(s) assumed human via defaultAttribution — undetected AI usage may leak into it.`
    );
  }
  if (!baseline) {
    caveats.push(
      'No baseline: no commits are attributed as human. Set defaultAttribution to "human" in .aida.json if unattributed commits in this repo are human-authored.'
    );
  }

  return {
    generatedAt: formatISODate(new Date()),
    window: {
      since: commitStream.since,
      until: commitStream.until,
    },
    repoPath: commitStream.repoPath,
    defaultBranch: commitStream.defaultBranch,
    attribution,
    mergeRatio,
    persistence,
    cohorts,
    baseline,
    delta,
    caveats,
  };
}
