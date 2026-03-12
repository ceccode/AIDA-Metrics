import { z } from 'zod';

export const AidaConfig = z.object({
  tools: z.array(z.string()).default([]),
  trailerDomains: z.array(z.string()).default([]),
  patterns: z.array(z.string()).default([]),
});

export type AidaConfig = z.infer<typeof AidaConfig>;
