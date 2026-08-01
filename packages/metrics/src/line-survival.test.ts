import { describe, it, expect } from 'vitest';
import { BlameStream, Commit, CommitStream } from '@aida-dev/core';
import { calculateLineSurvival } from './line-survival.js';

function makeCommit(hash: string, tags: Partial<Commit['tags']>, additions = 0): Commit {
  return {
    hash,
    authorName: 'Test',
    authorEmail: 'test@example.com',
    authorDate: '2026-01-01T00:00:00.000Z',
    committerName: 'Test',
    committerEmail: 'test@example.com',
    committerDate: '2026-01-01T00:00:00.000Z',
    message: 'commit',
    parents: [],
    inDefaultBranchAncestry: true,
    tags: {
      ai: false,
      attribution: 'unknown',
      mode: 'unknown',
      modeEvidence: 'none',
      level: 'none',
      sources: [],
      ...tags,
    },
    stats: { totalAdditions: additions, totalDeletions: 0, files: [] },
  };
}

function makeStream(commits: Commit[]): CommitStream {
  return {
    schemaVersion: 1,
    repoPath: '/test',
    defaultBranch: 'main',
    generatedAt: '2026-02-01T00:00:00.000Z',
    aiPatterns: [],
    commits,
  };
}

function makeBlame(linesBySha: Record<string, number>, overrides: Partial<BlameStream> = {}): BlameStream {
  const totalLines = Object.values(linesBySha).reduce((a, b) => a + b, 0);
  return {
    schemaVersion: 1,
    repoPath: '/test',
    generatedAt: '2026-02-01T00:00:00.000Z',
    filesBlamed: 3,
    filesSkipped: 0,
    filesExcluded: 0,
    truncated: false,
    totalLines,
    linesBySha,
    ...overrides,
  };
}

describe('calculateLineSurvival', () => {
  it('attributes surviving lines by cohort and by autonomy mode', () => {
    const result = calculateLineSurvival(
      makeBlame({ a1: 300, h1: 100, b1: 50 }),
      makeStream([
        makeCommit('a1', { ai: true, attribution: 'ai', mode: 'agent', modeEvidence: 'declared' }, 400),
        makeCommit('h1', { attribution: 'human', mode: 'none', modeEvidence: 'declared' }),
        makeCommit('b1', { attribution: 'automated', mode: 'none', modeEvidence: 'inferred' }),
      ])
    );

    expect(result.byAttribution).toEqual({ ai: 300, human: 100, automated: 50, unknown: 0 });
    expect(result.byMode.agent).toBe(300);
    expect(result.byMode.none).toBe(150); // human + automated
    expect(result.aiShare).toBeCloseTo(300 / 450, 4);
  });

  it('reports lines from commits outside the collected window separately', () => {
    const result = calculateLineSurvival(
      makeBlame({ a1: 100, ancient: 900 }),
      makeStream([makeCommit('a1', { ai: true, attribution: 'ai', mode: 'agent' }, 100)])
    );

    expect(result.linesOutsideWindow).toBe(900);
    // Share is computed over attributable lines only, not diluted by them
    expect(result.aiShare).toBe(1);
  });

  it('derives an approximate survival rate against AI additions', () => {
    const result = calculateLineSurvival(
      makeBlame({ a1: 60 }),
      makeStream([makeCommit('a1', { ai: true, attribution: 'ai', mode: 'agent' }, 200)])
    );
    expect(result.introducedByAI).toBe(200);
    expect(result.approxSurvivalRate).toBe(0.3);
  });

  it('caps the approximate rate at 1 when rewrites inflate the denominator', () => {
    // Two AI commits added 10 lines total but 40 survive (other commits'
    // lines were reattributed by later AI edits): the ratio is meaningless
    // above 1, so it is capped rather than reported as 400%.
    const result = calculateLineSurvival(
      makeBlame({ a1: 40 }),
      makeStream([makeCommit('a1', { ai: true, attribution: 'ai', mode: 'agent' }, 10)])
    );
    expect(result.approxSurvivalRate).toBe(1);
  });

  it('handles an empty tree without dividing by zero', () => {
    const result = calculateLineSurvival(makeBlame({}), makeStream([]));
    expect(result.aiShare).toBe(0);
    expect(result.approxSurvivalRate).toBe(0);
    expect(result.totalLines).toBe(0);
  });

  it('carries the truncation flag and file counters through', () => {
    const result = calculateLineSurvival(
      makeBlame({ a1: 10 }, { truncated: true, filesSkipped: 2, filesExcluded: 5 }),
      makeStream([makeCommit('a1', { ai: true, attribution: 'ai', mode: 'agent' }, 10)])
    );
    expect(result.truncated).toBe(true);
    expect(result.filesSkipped).toBe(2);
    expect(result.filesExcluded).toBe(5);
  });
});
