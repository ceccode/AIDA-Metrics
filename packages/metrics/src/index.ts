import { Commit, CommitStream, formatISODate } from '@aida-dev/core';
import { calculateAgeStats, calculateCategoryCounts } from './cohort.js';
import { calculateBaselinePersistence, calculatePersistence } from './persistence.js';
import { Attribution, ByMode, Metrics, ModeStats } from './schema/metrics.js';

export * from './schema/metrics.js';
export * from './cohort.js';
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

  const counts = { ai: 0, human: 0, automated: 0, unknown: 0 };
  const modes = { none: 0, autocomplete: 0, assisted: 0, agent: 0, unknown: 0 };
  const modeEvidence = { declared: 0, inferred: 0, none: 0 };
  for (const commit of commitStream.commits) {
    counts[commit.tags.attribution]++;
    modes[commit.tags.mode]++;
    modeEvidence[commit.tags.modeEvidence]++;
  }
  const total = commitStream.commits.length;
  // Automated commits have known provenance (#39): they count as covered
  const coverage = total > 0 ? (counts.ai + counts.human + counts.automated) / total : 0;

  const attribution: Attribution = {
    commitsTotal: total,
    ai: counts.ai,
    human: counts.human,
    automated: counts.automated,
    unknown: counts.unknown,
    coverage: round(coverage, 4),
    defaultAttribution,
    coverageThreshold,
    belowThreshold: coverage < coverageThreshold,
    modes,
    modeEvidence,
  };

  // Cohort membership: unknown commits join a cohort only via the prior.
  // 'automated' is its own state (#39): it joins no cohort and priors never
  // touch it — automation is not authored code.
  const isAI = (commit: Commit) =>
    commit.tags.attribution === 'ai' ||
    (defaultAttribution === 'ai' && commit.tags.attribution === 'unknown');
  const isBaseline = (commit: Commit) =>
    commit.tags.attribution === 'human' ||
    (defaultAttribution === 'human' && commit.tags.attribution === 'unknown');

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

  // Per-autonomy-level metrics (#25, step 2). Automated commits are
  // excluded: automation is not authored code, whatever its mode field says.
  const MODES = ['agent', 'assisted', 'autocomplete', 'none', 'unknown'] as const;
  const byMode = Object.fromEntries(
    MODES.map((mode) => {
      const isMode = (commit: Commit) =>
        commit.tags.mode === mode && commit.tags.attribution !== 'automated';
      const modeCommits = commitStream.commits.filter(isMode);
      if (modeCommits.length === 0) {
        return [mode, null];
      }
      const stats: ModeStats = {
        commits: modeCommits.length,
        persistence: calculatePersistence(commitStream, isMode),
      };
      return [mode, stats];
    })
  ) as ByMode;

  // No baseline cohort → no baseline, no delta. AIDA does not invent a
  // comparison out of unattributed commits.
  const baselineSize = baselineCommits.length;
  const baselineAssumed = defaultAttribution === 'human' && counts.unknown > 0;

  const baseline =
    baselineSize > 0
      ? {
          assumed: baselineAssumed,
          persistence: calculateBaselinePersistence(commitStream, isBaseline),
        }
      : null;

  const delta = baseline
    ? {
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
    persistence,
    cohorts,
    byMode,
    baseline,
    delta,
    caveats,
  };
}
