import {
  BlameStream,
  Commit,
  CommitStream,
  METRICS_SCHEMA_VERSION,
  PRStream,
  formatISODate,
} from '@aida-dev/core';
import { calculateAgeStats, calculateCategoryCounts } from './cohort.js';
import { calculateBaselinePersistence, calculatePersistence } from './persistence.js';
import { calculateLineSurvival } from './line-survival.js';
import { calculatePRAcceptance } from './pr-acceptance.js';
import { Attribution, ByMode, Metrics, ModeStats } from './schema/metrics.js';

export * from './schema/metrics.js';
export * from './cohort.js';
export * from './persistence.js';
export * from './pr-acceptance.js';
export * from './line-survival.js';

export const DEFAULT_COVERAGE_WINDOW_DAYS = 90;

export interface MetricsOptions {
  // Prior applied to 'unknown' commits: which cohort (if any) they join.
  defaultAttribution?: 'ai' | 'human' | 'unknown';
  coverageThreshold?: number;
  // Window for the actionable coverage figure (#52)
  coverageWindowDays?: number;
  // Optional PR outcomes from `aida fetch-prs` (#51)
  prStream?: PRStream | null;
  // Optional line-level blame data from `aida blame` (#23)
  blameStream?: BlameStream | null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function calculateMetrics(
  commitStream: CommitStream,
  options: MetricsOptions = {}
): Metrics {
  const {
    defaultAttribution = 'unknown',
    coverageThreshold = 0.7,
    coverageWindowDays = DEFAULT_COVERAGE_WINDOW_DAYS,
    prStream = null,
    blameStream = null,
  } = options;

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

  // Coverage over a recent window (#52): the number a team can actually move.
  // All-time coverage is a permanent verdict on history predating adoption.
  const windowStart = new Date(Date.now() - coverageWindowDays * 24 * 60 * 60 * 1000);
  const recentCommits = commitStream.commits.filter(
    (commit) => new Date(commit.authorDate) >= windowStart
  );
  const recentCounts = { ai: 0, human: 0, automated: 0, unknown: 0 };
  for (const commit of recentCommits) recentCounts[commit.tags.attribution]++;
  const recentCoverage =
    recentCommits.length > 0
      ? (recentCounts.ai + recentCounts.human + recentCounts.automated) / recentCommits.length
      : 0;

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
    recent:
      recentCommits.length > 0
        ? {
            windowDays: coverageWindowDays,
            commitsTotal: recentCommits.length,
            ai: recentCounts.ai,
            human: recentCounts.human,
            automated: recentCounts.automated,
            unknown: recentCounts.unknown,
            coverage: round(recentCoverage, 4),
            belowThreshold: recentCoverage < coverageThreshold,
          }
        : null,
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

  // PR acceptance (#51): present only when fetch-prs ran
  const prAcceptance = prStream ? calculatePRAcceptance(prStream) : null;
  // Line-level survival (#23): present only when blame ran
  const lineSurvival = blameStream ? calculateLineSurvival(blameStream, commitStream) : null;

  const caveats = [
    `Attribution coverage is ${(coverage * 100).toFixed(1)}%: metrics only describe commits whose provenance is known.`,
    'Rework rate is file-level: consecutive commits from one working session touching the same file count as rework, which inflates it for iterative workflows. Files too recent to judge are excluded from both sides. Line-level tracking will refine this.',
    'Persistence is file-level, not line-level.',
    'Persistence is survival: days until the first subsequent modification. Files never modified again are censored at collection time. Migrations and generated files (convention-driven lifecycles) are excluded.',
    'Persistence comparisons are only meaningful between cohorts of similar age and task mix — check the cohorts section before reading the delta.',
    'AI tagging uses heuristic patterns; false positives/negatives possible.',
  ];
  if (prAcceptance?.truncated) {
    caveats.push(
      'PR acceptance covers a capped sample of pull requests (--max-prs), not the full history.'
    );
  }
  if (lineSurvival?.truncated) {
    caveats.push(
      'Line survival covers a capped sample of files (--max-files), not the whole tree.'
    );
  }
  if (!lineSurvival) {
    caveats.push(
      "Line-level survival is unavailable: run 'aida blame' for exact per-line attribution instead of the file-level proxy."
    );
  }
  if (!prAcceptance) {
    caveats.push(
      "PR acceptance is unavailable: run 'aida fetch-prs' to measure whether AI work is accepted. Git history alone cannot answer that."
    );
  }
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
    schemaVersion: METRICS_SCHEMA_VERSION,
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
    prAcceptance,
    lineSurvival,
    baseline,
    delta,
    caveats,
  };
}
