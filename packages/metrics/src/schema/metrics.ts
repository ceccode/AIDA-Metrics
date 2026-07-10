import { z } from 'zod';

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
  mergeRatio: MergeRatio,
  persistence: Persistence,
  baseline: Baseline,
  delta: Delta,
  caveats: z.array(z.string()),
});

export type MergeRatio = z.infer<typeof MergeRatio>;
export type Persistence = z.infer<typeof Persistence>;
export type CohortMergeRatio = z.infer<typeof CohortMergeRatio>;
export type Baseline = z.infer<typeof Baseline>;
export type Delta = z.infer<typeof Delta>;
export type Metrics = z.infer<typeof Metrics>;
