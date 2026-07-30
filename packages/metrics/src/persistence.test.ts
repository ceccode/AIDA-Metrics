import { describe, it, expect } from 'vitest';
import { calculateBaselinePersistence, calculatePersistence } from './persistence.js';
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
    tags: { ai: false, attribution: 'unknown' as const, mode: 'unknown' as const, modeEvidence: 'none' as const, level: 'none', sources: [] },
    stats: { totalAdditions: 10, totalDeletions: 0, files: [] },
    ...overrides,
  };
}

function makeStream(commits: CommitStream['commits']): CommitStream {
  return {
    schemaVersion: 1,
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
        tags: { ai: true, attribution: 'ai' as const, mode: 'agent' as const, modeEvidence: 'inferred' as const, level: 'explicit', sources: ['tag:[ai]'] },
        stats: { totalAdditions: 5, totalDeletions: 0, files: [{ path: 'foo.ts', additions: 5, deletions: 0 }] },
      }),
      makeCommit({
        hash: 'a2',
        tags: { ai: false, attribution: 'unknown' as const, mode: 'unknown' as const, modeEvidence: 'none' as const, level: 'none', sources: [] },
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
        tags: { ai: true, attribution: 'ai' as const, mode: 'agent' as const, modeEvidence: 'inferred' as const, level: 'explicit', sources: ['tag:[ai]'] },
        stats: {
          totalAdditions: 5,
          totalDeletions: 0,
          files: [{ path: 'foo.ts', additions: 5, deletions: 0 }],
        },
      }),
      makeCommit({
        hash: 'a2',
        authorDate: '2024-01-11T00:00:00.000Z',
        tags: { ai: false, attribution: 'unknown' as const, mode: 'unknown' as const, modeEvidence: 'none' as const, level: 'none', sources: [] },
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
        tags: { ai: true, attribution: 'ai' as const, mode: 'agent' as const, modeEvidence: 'inferred' as const, level: 'explicit', sources: ['tag:[ai]'] },
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
        tags: { ai: true, attribution: 'ai' as const, mode: 'agent' as const, modeEvidence: 'inferred' as const, level: 'explicit', sources: ['tag:[ai]'] },
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
        tags: { ai: false, attribution: 'unknown' as const, mode: 'unknown' as const, modeEvidence: 'none' as const, level: 'none', sources: [] },
        stats: {
          totalAdditions: 2,
          totalDeletions: 0,
          files: [{ path: 'b.ts', additions: 2, deletions: 0, status: 'modified' }],
        },
      }),
    ]);
    const result = calculatePersistence(stream);
    // b.ts: modified after 5 days → event, d2_7
    // a.ts: never touched again → censored at stream end (2024-06-01, 152d) → d90_plus
    expect(result.buckets.d2_7).toBe(1); // b.ts
    expect(result.buckets.d90_plus).toBe(1); // a.ts, censored
    expect(result.censored).toBe(1);
    expect(result.filesConsidered).toBe(2);
  });

  it('censors files never modified again at the observation end, not zero', () => {
    const stream = makeStream([
      makeCommit({
        hash: 'a1',
        authorDate: '2024-01-01T00:00:00.000Z',
        tags: { ai: true, attribution: 'ai' as const, mode: 'agent' as const, modeEvidence: 'inferred' as const, level: 'explicit', sources: ['tag:[ai]'] },
        stats: {
          totalAdditions: 5,
          totalDeletions: 0,
          files: [{ path: 'stable.ts', additions: 5, deletions: 0 }],
        },
      }),
    ]);
    const result = calculatePersistence(stream);
    // stream generatedAt is 2024-06-01 → survived 152 days, the best outcome
    expect(result.avgDays).toBe(152);
    expect(result.censored).toBe(1);
  });

  it('ends the survival clock at the first subsequent touch, same cohort included', () => {
    const aiTags: CommitStream['commits'][0]['tags'] = { ai: true, attribution: 'ai', mode: 'agent', modeEvidence: 'inferred', level: 'explicit', sources: ['tag:[ai]'] };
    const stream = makeStream([
      makeCommit({
        hash: 'a1',
        authorDate: '2024-01-01T00:00:00.000Z',
        tags: aiTags,
        stats: { totalAdditions: 5, totalDeletions: 0, files: [{ path: 'foo.ts', additions: 5, deletions: 0 }] },
      }),
      makeCommit({
        hash: 'a2',
        authorDate: '2024-01-03T00:00:00.000Z',
        tags: aiTags,
        stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'foo.ts', additions: 1, deletions: 0, status: 'modified' }] },
      }),
      makeCommit({
        hash: 'a3',
        authorDate: '2024-01-30T00:00:00.000Z',
        tags: aiTags,
        stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'foo.ts', additions: 1, deletions: 0, status: 'modified' }] },
      }),
    ]);
    const result = calculatePersistence(stream);
    // survival ends at the FIRST subsequent touch (2 days), not the last (29)
    expect(result.avgDays).toBe(2);
  });

  it('excludes migrations and generated files from persistence by default', () => {
    const stream = makeStream([
      makeCommit({
        hash: 'a1',
        authorDate: '2024-01-01T00:00:00.000Z',
        tags: { ai: true, attribution: 'ai' as const, mode: 'agent' as const, modeEvidence: 'inferred' as const, level: 'explicit', sources: ['tag:[ai]'] },
        stats: {
          totalAdditions: 3,
          totalDeletions: 0,
          files: [
            { path: 'db/migrations/001_init.sql', additions: 1, deletions: 0 },
            { path: 'pnpm-lock.yaml', additions: 1, deletions: 0 },
            { path: 'src/app.ts', additions: 1, deletions: 0 },
          ],
        },
      }),
    ]);
    const result = calculatePersistence(stream);
    expect(result.filesConsidered).toBe(1); // src/app.ts only
    expect(result.filesExcluded).toBe(2);
  });

  it('handles deleted files by not extending persistence', () => {
    const stream = makeStream([
      makeCommit({
        hash: 'a1',
        authorDate: '2024-01-01T00:00:00.000Z',
        tags: { ai: true, attribution: 'ai' as const, mode: 'agent' as const, modeEvidence: 'inferred' as const, level: 'explicit', sources: ['tag:[ai]'] },
        stats: {
          totalAdditions: 5,
          totalDeletions: 0,
          files: [{ path: 'temp.ts', additions: 5, deletions: 0 }],
        },
      }),
      makeCommit({
        hash: 'a2',
        authorDate: '2024-01-20T00:00:00.000Z',
        tags: { ai: false, attribution: 'unknown' as const, mode: 'unknown' as const, modeEvidence: 'none' as const, level: 'none', sources: [] },
        stats: {
          totalAdditions: 0,
          totalDeletions: 5,
          files: [{ path: 'temp.ts', additions: 0, deletions: 5, status: 'deleted' }],
        },
      }),
    ]);
    const result = calculatePersistence(stream);
    // Deletion is the first subsequent event: the file survived 19 days
    expect(result.avgDays).toBe(19);
    expect(result.censored).toBe(0);
  });
});

describe('calculateBaselinePersistence', () => {
  it('measures persistence over human-attributed commits only, ignoring AI commits', () => {
    const stream = makeStream([
      makeCommit({
        hash: 'h1',
        authorDate: '2024-01-01T00:00:00.000Z',
        tags: { ai: false, attribution: 'human' as const, mode: 'none' as const, modeEvidence: 'declared' as const, level: 'none', sources: [] },
        stats: { totalAdditions: 5, totalDeletions: 0, files: [{ path: 'foo.ts', additions: 5, deletions: 0 }] },
      }),
      makeCommit({
        hash: 'ai1',
        authorDate: '2024-01-06T00:00:00.000Z',
        tags: { ai: true, attribution: 'ai' as const, mode: 'agent' as const, modeEvidence: 'inferred' as const, level: 'explicit', sources: ['tag:[ai]'] },
        stats: { totalAdditions: 2, totalDeletions: 0, files: [{ path: 'foo.ts', additions: 2, deletions: 0, status: 'modified' }] },
      }),
    ]);
    const result = calculateBaselinePersistence(stream);
    // 1 non-AI commit; foo.ts first seen at h1 (Jan 1), last seen at ai1 (Jan 6) → 5 days
    expect(result.commitsConsidered).toBe(1);
    expect(result.avgDays).toBe(5);
  });

  it('returns zeros when there are no human-attributed commits', () => {
    const stream = makeStream([
      makeCommit({
        hash: 'ai1',
        tags: { ai: true, attribution: 'ai' as const, mode: 'agent' as const, modeEvidence: 'inferred' as const, level: 'explicit', sources: ['tag:[ai]'] },
        stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'x.ts', additions: 1, deletions: 0 }] },
      }),
    ]);
    const result = calculateBaselinePersistence(stream);
    expect(result.commitsConsidered).toBe(0);
    expect(result.avgDays).toBe(0);
  });
});
