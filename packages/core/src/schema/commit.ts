import { z } from 'zod';

export const FileChange = z.object({
  path: z.string(),
  status: z.enum(['added', 'modified', 'deleted', 'renamed']).optional(), // best-effort
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});

export const Commit = z.object({
  hash: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
  authorDate: z.string().datetime(), // ISO
  committerName: z.string(),
  committerEmail: z.string(),
  committerDate: z.string().datetime(),
  message: z.string(),
  parents: z.array(z.string()),
  branch: z.string().optional(), // best-effort if known
  inDefaultBranchAncestry: z.boolean(), // set during collect
  tags: z.object({
    ai: z.boolean(),
    sources: z.array(z.string()), // which heuristic matched
  }),
  stats: z.object({
    totalAdditions: z.number().int().nonnegative(),
    totalDeletions: z.number().int().nonnegative(),
    files: z.array(FileChange),
  }),
});

export type Commit = z.infer<typeof Commit>;

export const CommitStream = z.object({
  repoPath: z.string(),
  defaultBranch: z.string(),
  generatedAt: z.string().datetime(),
  since: z.string().optional(),
  until: z.string().optional(),
  aiPatterns: z.array(z.string()),
  commits: z.array(Commit),
});

export type CommitStream = z.infer<typeof CommitStream>;
