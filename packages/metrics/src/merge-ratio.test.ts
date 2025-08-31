import { describe, it, expect } from 'vitest';
import { calculateMergeRatio } from './merge-ratio.js';
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
          tags: { ai: true, sources: ['message_pattern'] },
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
          tags: { ai: false, sources: [] },
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
