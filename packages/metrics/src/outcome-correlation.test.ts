import { describe, it, expect } from 'vitest';
import { Commit, CommitStream } from '@aida-dev/core';
import { calculateOutcomeCorrelation } from './outcome-correlation.js';

function makeCommit(overrides: Partial<Commit> & { hash: string }): Commit {
  return {
    authorName: 'Test',
    authorEmail: 'test@example.com',
    authorDate: '2025-01-01T00:00:00.000Z',
    committerName: 'Test',
    committerEmail: 'test@example.com',
    committerDate: '2025-01-01T00:00:00.000Z',
    message: 'commit',
    parents: [],
    inDefaultBranchAncestry: true,
    revertsCommit: null,
    tags: { ai: false, attribution: 'unknown', mode: 'unknown', modeEvidence: 'none', level: 'none', sources: [] },
    stats: { totalAdditions: 1, totalDeletions: 0, files: [] },
    ...overrides,
  };
}

function makeStream(commits: Commit[]): CommitStream {
  return {
    schemaVersion: 1,
    repoPath: '/test',
    defaultBranch: 'main',
    generatedAt: '2025-02-01T00:00:00.000Z',
    aiPatterns: [],
    commits,
  };
}

const aiTags: Commit['tags'] = { ai: true, attribution: 'ai', mode: 'agent', modeEvidence: 'inferred', level: 'explicit', sources: [] };
const humanTags: Commit['tags'] = { ai: false, attribution: 'human', mode: 'none', modeEvidence: 'declared', level: 'none', sources: [] };

describe('reverts', () => {
  it('attributes a resolved revert to the reverted commit, not the revert itself', () => {
    const result = calculateOutcomeCorrelation(
      makeStream([
        makeCommit({ hash: 'a1', tags: aiTags }),
        makeCommit({ hash: 'r1', tags: humanTags, revertsCommit: 'a1' }),
      ])
    );
    expect(result.reverts.total).toBe(1);
    expect(result.reverts.resolved).toBe(1);
    expect(result.reverts.byAttribution.ai).toBe(1); // a1's cohort, not r1's
    expect(result.reverts.byMode.agent).toBe(1);
  });

  it('counts an unresolvable revert target without failing', () => {
    const result = calculateOutcomeCorrelation(
      makeStream([makeCommit({ hash: 'r1', revertsCommit: 'not-in-stream' })])
    );
    expect(result.reverts.total).toBe(1);
    expect(result.reverts.resolved).toBe(0);
    expect(result.reverts.byAttribution.ai).toBe(0);
  });

  it('reports zero reverts when none are present', () => {
    const result = calculateOutcomeCorrelation(makeStream([makeCommit({ hash: 'a1' })]));
    expect(result.reverts.total).toBe(0);
    expect(result.reverts.resolved).toBe(0);
  });
});

describe('hotfixes', () => {
  it('links a hotfix to the most recent prior touch of the same file, within the window', () => {
    const result = calculateOutcomeCorrelation(
      makeStream([
        makeCommit({
          hash: 'a1',
          tags: aiTags,
          authorDate: '2025-01-01T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'app.ts', additions: 1, deletions: 0 }] },
        }),
        makeCommit({
          hash: 'f1',
          message: 'fix: null pointer',
          authorDate: '2025-01-03T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'app.ts', additions: 1, deletions: 0, status: 'modified' }] },
        }),
      ]),
      { hotfixWindowDays: 7 }
    );
    expect(result.hotfixes.total).toBe(1);
    expect(result.hotfixes.linked).toBe(1);
    expect(result.hotfixes.byAttribution.ai).toBe(1); // a1's cohort
  });

  it('does not link a hotfix to a touch outside the window', () => {
    const result = calculateOutcomeCorrelation(
      makeStream([
        makeCommit({
          hash: 'a1',
          tags: aiTags,
          authorDate: '2025-01-01T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'app.ts', additions: 1, deletions: 0 }] },
        }),
        makeCommit({
          hash: 'f1',
          message: 'fix: something unrelated by now',
          authorDate: '2025-02-01T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'app.ts', additions: 1, deletions: 0, status: 'modified' }] },
        }),
      ]),
      { hotfixWindowDays: 7 }
    );
    expect(result.hotfixes.total).toBe(1);
    expect(result.hotfixes.linked).toBe(0);
  });

  it('picks the closest antecedent when a hotfix touches multiple files', () => {
    const result = calculateOutcomeCorrelation(
      makeStream([
        makeCommit({
          hash: 'old',
          tags: humanTags,
          authorDate: '2025-01-01T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'a.ts', additions: 1, deletions: 0 }] },
        }),
        makeCommit({
          hash: 'recent',
          tags: aiTags,
          authorDate: '2025-01-05T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'b.ts', additions: 1, deletions: 0 }] },
        }),
        makeCommit({
          hash: 'f1',
          message: 'hotfix: both',
          authorDate: '2025-01-06T00:00:00.000Z',
          stats: {
            totalAdditions: 2,
            totalDeletions: 0,
            files: [
              { path: 'a.ts', additions: 1, deletions: 0, status: 'modified' },
              { path: 'b.ts', additions: 1, deletions: 0, status: 'modified' },
            ],
          },
        }),
      ]),
      { hotfixWindowDays: 30 }
    );
    // b.ts (recent, 1 day gap) is closer than a.ts (old, 5 day gap)
    expect(result.hotfixes.byAttribution.ai).toBe(1);
    expect(result.hotfixes.byAttribution.human).toBe(0);
  });

  it('recognizes conventional-commit fix and hotfix prefixes, ignores unrelated commits', () => {
    const result = calculateOutcomeCorrelation(
      makeStream([
        makeCommit({ hash: 'c1', message: 'fix(auth): token refresh' }),
        makeCommit({ hash: 'c2', message: 'hotfix: rollback bad deploy' }),
        makeCommit({ hash: 'c3', message: 'feat: add dashboard' }),
      ])
    );
    expect(result.hotfixes.total).toBe(2);
  });

  it('lets a chained hotfix attribute to the immediately preceding hotfix', () => {
    const result = calculateOutcomeCorrelation(
      makeStream([
        makeCommit({
          hash: 'a1',
          tags: aiTags,
          authorDate: '2025-01-01T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'app.ts', additions: 1, deletions: 0 }] },
        }),
        makeCommit({
          hash: 'f1',
          tags: humanTags,
          message: 'fix: first attempt',
          authorDate: '2025-01-02T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'app.ts', additions: 1, deletions: 0, status: 'modified' }] },
        }),
        makeCommit({
          hash: 'f2',
          message: 'fix: actually fix it this time',
          authorDate: '2025-01-03T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'app.ts', additions: 1, deletions: 0, status: 'modified' }] },
        }),
      ]),
      { hotfixWindowDays: 7 }
    );
    expect(result.hotfixes.total).toBe(2);
    expect(result.hotfixes.linked).toBe(2);
    // f1 links to a1 (ai); f2 links to f1 (human), not back to a1
    expect(result.hotfixes.byAttribution.ai).toBe(1);
    expect(result.hotfixes.byAttribution.human).toBe(1);
  });

  it('reports zero hotfixes when none are present', () => {
    const result = calculateOutcomeCorrelation(makeStream([makeCommit({ hash: 'a1' })]));
    expect(result.hotfixes.total).toBe(0);
    expect(result.hotfixes.linked).toBe(0);
  });
});
