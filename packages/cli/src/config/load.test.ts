import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadAidaConfig } from './load.js';

const dirs: string[] = [];

function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'aida-config-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('loadAidaConfig', () => {
  it('returns defaults only when the file is absent', async () => {
    await expect(loadAidaConfig(tempRepo())).resolves.toEqual({});
  });

  it('does not silently ignore malformed JSON or misspelled keys', async () => {
    const malformed = tempRepo();
    writeFileSync(join(malformed, '.aida.json'), '{ broken');
    await expect(loadAidaConfig(malformed)).rejects.toBeInstanceOf(SyntaxError);

    const typo = tempRepo();
    writeFileSync(join(typo, '.aida.json'), JSON.stringify({ defaultMdoe: 'agent' }));
    await expect(loadAidaConfig(typo)).rejects.toThrow('Unrecognized key');
  });
});
