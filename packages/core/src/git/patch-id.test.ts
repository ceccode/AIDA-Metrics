import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { collectCommits } from './collect.js';
import { computePatchIds, findSquashMatch } from './patch-id.js';

// Proposal for #20: can patch-id recover squash-merged commits that an
// ancestry check reports as unmerged?

let repoPath: string;
let squashedCommit: string;
let multiCommitA: string;

function git(cmd: string) {
  execSync(cmd, { cwd: repoPath });
}

beforeAll(() => {
  repoPath = mkdtempSync(join(tmpdir(), 'aida-squash-'));
  git('git init -q -b main');
  git('git config user.name test && git config user.email test@example.com');

  writeFileSync(join(repoPath, 'base.txt'), 'base\n');
  git('git add -A && git commit -q -m "chore: base"');

  // Branch A: a single commit, squash-merged into main
  git('git checkout -q -b feature-single');
  writeFileSync(join(repoPath, 'single.txt'), 'one change\n');
  git('git add -A && git commit -q -m "feat: single-commit branch"');
  squashedCommit = execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim();

  git('git checkout -q main');
  git('git merge -q --squash feature-single');
  git('git commit -q -m "feat: single-commit branch (#1)"');

  // Branch B: two commits, squash-merged into one — the hard case
  git('git checkout -q -b feature-multi');
  writeFileSync(join(repoPath, 'multi.txt'), 'first\n');
  git('git add -A && git commit -q -m "feat: part one"');
  multiCommitA = execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim();
  writeFileSync(join(repoPath, 'multi.txt'), 'first\nsecond\n');
  git('git add -A && git commit -q -m "feat: part two"');

  git('git checkout -q main');
  git('git merge -q --squash feature-multi');
  git('git commit -q -m "feat: multi-commit branch (#2)"');
});

afterAll(() => {
  rmSync(repoPath, { recursive: true, force: true });
});

describe('patch-id squash detection', () => {
  it('recovers a single-commit squash that ancestry reports as unmerged', async () => {
    const stream = await collectCommits({ repoPath, detectSquashMerges: true });
    const commit = stream.commits.find((c) => c.hash === squashedCommit);

    expect(commit).toBeDefined();
    // The branch commit is genuinely not an ancestor of main...
    expect(commit!.inDefaultBranchAncestry).toBe(false);
    // ...but its diff matches the squashed commit
    expect(commit!.mergedVia).toBe('patch-id');
  });

  it('does NOT recover commits from a multi-commit squash', async () => {
    const stream = await collectCommits({ repoPath, detectSquashMerges: true });
    const commit = stream.commits.find((c) => c.hash === multiCommitA);

    expect(commit).toBeDefined();
    // The squashed commit contains BOTH commits' changes, so its patch-id
    // matches neither one individually. This is the limit of the approach.
    expect(commit!.mergedVia).toBeNull();
  });

  it('is off by default: no patch-id cost unless asked for', async () => {
    const stream = await collectCommits({ repoPath });
    const commit = stream.commits.find((c) => c.hash === squashedCommit);
    expect(commit!.mergedVia).toBeNull();
  });

  it('computes stable patch ids keyed by commit sha', async () => {
    const ids = await computePatchIds(repoPath, 'main');
    expect(ids.bySha.size).toBeGreaterThan(0);
    for (const [sha, patchId] of ids.bySha) {
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
      expect(patchId).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it('returns null when a sha has no patch (e.g. an empty commit)', async () => {
    const branchIds = await computePatchIds(repoPath, '--all');
    const mainIds = await computePatchIds(repoPath, 'main');
    expect(findSquashMatch('0'.repeat(40), branchIds, mainIds)).toBeNull();
  });
});
