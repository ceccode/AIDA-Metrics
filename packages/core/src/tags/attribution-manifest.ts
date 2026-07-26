import { z } from 'zod';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { AITagResult } from './ai-tags.js';
import { Logger } from '../utils/log.js';

export const MANIFEST_FILENAME = 'aida-attribution.json';

const ManifestEntry = z.object({
  hash: z.string().min(7),
  message: z.string().optional(), // documentation only, not matched
  reason: z.string().optional(),
});

export const AttributionManifest = z.object({
  version: z.string(),
  description: z.string().optional(),
  note: z.string().optional(),
  tool: z.string().optional(),
  model: z.string().optional(),
  ai_assisted_commits: z.array(ManifestEntry).default([]),
  human_authored_commits: z.array(ManifestEntry).default([]),
  excluded_commits: z.array(ManifestEntry).default([]),
});

export type AttributionManifest = z.infer<typeof AttributionManifest>;

// Hash-indexed view of a manifest for O(1) lookup during collect.
export interface ManifestIndex {
  ai: Set<string>;
  human: Set<string>;
  excluded: Set<string>;
  // Hashes seen during collect, to report manifest entries that matched nothing
  matched: Set<string>;
}

export function indexManifest(manifest: AttributionManifest): ManifestIndex {
  return {
    ai: new Set(manifest.ai_assisted_commits.map((e) => e.hash)),
    human: new Set(manifest.human_authored_commits.map((e) => e.hash)),
    excluded: new Set(manifest.excluded_commits.map((e) => e.hash)),
    matched: new Set(),
  };
}

// Loads <repoPath>/aida-attribution.json. Missing file → null (manifest is
// optional). Invalid file → warning, null: a broken manifest must never make
// collect fail.
export async function loadAttributionManifest(
  repoPath: string,
  logger?: Logger
): Promise<AttributionManifest | null> {
  const manifestPath = join(repoPath, MANIFEST_FILENAME);

  let raw: string;
  try {
    raw = await readFile(manifestPath, 'utf-8');
  } catch {
    return null; // no manifest — the common case
  }

  try {
    const manifest = AttributionManifest.parse(JSON.parse(raw));
    logger?.info(
      `Attribution manifest loaded: ${manifest.ai_assisted_commits.length} ai, ` +
        `${manifest.human_authored_commits.length} human, ` +
        `${manifest.excluded_commits.length} excluded`
    );
    return manifest;
  } catch (error) {
    logger?.warn(
      `Ignoring invalid ${MANIFEST_FILENAME}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
    );
    return null;
  }
}

// Applies manifest declarations on top of the heuristic tag result.
// Precedence: in-commit evidence beats retroactive declarations, except
// 'excluded', which always wins (it exists precisely to correct heuristic
// false positives like automated release commits).
export function applyManifest(
  heuristic: AITagResult,
  hash: string,
  index: ManifestIndex,
  logger?: Logger
): AITagResult {
  if (index.excluded.has(hash)) {
    index.matched.add(hash);
    return {
      ai: false,
      attribution: 'unknown',
      level: 'none',
      sources: [...heuristic.sources, 'manifest:excluded'],
    };
  }

  if (index.ai.has(hash)) {
    index.matched.add(hash);
    return {
      ai: true,
      attribution: 'ai',
      // A manifest declaration is explicit, whatever the heuristics said
      level: 'explicit',
      sources: [...heuristic.sources, 'manifest'],
    };
  }

  if (index.human.has(hash)) {
    index.matched.add(hash);
    if (heuristic.attribution === 'ai') {
      // The commit itself carries an AI signal: in-commit evidence wins.
      logger?.warn(
        `Manifest declares ${hash.slice(0, 8)} human, but the commit has an explicit AI signal (${heuristic.sources.join(', ')}) — keeping ai`
      );
      return heuristic;
    }
    return {
      ai: false,
      attribution: 'human',
      level: heuristic.level,
      sources: [...heuristic.sources, 'manifest'],
    };
  }

  return heuristic;
}

// Manifest hashes that matched no collected commit — typo, rebase, or a
// --since window that excludes them. Informational, never an error.
export function unmatchedManifestHashes(index: ManifestIndex): string[] {
  return [...index.ai, ...index.human, ...index.excluded].filter(
    (hash) => !index.matched.has(hash)
  );
}
