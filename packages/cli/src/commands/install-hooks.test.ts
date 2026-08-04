import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Command } from 'commander';
import { createInstallHooksCommand } from './install-hooks.js';
import { createCollectCommand } from './collect.js';

let repoPath: string;

// The suite may itself run inside an agent environment (it did during
// development: the hook correctly detected Claude Code and stamped every
// commit). Tests must therefore control detection inputs explicitly.
const DETECTION_VARS = ['AIDA_MODE', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CURSOR_TRACE_ID'];

function git(cmd: string, env: Record<string, string> = {}) {
  const clean = { ...process.env };
  for (const key of DETECTION_VARS) delete clean[key];
  execSync(cmd, { cwd: repoPath, env: { ...clean, ...env } });
}

function run(command: Command, args: string[]): Promise<Command> {
  return command.parseAsync(args, { from: 'user' });
}

function hookPath(): string {
  return join(repoPath, '.git', 'hooks', 'prepare-commit-msg');
}

beforeEach(() => {
  repoPath = mkdtempSync(join(tmpdir(), 'aida-hooks-'));
  git('git init -q -b main');
  git('git config user.name test && git config user.email test@example.com');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(repoPath, { recursive: true, force: true });
});

describe('aida install-hooks', () => {
  it('installs an executable hook', async () => {
    await run(createInstallHooksCommand(), ['--repo', repoPath]);

    expect(existsSync(hookPath())).toBe(true);
    expect(statSync(hookPath()).mode & 0o111).toBeTruthy();
    expect(readFileSync(hookPath(), 'utf-8')).toContain('AI-Mode');
  });

  it('is idempotent', async () => {
    await run(createInstallHooksCommand(), ['--repo', repoPath]);
    const first = readFileSync(hookPath(), 'utf-8');
    await run(createInstallHooksCommand(), ['--repo', repoPath]);
    expect(readFileSync(hookPath(), 'utf-8')).toBe(first);
  });

  it('refuses to clobber a hook it did not write', async () => {
    writeFileSync(hookPath(), '#!/bin/sh\necho mine\n', { mode: 0o755 });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(createInstallHooksCommand(), ['--repo', repoPath])).rejects.toThrow(
      'process.exit'
    );
    expect(errorSpy.mock.calls.flat().join(' ')).toContain('not written by AIDA');
    // The foreign hook is untouched
    expect(readFileSync(hookPath(), 'utf-8')).toContain('echo mine');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('overwrites a foreign hook only with --force', async () => {
    writeFileSync(hookPath(), '#!/bin/sh\necho mine\n', { mode: 0o755 });
    await run(createInstallHooksCommand(), ['--repo', repoPath, '--force']);
    expect(readFileSync(hookPath(), 'utf-8')).toContain('AI-Mode');
  });

  it('uninstalls what it installed', async () => {
    await run(createInstallHooksCommand(), ['--repo', repoPath]);
    await run(createInstallHooksCommand(), ['--repo', repoPath, '--uninstall']);
    expect(existsSync(hookPath())).toBe(false);
  });

  it('uninstall is a no-op when no AIDA hook is present', async () => {
    writeFileSync(hookPath(), '#!/bin/sh\necho mine\n', { mode: 0o755 });
    await run(createInstallHooksCommand(), ['--repo', repoPath, '--uninstall']);
    expect(readFileSync(hookPath(), 'utf-8')).toContain('echo mine');
  });
});

describe('the installed hook, running for real', () => {
  beforeEach(async () => {
    await run(createInstallHooksCommand(), ['--repo', repoPath]);
  });

  it('stamps AI-Mode from AIDA_MODE and collect reads it as declared', async () => {
    git('git commit -q --allow-empty -m "feat: agent work"', { AIDA_MODE: 'agent' });

    const message = execSync('git log -1 --format=%B', { cwd: repoPath }).toString();
    expect(message).toContain('AI-Mode: agent');

    const outDir = mkdtempSync(join(tmpdir(), 'aida-hooks-out-'));
    try {
      await run(createCollectCommand(), ['--repo', repoPath, '--out-dir', outDir]);
      const stream = JSON.parse(readFileSync(join(outDir, 'commit-stream.json'), 'utf-8'));
      const commit = stream.commits[0];
      expect(commit.tags.mode).toBe('agent');
      expect(commit.tags.evidence).toBe('declared');
      expect(commit.tags.attribution).toBe('ai');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('declares human authorship with AIDA_MODE=none', async () => {
    git('git commit -q --allow-empty -m "fix: hand written"', { AIDA_MODE: 'none' });

    const outDir = mkdtempSync(join(tmpdir(), 'aida-hooks-out-'));
    try {
      await run(createCollectCommand(), ['--repo', repoPath, '--out-dir', outDir]);
      const stream = JSON.parse(readFileSync(join(outDir, 'commit-stream.json'), 'utf-8'));
      // The first real source of `human` attribution that isn't the manifest
      expect(stream.commits[0].tags.attribution).toBe('human');
      expect(stream.commits[0].tags.mode).toBe('none');
      expect(stream.commits[0].tags.evidence).toBe('declared');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('writes nothing when the mode is unknown — absence stays honest', () => {
    git('git commit -q --allow-empty -m "chore: no mode known"');
    const message = execSync('git log -1 --format=%B', { cwd: repoPath }).toString();
    expect(message).not.toContain('AI-Mode');
  });

  it('rejects an invalid AIDA_MODE instead of stamping garbage', () => {
    git('git commit -q --allow-empty -m "chore: bogus mode"', { AIDA_MODE: 'wizard' });
    const message = execSync('git log -1 --format=%B', { cwd: repoPath }).toString();
    expect(message).not.toContain('AI-Mode');
  });

  it('does not double-stamp a message that already declares a mode', () => {
    git('git commit -q --allow-empty -m "feat: x" -m "AI-Mode: assisted"', {
      AIDA_MODE: 'agent',
    });
    const message = execSync('git log -1 --format=%B', { cwd: repoPath }).toString();
    expect(message.match(/AI-Mode:/g)).toHaveLength(1);
    expect(message).toContain('AI-Mode: assisted');
  });

  it('reads defaultMode from .aida.json when nothing else determines it', () => {
    writeFileSync(join(repoPath, '.aida.json'), JSON.stringify({ defaultMode: 'assisted' }));
    git('git add -A && git commit -q -m "chore: config"');
    const message = execSync('git log -1 --format=%B', { cwd: repoPath }).toString();
    expect(message).toContain('AI-Mode: assisted');
  });

  it('never blocks a commit, even if the hook body fails', () => {
    // A hook whose logic throws must still let the commit through
    writeFileSync(
      hookPath(),
      '#!/bin/sh\n# >>> aida-metrics mode stamp >>>\nthis-command-does-not-exist 2>/dev/null || true\nexit 0\n# <<< aida-metrics mode stamp <<<\n',
      { mode: 0o755 }
    );
    expect(() => git('git commit -q --allow-empty -m "chore: survives"')).not.toThrow();
  });
});
