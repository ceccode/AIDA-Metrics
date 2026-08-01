import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { blameFileLineCounts, collectBlame } from './blame.js';

let repoPath: string;
let firstSha: string;
let secondSha: string;

function git(cmd: string) {
  execSync(cmd, { cwd: repoPath });
}

beforeAll(() => {
  repoPath = mkdtempSync(join(tmpdir(), 'aida-blame-'));
  git('git init -q -b main');
  git('git config user.name test && git config user.email test@example.com');

  // 4 lines from the first commit
  writeFileSync(join(repoPath, 'app.ts'), 'a\nb\nc\nd\n');
  git('git add -A && git commit -q -m "feat: first"');
  firstSha = execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim();

  // Rewrite 2 of them, so blame splits between the two commits
  writeFileSync(join(repoPath, 'app.ts'), 'a\nb\nCC\nDD\n');
  writeFileSync(join(repoPath, 'pnpm-lock.yaml'), 'lock\nlock\nlock\n');
  git('git add -A && git commit -q -m "fix: second"');
  secondSha = execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim();
});

afterAll(() => {
  rmSync(repoPath, { recursive: true, force: true });
});

describe('blameFileLineCounts', () => {
  it('splits surviving lines between the commits that last wrote them', async () => {
    const counts = await blameFileLineCounts(repoPath, 'app.ts');
    expect(counts.get(firstSha)).toBe(2); // a, b
    expect(counts.get(secondSha)).toBe(2); // CC, DD
  });

  it('rejects a path that does not exist rather than reporting zero', async () => {
    await expect(blameFileLineCounts(repoPath, 'nope.ts')).rejects.toThrow();
  });
});

describe('collectBlame', () => {
  it('aggregates line counts across the tree', async () => {
    const stream = await collectBlame({ repoPath });
    expect(stream.schemaVersion).toBe(1);
    expect(stream.filesBlamed).toBe(2); // app.ts + pnpm-lock.yaml
    expect(stream.totalLines).toBe(7); // 4 + 3
    expect(stream.linesBySha[firstSha]).toBe(2);
    expect(stream.truncated).toBe(false);
  });

  it('honours the exclude predicate and reports what it skipped', async () => {
    const stream = await collectBlame({
      repoPath,
      exclude: (path) => path.endsWith('.yaml'),
    });
    expect(stream.filesBlamed).toBe(1);
    expect(stream.filesExcluded).toBe(1);
    expect(stream.totalLines).toBe(4);
  });

  it('flags truncation when --max-files caps the walk', async () => {
    const stream = await collectBlame({ repoPath, maxFiles: 1 });
    expect(stream.truncated).toBe(true);
    expect(stream.filesBlamed).toBe(1);
  });

  it('excludes binary files, which git blame would otherwise count as one line each', async () => {
    writeFileSync(join(repoPath, 'blob.bin'), Buffer.from([0, 1, 2, 0, 255, 0]));
    git('git add -A && git commit -q -m "chore: binary"');

    const stream = await collectBlame({ repoPath });
    expect(stream.filesSkipped).toBe(1); // blob.bin
    expect(stream.filesBlamed).toBe(2); // app.ts + pnpm-lock.yaml
    // The binary blob contributed no phantom line
    expect(stream.totalLines).toBe(7);
  });
});
