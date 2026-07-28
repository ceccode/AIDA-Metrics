import { z } from 'zod';

// Attribution coverage (#34): the headline metric. Every other number in this
// file is only as trustworthy as this block says it is.
export const Attribution = z.object({
  commitsTotal: z.number().int().nonnegative(),
  ai: z.number().int().nonnegative(),
  human: z.number().int().nonnegative(),
  // Provenance-known automation (#39): merge commits, bots, manifest-excluded.
  // Counts toward coverage, joins no cohort, untouched by priors.
  automated: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
  coverage: z.number().min(0).max(1), // (ai + human + automated) / total
  defaultAttribution: z.enum(['ai', 'human', 'unknown']), // prior applied to unknown commits
  coverageThreshold: z.number().min(0).max(1),
  belowThreshold: z.boolean(),
  // Autonomy axis (#25): commit counts per mode and per mode-evidence level
  modes: z.object({
    none: z.number().int().nonnegative(),
    autocomplete: z.number().int().nonnegative(),
    assisted: z.number().int().nonnegative(),
    agent: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative(),
  }),
  modeEvidence: z.object({
    declared: z.number().int().nonnegative(),
    inferred: z.number().int().nonnegative(),
    none: z.number().int().nonnegative(),
  }),
});

// Persistence = survival: days from first target-cohort touch of a file to
// the first subsequent modification. Files never modified again are censored
// at the observation end (they survived the window — the best outcome).
// Migrations and generated files are excluded by default: their lifecycle is
// convention-driven and carries no quality signal.
export const Persistence = z.object({
  commitsConsidered: z.number().int().nonnegative(),
  filesConsidered: z.number().int().nonnegative(),
  filesExcluded: z.number().int().nonnegative(),
  censored: z.number().int().nonnegative(), // files that survived the whole window
  avgDays: z.number().nonnegative(),
  medianDays: z.number().nonnegative(),
  buckets: z.object({
    d0_1: z.number().int().nonnegative(),
    d2_7: z.number().int().nonnegative(),
    d8_30: z.number().int().nonnegative(),
    d31_90: z.number().int().nonnegative(),
    d90_plus: z.number().int().nonnegative(),
  }),
});

// Cohort age (#29): context for judging whether a persistence comparison
// between cohorts is fair — older cohorts accumulate survival by default.
export const AgeStats = z.object({
  commits: z.number().int().nonnegative(),
  avgAgeDays: z.number().nonnegative(),
  medianAgeDays: z.number().nonnegative(),
});

// Task mix (#36): what kind of files each cohort touched. A persistence
// comparison is only meaningful when the mixes are similar.
export const FileCategory = z.enum([
  'source',
  'tests',
  'migrations',
  'config',
  'docs',
  'generated',
]);

export const CategoryCounts = z.object({
  source: z.number().int().nonnegative(),
  tests: z.number().int().nonnegative(),
  migrations: z.number().int().nonnegative(),
  config: z.number().int().nonnegative(),
  docs: z.number().int().nonnegative(),
  generated: z.number().int().nonnegative(),
});

export const CohortContext = z.object({
  age: AgeStats.nullable(),
  taskMix: CategoryCounts.nullable(),
});

export const Baseline = z.object({
  // True when the cohort includes 'unknown' commits via defaultAttribution:
  // the baseline is an assumption, not observed attribution.
  assumed: z.boolean(),
  persistence: Persistence,
});

export const Delta = z.object({
  avgPersistenceDays: z.number(),
  medianPersistenceDays: z.number(),
});

// Per-autonomy-level metrics (#25, step 2): the durable comparison in an
// AI-first world is between autonomy levels, not AI vs human. Automated
// commits are excluded — automation is not authored code. Null when the
// mode has no commits.
export const ModeStats = z.object({
  commits: z.number().int().nonnegative(),
  persistence: Persistence,
});

export const ByMode = z.object({
  agent: ModeStats.nullable(),
  assisted: ModeStats.nullable(),
  autocomplete: ModeStats.nullable(),
  none: ModeStats.nullable(),
  unknown: ModeStats.nullable(),
});

export const Metrics = z.object({
  generatedAt: z.string().datetime(),
  window: z.object({
    since: z.string().optional(),
    until: z.string().optional(),
  }),
  repoPath: z.string(),
  defaultBranch: z.string(),
  attribution: Attribution,
  persistence: Persistence,
  // Fairness context (#29, #36): age and task mix per cohort, so consumers
  // can judge whether the AI-vs-baseline comparison is apples-to-apples.
  cohorts: z.object({
    ai: CohortContext,
    baseline: CohortContext,
  }),
  byMode: ByMode,
  // Null when no commit is attributed 'human' and no defaultAttribution prior
  // assigns the unknowns: AIDA does not invent a comparison cohort.
  baseline: Baseline.nullable(),
  delta: Delta.nullable(),
  caveats: z.array(z.string()),
});

export type Attribution = z.infer<typeof Attribution>;
export type AgeStats = z.infer<typeof AgeStats>;
export type FileCategory = z.infer<typeof FileCategory>;
export type CategoryCounts = z.infer<typeof CategoryCounts>;
export type CohortContext = z.infer<typeof CohortContext>;
export type ModeStats = z.infer<typeof ModeStats>;
export type ByMode = z.infer<typeof ByMode>;
export type Persistence = z.infer<typeof Persistence>;
export type Baseline = z.infer<typeof Baseline>;
export type Delta = z.infer<typeof Delta>;
export type Metrics = z.infer<typeof Metrics>;
