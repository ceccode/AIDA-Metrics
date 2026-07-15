import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { collectCommits } from './collect.js';

const AUTHOR = { name: 'Alice Author', email: 'alice@example.com', date: '2026-01-01T10:00:00Z' };
const COMMITTER = { name: 'Bob Committer', email: 'bob@example.com', date: '2026-01-05T10:00:00Z' };

let repoPath: string;

function run(cmd: string, env: Record<string, string> = {}) {
  execSync(cmd, { cwd: repoPath, env: { ...process.env, ...env } });
}

function commit(message: string) {
  const escaped = message.replace(/"/g, '\\"');
  run(`git commit -q -m "${escaped}"`, {
    GIT_AUTHOR_NAME: AUTHOR.name,
    GIT_AUTHOR_EMAIL: AUTHOR.email,
    GIT_AUTHOR_DATE: AUTHOR.date,
    GIT_COMMITTER_NAME: COMMITTER.name,
    GIT_COMMITTER_EMAIL: COMMITTER.email,
    GIT_COMMITTER_DATE: COMMITTER.date,
  });
}

beforeAll(() => {
  repoPath = mkdtempSync(join(tmpdir(), 'aida-collect-test-'));
  run('git init -q -b main');
  run('git config user.name test && git config user.email test@example.com');

  writeFileSync(join(repoPath, 'a.txt'), 'line1\nline2\n');
  writeFileSync(join(repoPath, 'b.txt'), 'temp\n');
  run('git add .');
  commit('feat: initial commit');

  writeFileSync(join(repoPath, 'a.txt'), 'line1\nline2\nline3\n');
  rmSync(join(repoPath, 'b.txt'));
  run('git add -A');
  commit('fix: multi-line message\n\nSome body text.\n\nCo-Authored-By: Claude <noreply@anthropic.com>');
});

afterAll(() => {
  rmSync(repoPath, { recursive: true, force: true });
});

describe('collectCommits', () => {
  it('collects real author and committer identities and dates', async () => {
    const stream = await collectCommits({ repoPath });
    expect(stream.commits).toHaveLength(2);

    const head = stream.commits[0];
    expect(head.authorName).toBe(AUTHOR.name);
    expect(head.authorEmail).toBe(AUTHOR.email);
    expect(head.committerName).toBe(COMMITTER.name);
    expect(head.committerEmail).toBe(COMMITTER.email);
    expect(head.authorDate).toBe('2026-01-01T10:00:00.000Z');
    expect(head.committerDate).toBe('2026-01-05T10:00:00.000Z');
    expect(head.committerDate).not.toBe(head.authorDate);
  });

  it('computes diff stats with file statuses from batched log', async () => {
    const stream = await collectCommits({ repoPath });
    const [head, initial] = stream.commits;

    expect(initial.stats.totalAdditions).toBe(3); // 2 lines a.txt + 1 line b.txt
    expect(initial.stats.files.map((f) => f.status)).toEqual(['added', 'added']);

    expect(head.stats.totalAdditions).toBe(1); // line3 in a.txt
    expect(head.stats.totalDeletions).toBe(1); // b.txt removed
    const byPath = Object.fromEntries(head.stats.files.map((f) => [f.path, f.status]));
    expect(byPath['a.txt']).toBe('modified');
    expect(byPath['b.txt']).toBe('deleted');
  });

  it('populates parents and ancestry, without the removed branch field', async () => {
    const stream = await collectCommits({ repoPath });
    const [head, initial] = stream.commits;

    expect(initial.parents).toEqual([]);
    expect(head.parents).toEqual([initial.hash]);
    expect(head.inDefaultBranchAncestry).toBe(true);
    expect(head).not.toHaveProperty('branch');
  });

  it('tags AI from trailers in the full message body, storing the subject only', async () => {
    const stream = await collectCommits({ repoPath });
    const head = stream.commits[0];

    expect(head.message).toBe('fix: multi-line message');
    expect(head.tags.ai).toBe(true);
    expect(head.tags.level).toBe('explicit');
  });
});
