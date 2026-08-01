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
    revertsCommit: null,
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

  it('reports recent-window coverage alongside all-time (#52)', () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const metrics = calculateMetrics(
      makeStream([
        // Old, untagged: drags all-time coverage down forever
        makeCommit({ hash: 'o1', tags: unknownTags, authorDate: old }),
        makeCommit({ hash: 'o2', tags: unknownTags, authorDate: old }),
        makeCommit({ hash: 'o3', tags: unknownTags, authorDate: old }),
        // Recent, tagged: current hygiene is perfect
        makeCommit({ hash: 'r1', tags: aiTags, authorDate: recent }),
      ])
    );

    expect(metrics.attribution.coverage).toBe(0.25); // all-time: bleak
    expect(metrics.attribution.belowThreshold).toBe(true);
    expect(metrics.attribution.recent?.coverage).toBe(1); // recent: perfect
    expect(metrics.attribution.recent?.commitsTotal).toBe(1);
    expect(metrics.attribution.recent?.belowThreshold).toBe(false);
  });

  it('has a null recent block when the window contains no commits', () => {
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const metrics = calculateMetrics(
      makeStream([makeCommit({ hash: 'o1', tags: aiTags, authorDate: old })]),
      { coverageWindowDays: 30 }
    );
    expect(metrics.attribution.recent).toBeNull();
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

describe('fairComparison (#29 age-normalization)', () => {
  it('is null when there is no baseline cohort', () => {
    const metrics = calculateMetrics(makeStream([makeCommit({ hash: 'a1', tags: aiTags })]));
    expect(metrics.fairComparison).toBeNull();
  });

  it('caps both cohorts to the younger cohort average age, unlike the raw comparison', () => {
    // Baseline: old commit whose file was never touched again — accumulates
    // a lot of raw persistence purely from clock time.
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    // AI: recent commit, also never touched again.
    const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const metrics = calculateMetrics({
      ...makeStream([
        makeCommit({
          hash: 'h1',
          tags: humanTags,
          authorDate: oldDate,
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'old.ts', additions: 1, deletions: 0 }] },
        }),
        makeCommit({
          hash: 'a1',
          tags: aiTags,
          authorDate: recentDate,
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'new.ts', additions: 1, deletions: 0 }] },
        }),
      ]),
      // Both commits post-date the fixed '2025-01-01' default: the
      // observation end must be "now" for their persistence to make sense.
      generatedAt: new Date().toISOString(),
    });

    // Raw comparison: baseline looks far more "persistent" just because it's old
    expect(metrics.baseline!.persistence.avgDays).toBeGreaterThan(150);
    expect(metrics.persistence.avgDays).toBeLessThan(15);

    // Fair comparison: both capped to ~10 days (the AI cohort's average age)
    expect(metrics.fairComparison).not.toBeNull();
    expect(metrics.fairComparison!.capDays).toBeCloseTo(10, 0);
    expect(metrics.fairComparison!.ai.avgDays).toBeLessThanOrEqual(10);
    expect(metrics.fairComparison!.baseline.avgDays).toBeLessThanOrEqual(10);
  });
});

describe('byCategory (#36 step 2 within-category comparison)', () => {
  it('is computed even without a baseline cohort', () => {
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

    expect(metrics.byCategory.source.ai?.filesConsidered).toBe(1);
    expect(metrics.byCategory.tests.ai?.filesConsidered).toBe(1);
    expect(metrics.byCategory.source.baseline).toBeNull();
    expect(metrics.byCategory.source.deltaAvgDays).toBeNull();
    expect(metrics.byCategory.migrations.ai).toBeNull(); // no migration files touched
  });

  it('computes a delta only when both sides have files in that category', () => {
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({
          hash: 'a1',
          tags: aiTags,
          authorDate: '2025-01-01T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'src/a.ts', additions: 1, deletions: 0 }] },
        }),
        makeCommit({
          hash: 'a2',
          tags: aiTags,
          authorDate: '2025-01-10T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'src/a.ts', additions: 1, deletions: 0, status: 'modified' }] },
        }),
        makeCommit({
          hash: 'h1',
          tags: humanTags,
          authorDate: '2025-01-01T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'src/b.ts', additions: 1, deletions: 0 }] },
        }),
      ])
    );

    expect(metrics.byCategory.source.ai?.filesConsidered).toBe(1);
    expect(metrics.byCategory.source.baseline?.filesConsidered).toBe(1);
    expect(metrics.byCategory.source.deltaAvgDays).not.toBeNull();
    expect(metrics.byCategory.tests.ai).toBeNull();
    expect(metrics.byCategory.tests.deltaAvgDays).toBeNull();
  });
});

describe('outcomeCorrelation (#26)', () => {
  it('is always present and reflects reverts/hotfixes end to end via calculateMetrics', () => {
    const metrics = calculateMetrics(
      makeStream([
        makeCommit({
          hash: 'a1',
          tags: aiTags,
          authorDate: '2025-01-01T00:00:00.000Z',
          stats: { totalAdditions: 1, totalDeletions: 0, files: [{ path: 'app.ts', additions: 1, deletions: 0 }] },
        }),
        makeCommit({
          hash: 'r1',
          message: 'Revert "feat: a1"',
          authorDate: '2025-01-02T00:00:00.000Z',
          revertsCommit: 'a1',
        }),
      ]),
      { hotfixWindowDays: 7 }
    );

    expect(metrics.outcomeCorrelation.reverts.total).toBe(1);
    expect(metrics.outcomeCorrelation.reverts.resolved).toBe(1);
    expect(metrics.outcomeCorrelation.reverts.byAttribution.ai).toBe(1);
  });

  it('is present (all zero) even for a stream with no reverts or hotfixes', () => {
    const metrics = calculateMetrics(makeStream([makeCommit({ hash: 'a1', tags: aiTags })]));
    expect(metrics.outcomeCorrelation.reverts.total).toBe(0);
    expect(metrics.outcomeCorrelation.hotfixes.total).toBe(0);
  });
});
