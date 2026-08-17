import { AidaConfig, assertNoRetiredConfigKeys } from '@aida-dev/core';
import { readFile } from 'fs/promises';
import { join } from 'path';

/** Load the repository configuration without turning malformed input into defaults. */
export async function loadAidaConfig(repoPath: string): Promise<Partial<AidaConfig>> {
  const path = join(repoPath, '.aida.json');
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }

  const parsed: unknown = JSON.parse(raw);
  assertNoRetiredConfigKeys(parsed);
  return AidaConfig.parse(parsed);
}
