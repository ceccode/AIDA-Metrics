import { describe, it, expect } from 'vitest';
import { calculateBaselineMergeRatio, calculateMergeRatio } from './merge-ratio.js';
import { CommitStream } from '@aida-dev/core';

describe('Merge Ratio Calculation', () => {
  it('should calculate merge ratio correctly', () => {
    const mockCommitStream: CommitStream = {
      repoPath: '/test/repo',
      defaultBranch: 'main',
      generatedAt: '2025-01-01T00:00:00.000Z',
      aiPatterns: [],
      commits: [
        {
          hash: 'abc123',
          authorName: 'Test User',
          authorEmail: 'test@example.com',
          authorDate: '2025-01-01T00:00:00.000Z',
          committerName: 'Test User',
          committerEmail: 'test@example.com',
          committerDate: '2025-01-01T00:00:00.000Z',
          message: 'AI: automated commit',
          parents: [],
          inDefaultBranchAncestry: true,
          tags: { ai: true, level: 'explicit' as const, sources: ['trailer:AI: true'] },
          stats: { totalAdditions: 10, totalDeletions: 5, files: [] },
        },
        {
          hash: 'def456',
          authorName: 'Test User',
          authorEmail: 'test@example.com',
          authorDate: '2025-01-01T01:00:00.000Z',
          committerName: 'Test User',
          committerEmail: 'test@example.com',
          committerDate: '2025-01-01T01:00:00.000Z',
          message: 'regular commit',
          parents: [],
          inDefaultBranchAncestry: true,
          tags: { ai: false, level: 'none' as const, sources: [] },
          stats: { totalAdditions: 5, totalDeletions: 2, files: [] },
        },
      ],
    };

    const result = calculateMergeRatio(mockCommitStream);

    expect(result.aiCommitsTotal).toBe(1);
    expect(result.aiCommitsMerged).toBe(1);
    expect(result.mergeRatio).toBe(1.0);
  });

  it('should handle empty commit stream', () => {
    const mockCommitStream: CommitStream = {
      repoPath: '/test/repo',
      defaultBranch: 'main',
      generatedAt: '2025-01-01T00:00:00.000Z',
      aiPatterns: [],
      commits: [],
    };

    const result = calculateMergeRatio(mockCommitStream);

    expect(result.aiCommitsTotal).toBe(0);
    expect(result.aiCommitsMerged).toBe(0);
    expect(result.mergeRatio).toBe(0);
  });
});

describe('Baseline Merge Ratio Calculation', () => {
  const baseCommit = {
    authorName: 'Test User',
    authorEmail: 'test@example.com',
    authorDate: '2025-01-01T00:00:00.000Z',
    committerName: 'Test User',
    committerEmail: 'test@example.com',
    committerDate: '2025-01-01T00:00:00.000Z',
    parents: [],
    stats: { totalAdditions: 1, totalDeletions: 0, files: [] },
  };

  it('should calculate baseline merge ratio over non-AI commits only', () => {
    const mockCommitStream: CommitStream = {
      repoPath: '/test/repo',
      defaultBranch: 'main',
      generatedAt: '2025-01-01T00:00:00.000Z',
      aiPatterns: [],
      commits: [
        {
          ...baseCommit,
          hash: 'ai1',
          message: 'AI: automated commit',
          inDefaultBranchAncestry: true,
          tags: { ai: true, level: 'explicit' as const, sources: ['trailer:AI: true'] },
        },
        {
          ...baseCommit,
          hash: 'human1',
          message: 'regular commit merged',
          inDefaultBranchAncestry: true,
          tags: { ai: false, level: 'none' as const, sources: [] },
        },
        {
          ...baseCommit,
          hash: 'human2',
          message: 'regular commit unmerged',
          inDefaultBranchAncestry: false,
          tags: { ai: false, level: 'none' as const, sources: [] },
        },
      ],
    };

    const result = calculateBaselineMergeRatio(mockCommitStream);

    expect(result.commitsTotal).toBe(2);
    expect(result.commitsMerged).toBe(1);
    expect(result.mergeRatio).toBe(0.5);
  });

  it('should handle stream with only AI commits', () => {
    const mockCommitStream: CommitStream = {
      repoPath: '/test/repo',
      defaultBranch: 'main',
      generatedAt: '2025-01-01T00:00:00.000Z',
      aiPatterns: [],
      commits: [
        {
          ...baseCommit,
          hash: 'ai1',
          message: 'AI: automated commit',
          inDefaultBranchAncestry: true,
          tags: { ai: true, level: 'explicit' as const, sources: ['trailer:AI: true'] },
        },
      ],
    };

    const result = calculateBaselineMergeRatio(mockCommitStream);

    expect(result.commitsTotal).toBe(0);
    expect(result.commitsMerged).toBe(0);
    expect(result.mergeRatio).toBe(0);
  });
});
