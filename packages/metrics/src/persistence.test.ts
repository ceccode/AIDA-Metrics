import { describe, it, expect } from 'vitest';
import { calculatePersistence } from './persistence.js';
import type { CommitStream } from '@aida-dev/core';

function makeCommit(overrides: Partial<CommitStream['commits'][0]>): CommitStream['commits'][0] {
  return {
    hash: 'abc123',
    authorName: 'Test',
    authorEmail: 'test@test.com',
    authorDate: '2024-01-01T00:00:00.000Z',
    committerName: 'Test',
    committerEmail: 'test@test.com',
    committerDate: '2024-01-01T00:00:00.000Z',
    message: 'test commit',
    parents: [],
    inDefaultBranchAncestry: true,
    tags: { ai: false, level: 'none', sources: [] },
    stats: { totalAdditions: 10, totalDeletions: 0, files: [] },
    ...overrides,
  };
}

function makeStream(commits: CommitStream['commits']): CommitStream {
  return {
    repoPath: '/test',
    defaultBranch: 'main',
    generatedAt: '2024-06-01T00:00:00.000Z',
    aiPatterns: [],
    commits,
  };
}

describe('calculatePersistence', () => {
  it('returns zeros when no AI commits', () => {
    const stream = makeStream([makeCommit({})]);
    const result = calculatePersistence(stream);
    expect(result.commitsConsidered).toBe(0);
    expect(result.avgDays).toBe(0);
    expect(result.medianDays).toBe(0);
  });

  it('counts AI commits correctly', () => {
    const stream = makeStream([
      makeCommit({
        hash: 'a1',
        tags: { ai: true, level: 'explicit', sources: ['tag:[ai]'] },
        stats: { totalAdditions: 5, totalDeletions: 0, files: [{ path: 'foo.ts', additions: 5, deletions: 0 }] },
      }),
      makeCommit({
        hash: 'a2',
        tags: { ai: false, level: 'none', sources: [] },
      }),
    ]);
    const result = calculatePersistence(stream);
    expect(result.commitsConsidered).toBe(1);
  });

  it('calculates persistence for files touched by AI then seen later', () => {
    const stream = makeStream([
      makeCommit({
        hash: 'a1',
        authorDate: '2024-01-01T00:00:00.000Z',
        tags: { ai: true, level: 'explicit', sources: ['tag:[ai]'] },
        stats: {
          totalAdditions: 5,
          totalDeletions: 0,
          files: [{ path: 'foo.ts', additions: 5, deletions: 0 }],
        },
      }),
      makeCommit({
        hash: 'a2',
        authorDate: '2024-01-11T00:00:00.000Z',
        tags: { ai: false, level: 'none', sources: [] },
        stats: {
          totalAdditions: 2,
          totalDeletions: 1,
          files: [{ path: 'foo.ts', additions: 2, deletions: 1, status: 'modified' }],
        },
      }),
    ]);
    const result = calculatePersistence(stream);
    expect(result.commitsConsidered).toBe(1);
    expect(result.avgDays).toBe(10);
    expect(result.medianDays).toBe(10);
  });

  it('buckets persistence correctly', () => {
    const stream = makeStream([
      // AI commit touching file A (0 days persistence — only seen once)
      makeCommit({
        hash: 'a1',
        authorDate: '2024-01-01T00:00:00.000Z',
        tags: { ai: true, level: 'explicit', sources: ['tag:[ai]'] },
        stats: {
          totalAdditions: 5,
          totalDeletions: 0,
          files: [{ path: 'a.ts', additions: 5, deletions: 0 }],
        },
      }),
      // AI commit touching file B
      makeCommit({
        hash: 'a2',
        authorDate: '2024-01-01T00:00:00.000Z',
        tags: { ai: true, level: 'explicit', sources: ['tag:[ai]'] },
        stats: {
          totalAdditions: 5,
          totalDeletions: 0,
          files: [{ path: 'b.ts', additions: 5, deletions: 0 }],
        },
      }),
      // Non-AI commit touching file B 5 days later
      makeCommit({
        hash: 'a3',
        authorDate: '2024-01-06T00:00:00.000Z',
        tags: { ai: false, level: 'none', sources: [] },
        stats: {
          totalAdditions: 2,
          totalDeletions: 0,
          files: [{ path: 'b.ts', additions: 2, deletions: 0, status: 'modified' }],
        },
      }),
    ]);
    const result = calculatePersistence(stream);
    // a.ts: 0 days, b.ts: 5 days
    expect(result.buckets.d0_1).toBe(1);  // a.ts
    expect(result.buckets.d2_7).toBe(1);  // b.ts
  });

  it('handles deleted files by not extending persistence', () => {
    const stream = makeStream([
      makeCommit({
        hash: 'a1',
        authorDate: '2024-01-01T00:00:00.000Z',
        tags: { ai: true, level: 'explicit', sources: ['tag:[ai]'] },
        stats: {
          totalAdditions: 5,
          totalDeletions: 0,
          files: [{ path: 'temp.ts', additions: 5, deletions: 0 }],
        },
      }),
      makeCommit({
        hash: 'a2',
        authorDate: '2024-01-20T00:00:00.000Z',
        tags: { ai: false, level: 'none', sources: [] },
        stats: {
          totalAdditions: 0,
          totalDeletions: 5,
          files: [{ path: 'temp.ts', additions: 0, deletions: 5, status: 'deleted' }],
        },
      }),
    ]);
    const result = calculatePersistence(stream);
    // File was deleted, so persistence should be 0 days (only the first AI commit date)
    expect(result.avgDays).toBe(0);
  });
});
