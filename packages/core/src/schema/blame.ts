import { z } from 'zod';

// Line-level blame data (#23). Produced by `aida blame`, consumed by
// `aida analyze` when present.
//
// Kept in its own file — and behind its own command — because blame runs one
// git process per file and is by far the most expensive thing AIDA does.
// `collect` stays fast; line-level analysis is an explicit opt-in step.
export const BLAME_STREAM_SCHEMA_VERSION = 1;

export const BlameStream = z.object({
  schemaVersion: z.number().int().positive(),
  repoPath: z.string(),
  generatedAt: z.string().datetime(),
  filesBlamed: z.number().int().nonnegative(),
  // Binary, empty or unreadable paths: skipped rather than failing the run
  filesSkipped: z.number().int().nonnegative(),
  // Excluded by the caller's filter (lockfiles, generated output)
  filesExcluded: z.number().int().nonnegative(),
  // True when --max-files capped the walk: the sample is partial
  truncated: z.boolean(),
  totalLines: z.number().int().nonnegative(),
  // commit sha → lines in HEAD last written by that commit. Compact: one
  // entry per commit with surviving lines, not one per line.
  linesBySha: z.record(z.string(), z.number().int().nonnegative()),
});

export type BlameStream = z.infer<typeof BlameStream>;
