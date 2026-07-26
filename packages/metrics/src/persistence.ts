import { Commit, CommitStream, daysBetween } from '@aida-dev/core';
import { Persistence } from './schema/metrics.js';

interface FileLifecycle {
  path: string;
  firstTargetCommitDate: Date;
  lastSeenDate: Date;
  persistenceDays: number;
}

export function calculatePersistence(
  commitStream: CommitStream,
  isTarget: (commit: Commit) => boolean = (commit) => commit.tags.attribution === 'ai'
): Persistence {
  const targetCommits = commitStream.commits.filter(isTarget);

  if (targetCommits.length === 0) {
    return {
      commitsConsidered: 0,
      avgDays: 0,
      medianDays: 0,
      buckets: {
        d0_1: 0,
        d2_7: 0,
        d8_30: 0,
        d31_90: 0,
        d90_plus: 0,
      },
    };
  }

  // Group files by path and track their lifecycle
  const fileLifecycles = new Map<string, FileLifecycle>();

  // Sort commits by date (oldest first)
  const sortedCommits = [...commitStream.commits].sort(
    (a, b) => new Date(a.authorDate).getTime() - new Date(b.authorDate).getTime()
  );

  // Track first target commit per file
  for (const commit of sortedCommits) {
    if (isTarget(commit)) {
      const commitDate = new Date(commit.authorDate);

      for (const file of commit.stats.files) {
        if (!fileLifecycles.has(file.path)) {
          fileLifecycles.set(file.path, {
            path: file.path,
            firstTargetCommitDate: commitDate,
            lastSeenDate: commitDate,
            persistenceDays: 0,
          });
        }
      }
    }
  }

  // Track last seen date for each file
  for (const commit of sortedCommits) {
    const commitDate = new Date(commit.authorDate);

    for (const file of commit.stats.files) {
      const lifecycle = fileLifecycles.get(file.path);
      if (lifecycle) {
        // Update last seen date if file is not deleted
        if (file.status !== 'deleted') {
          lifecycle.lastSeenDate = commitDate;
        }
      }
    }
  }

  // Calculate persistence days for each file
  const persistenceDays: number[] = [];

  for (const lifecycle of fileLifecycles.values()) {
    lifecycle.persistenceDays = daysBetween(lifecycle.firstTargetCommitDate, lifecycle.lastSeenDate);
    persistenceDays.push(lifecycle.persistenceDays);
  }

  // Calculate statistics
  const avgDays =
    persistenceDays.length > 0
      ? persistenceDays.reduce((sum, days) => sum + days, 0) / persistenceDays.length
      : 0;

  const sortedDays = [...persistenceDays].sort((a, b) => a - b);
  const medianDays =
    sortedDays.length > 0
      ? sortedDays.length % 2 === 0
        ? (sortedDays[sortedDays.length / 2 - 1] + sortedDays[sortedDays.length / 2]) / 2
        : sortedDays[Math.floor(sortedDays.length / 2)]
      : 0;

  // Calculate buckets
  const buckets = {
    d0_1: persistenceDays.filter((days) => days <= 1).length,
    d2_7: persistenceDays.filter((days) => days >= 2 && days <= 7).length,
    d8_30: persistenceDays.filter((days) => days >= 8 && days <= 30).length,
    d31_90: persistenceDays.filter((days) => days >= 31 && days <= 90).length,
    d90_plus: persistenceDays.filter((days) => days > 90).length,
  };

  return {
    commitsConsidered: targetCommits.length,
    avgDays: Math.round(avgDays * 100) / 100, // Round to 2 decimal places
    medianDays: Math.round(medianDays * 100) / 100,
    buckets,
  };
}

export function calculateBaselinePersistence(
  commitStream: CommitStream,
  isTarget: (commit: Commit) => boolean = (commit) => commit.tags.attribution === 'human'
): Persistence {
  return calculatePersistence(commitStream, isTarget);
}
