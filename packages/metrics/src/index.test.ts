import { describe, it, expect } from 'vitest';
import { calculateMetrics } from './index.js';
import { Commit, CommitStream } from '@aida-dev/core';

function makeCommit(overrides: Partial<Commit> & { hash: string }): Commit {
  return {
    authorName: 'Test User',
    authorEmail: 'test@example.com',
    authorDate: '2025-01-01T00:00:00.000Z',
    committerName: 'Test User',
    committerEmail: 'test@example.com',
    committerDate: '2025-01-01T00:00:00.000Z',
    message: 'commit',
    parents: [],
    inDefaultBranchAncestry: true,
    tags: { ai: false, attribution: 'unknown', level: 'none', sources: [] },
    stats: { totalAdditions: 1, totalDeletions: 0, files: [] },
    ...overrides,
  };
}

function makeStream(commits: Commit[]): CommitStream {
  return {
    repoPath: '/test/repo',
    defaultBranch: 'main',
    generatedAt: '2025-01-01T00:00:00.000Z',
    aiPatterns: [],
    commits,
  };
}

const aiTags = { ai: true, attribution: 'ai', level: 'explicit', sources: ['tag:[ai]'] } as const;
const humanTags = { ai: false, attribution: 'human', level: 'none', sources: [] } as const;
const unknownTags = { ai: false, attribution: 'unknown', level: 'none', sources: [] } as const;

describe('calculateMetrics attribution coverage', () => {
  it('reports coverage as (ai + human) / total', () => {
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({ hash: 'a1', tags: aiTags }),
        makeCommit({ hash: 'h1', tags: humanTags }),
        makeCommit({ hash: 'u1', tags: unknownTags }),
        makeCommit({ hash: 'u2', tags: unknownTags }),
      ])
    );

    expect(metrics.attribution.commitsTotal).toBe(4);
    expect(metrics.attribution.ai).toBe(1);
    expect(metrics.attribution.human).toBe(1);
    expect(metrics.attribution.unknown).toBe(2);
    expect(metrics.attribution.coverage).toBe(0.5);
    expect(metrics.attribution.belowThreshold).toBe(true); // default threshold 0.7
  });

  it('flags belowThreshold using a custom coverageThreshold', () => {
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({ hash: 'a1', tags: aiTags }),
        makeCommit({ hash: 'u1', tags: unknownTags }),
      ]),
      { coverageThreshold: 0.4 }
    );

    expect(metrics.attribution.coverage).toBe(0.5);
    expect(metrics.attribution.belowThreshold).toBe(false);
  });

  it('handles an empty stream', () => {
    const metrics = calculateMetrics(makeStream([]));
    expect(metrics.attribution.coverage).toBe(0);
    expect(metrics.baseline).toBeNull();
    expect(metrics.delta).toBeNull();
  });
});

describe('calculateMetrics baseline cohort', () => {
  it('returns null baseline and delta when no commits are attributed human', () => {
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({ hash: 'a1', tags: aiTags }),
        makeCommit({ hash: 'u1', tags: unknownTags }),
      ])
    );

    expect(metrics.baseline).toBeNull();
    expect(metrics.delta).toBeNull();
    expect(metrics.caveats.some((c) => c.includes('No baseline'))).toBe(true);
  });

  it('builds the baseline from explicitly human-attributed commits', () => {
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({ hash: 'a1', tags: aiTags }),
        makeCommit({ hash: 'h1', tags: humanTags }),
        makeCommit({ hash: 'h2', tags: humanTags, inDefaultBranchAncestry: false }),
        makeCommit({ hash: 'u1', tags: unknownTags }),
      ])
    );

    expect(metrics.baseline).not.toBeNull();
    expect(metrics.baseline!.assumed).toBe(false);
    expect(metrics.baseline!.mergeRatio.commitsTotal).toBe(2); // unknown excluded
    expect(metrics.baseline!.mergeRatio.mergeRatio).toBe(0.5);
    expect(metrics.delta).not.toBeNull();
  });

  it('assigns unknown commits to the baseline with defaultAttribution: human, marked assumed', () => {
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({ hash: 'a1', tags: aiTags }),
        makeCommit({ hash: 'u1', tags: unknownTags }),
        makeCommit({ hash: 'u2', tags: unknownTags }),
      ]),
      { defaultAttribution: 'human' }
    );

    expect(metrics.baseline).not.toBeNull();
    expect(metrics.baseline!.assumed).toBe(true);
    expect(metrics.baseline!.mergeRatio.commitsTotal).toBe(2);
    // Coverage still reports the truth: unknown commits stay unknown
    expect(metrics.attribution.unknown).toBe(2);
    expect(metrics.attribution.coverage).toBeCloseTo(1 / 3);
    expect(metrics.caveats.some((c) => c.includes('assumed human'))).toBe(true);
  });

  it('assigns unknown commits to the AI cohort with defaultAttribution: ai', () => {
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({ hash: 'a1', tags: aiTags }),
        makeCommit({ hash: 'h1', tags: humanTags }),
        makeCommit({ hash: 'u1', tags: unknownTags }),
      ]),
      { defaultAttribution: 'ai' }
    );

    expect(metrics.mergeRatio.aiCommitsTotal).toBe(2); // ai + unknown
    expect(metrics.baseline!.mergeRatio.commitsTotal).toBe(1); // human only
    expect(metrics.baseline!.assumed).toBe(false);
  });
});
