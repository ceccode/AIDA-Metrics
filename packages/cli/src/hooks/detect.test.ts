import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isAidaHookInstalled, isGitRepository, resolveHooksDir } from './detect.js';
import { HOOK_SCRIPT } from './prepare-commit-msg.js';

let repoPath: string;

beforeEach(() => {
  repoPath = mkdtempSync(join(tmpdir(), 'aida-detect-'));
  execSync('git init -q -b main', { cwd: repoPath });
});

afterEach(() => {
  rmSync(repoPath, { recursive: true, force: true });
});

describe('isGitRepository', () => {
  it('is true inside a work tree', async () => {
    expect(await isGitRepository(repoPath)).toBe(true);
  });

  it('is false where there is no git at all', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'aida-nogit-'));
    try {
      expect(await isGitRepository(bare)).toBe(false);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe('isAidaHookInstalled', () => {
  // The distinction #75 turns on: `.aida.json` is committed and shared, the
  // hook is per-clone. A repo can be set up for AIDA while the clone in
  // front of you declares nothing, and nothing visibly breaks.
  it('is false on a fresh clone, even one configured for AIDA', async () => {
    writeFileSync(join(repoPath, '.aida.json'), JSON.stringify({ defaultMode: 'agent' }));
    expect(await isAidaHookInstalled(repoPath)).toBe(false);
  });

  it('is true once the hook is written', async () => {
    const hooks = await resolveHooksDir(repoPath);
    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, 'prepare-commit-msg'), HOOK_SCRIPT, { mode: 0o755 });
    expect(await isAidaHookInstalled(repoPath)).toBe(true);
  });

  it('is false for a foreign hook occupying the same path', async () => {
    const hooks = await resolveHooksDir(repoPath);
    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, 'prepare-commit-msg'), '#!/bin/sh\necho not ours\n', { mode: 0o755 });
    expect(await isAidaHookInstalled(repoPath)).toBe(false);
  });

  it('follows core.hooksPath rather than assuming .git/hooks', async () => {
    const custom = join(repoPath, 'my-hooks');
    mkdirSync(custom, { recursive: true });
    execSync('git config core.hooksPath my-hooks', { cwd: repoPath });
    expect(await isAidaHookInstalled(repoPath)).toBe(false);

    writeFileSync(join(custom, 'prepare-commit-msg'), HOOK_SCRIPT, { mode: 0o755 });
    expect(await isAidaHookInstalled(repoPath)).toBe(true);
  });
});
