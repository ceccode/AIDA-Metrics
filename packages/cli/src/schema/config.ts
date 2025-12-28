import { z } from 'zod';

export const CLIConfig = z.object({
  repo: z.string().default(process.cwd()),
  since: z.string().optional(),
  until: z.string().optional(),
  aiPatterns: z.array(z.string()).default([]),
  defaultBranch: z.string().optional(),
  outDir: z.string().default('./aida-output'),
  format: z.enum(['json', 'md', 'both']).default('both'),
  verbose: z.boolean().default(false),
});

export type CLIConfig = z.infer<typeof CLIConfig>;
