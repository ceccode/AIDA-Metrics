import { z } from 'zod';

// Attribution coverage (#34): the headline metric. Every other number in this
// file is only as trustworthy as this block says it is.
export const Attribution = z.object({
  commitsTotal: z.number().int().nonnegative(),
  ai: z.number().int().nonnegative(),
  human: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
  coverage: z.number().min(0).max(1), // (ai + human) / total
  defaultAttribution: z.enum(['ai', 'human', 'unknown']), // prior applied to unknown commits
  coverageThreshold: z.number().min(0).max(1),
  belowThreshold: z.boolean(),
});

export const MergeRatio = z.object({
  aiCommitsTotal: z.number().int().nonnegative(),
  aiCommitsMerged: z.number().int().nonnegative(),
  mergeRatio: z.number().min(0).max(1),
});

export const Persistence = z.object({
  commitsConsidered: z.number().int().nonnegative(),
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

export const CohortMergeRatio = z.object({
  commitsTotal: z.number().int().nonnegative(),
  commitsMerged: z.number().int().nonnegative(),
  mergeRatio: z.number().min(0).max(1),
});

export const Baseline = z.object({
  // True when the cohort includes 'unknown' commits via defaultAttribution:
  // the baseline is an assumption, not observed attribution.
  assumed: z.boolean(),
  mergeRatio: CohortMergeRatio,
  persistence: Persistence,
});

export const Delta = z.object({
  mergeRatio: z.number(),
  avgPersistenceDays: z.number(),
  medianPersistenceDays: z.number(),
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
  mergeRatio: MergeRatio,
  persistence: Persistence,
  // Null when no commit is attributed 'human' and no defaultAttribution prior
  // assigns the unknowns: AIDA does not invent a comparison cohort.
  baseline: Baseline.nullable(),
  delta: Delta.nullable(),
  caveats: z.array(z.string()),
});

export type Attribution = z.infer<typeof Attribution>;
export type MergeRatio = z.infer<typeof MergeRatio>;
export type Persistence = z.infer<typeof Persistence>;
export type CohortMergeRatio = z.infer<typeof CohortMergeRatio>;
export type Baseline = z.infer<typeof Baseline>;
export type Delta = z.infer<typeof Delta>;
export type Metrics = z.infer<typeof Metrics>;
