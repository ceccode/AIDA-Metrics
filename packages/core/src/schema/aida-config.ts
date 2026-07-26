import { z } from 'zod';

export const AidaConfig = z.object({
  tools: z.array(z.string()).default([]),
  trailerDomains: z.array(z.string()).default([]),
  botBlocklist: z.array(z.string()).default([]),
  patterns: z.array(z.string()).default([]),
  // Prior applied to 'unknown' commits at analysis time (#34).
  // 'unknown' (default) = no assumption: unknown commits join no cohort.
  defaultAttribution: z.enum(['ai', 'human', 'unknown']).default('unknown'),
  // Attribution coverage below this fraction flags all metrics as low-confidence.
  coverageThreshold: z.number().min(0).max(1).default(0.7),
});

export type AidaConfig = z.infer<typeof AidaConfig>;
