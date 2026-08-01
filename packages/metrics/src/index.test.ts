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
    mergedVia: 'ancestry',
    tags: { ai: false, attribution: 'unknown', mode: 'unknown', modeEvidence: 'none', level: 'none', sources: [] },
    stats: { totalAdditions: 1, totalDeletions: 0, files: [] },
    ...overrides,
  };
}

function makeStream(commits: Commit[]): CommitStream {
  return {
    schemaVersion: 1,
    repoPath: '/test/repo',
    defaultBranch: 'main',
    generatedAt: '2025-01-01T00:00:00.000Z',
    aiPatterns: [],
    commits,
  };
}

const aiTags: Commit['tags'] = { ai: true, attribution: 'ai', mode: 'agent', modeEvidence: 'inferred', level: 'explicit', sources: ['tag:[ai]'] };
const humanTags: Commit['tags'] = { ai: false, attribution: 'human', mode: 'none', modeEvidence: 'declared', level: 'none', sources: [] };
const unknownTags: Commit['tags'] = { ai: false, attribution: 'unknown', mode: 'unknown', modeEvidence: 'none', level: 'none', sources: [] };

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

  it('counts automated commits toward coverage — their provenance is known', () => {
    const automatedTags: Commit['tags'] = {
      ai: false,
      attribution: 'automated',
      mode: 'none',
      modeEvidence: 'inferred',
      level: 'none',
      sources: ['automated:bot'],
    };
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({ hash: 'a1', tags: aiTags }),
        makeCommit({ hash: 'b1', tags: automatedTags }),
        makeCommit({ hash: 'b2', tags: automatedTags }),
        makeCommit({ hash: 'u1', tags: unknownTags }),
      ])
    );

    expect(metrics.attribution.automated).toBe(2);
    expect(metrics.attribution.coverage).toBe(0.75); // (1 ai + 0 human + 2 automated) / 4
    // automated joins no cohort
    expect(metrics.persistence.commitsConsidered).toBe(1);
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
    expect(metrics.baseline!.persistence.commitsConsidered).toBe(2); // unknown excluded
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
    expect(metrics.baseline!.persistence.commitsConsidered).toBe(2);
    // Coverage still reports the truth: unknown commits stay unknown
    expect(metrics.attribution.unknown).toBe(2);
    expect(metrics.attribution.coverage).toBeCloseTo(1 / 3);
    expect(metrics.caveats.some((c) => c.includes('assumed human'))).toBe(true);
  });

  it('never assigns automated commits to a cohort, even with a prior', () => {
    const excludedTags: Commit['tags'] = {
      ai: false,
      attribution: 'automated',
      mode: 'none',
      modeEvidence: 'declared',
      level: 'none',
      sources: ['manifest:excluded'],
    };
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({ hash: 'a1', tags: aiTags }),
        makeCommit({ hash: 'x1', tags: excludedTags }),
        makeCommit({ hash: 'u1', tags: unknownTags }),
      ]),
      { defaultAttribution: 'ai' }
    );

    // prior pulls u1 into the AI cohort, but never x1
    expect(metrics.persistence.commitsConsidered).toBe(2);
  });

  it('reports cohort age and task mix per cohort, null when a cohort is empty', () => {
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({
          hash: 'a1',
          tags: aiTags,
          stats: {
            totalAdditions: 2,
            totalDeletions: 0,
            files: [
              { path: 'src/a.ts', additions: 1, deletions: 0 },
              { path: 'src/a.test.ts', additions: 1, deletions: 0 },
            ],
          },
        }),
      ])
    );

    expect(metrics.cohorts.ai.age?.commits).toBe(1);
    expect(metrics.cohorts.ai.age?.avgAgeDays).toBeGreaterThan(0);
    expect(metrics.cohorts.ai.taskMix?.source).toBe(1);
    expect(metrics.cohorts.ai.taskMix?.tests).toBe(1);
    expect(metrics.cohorts.baseline.age).toBeNull();
    expect(metrics.cohorts.baseline.taskMix).toBeNull();
  });

  it('computes per-mode stats, excluding automated commits, null for empty modes', () => {
    const assistedTags: Commit['tags'] = {
      ai: true,
      attribution: 'ai',
      mode: 'assisted',
      modeEvidence: 'inferred',
      level: 'implicit',
      sources: ['implicit:x'],
    };
    const automatedTags: Commit['tags'] = {
      ai: false,
      attribution: 'automated',
      mode: 'none',
      modeEvidence: 'inferred',
      level: 'none',
      sources: ['automated:bot'],
    };
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({ hash: 'a1', tags: aiTags }), // agent
        makeCommit({ hash: 'a2', tags: aiTags, inDefaultBranchAncestry: false }), // agent, unmerged
        makeCommit({ hash: 's1', tags: assistedTags }),
        makeCommit({ hash: 'b1', tags: automatedTags }), // mode none, but automated → excluded
      ])
    );

    expect(metrics.byMode.agent?.commits).toBe(2);
    expect(metrics.byMode.assisted?.commits).toBe(1);
    expect(metrics.byMode.none).toBeNull(); // the automated commit doesn't count
    expect(metrics.byMode.autocomplete).toBeNull();
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

    expect(metrics.persistence.commitsConsidered).toBe(2); // ai + unknown
    expect(metrics.baseline!.persistence.commitsConsidered).toBe(1); // human only
    expect(metrics.baseline!.assumed).toBe(false);
  });
});
