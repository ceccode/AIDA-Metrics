import { Commit, CommitStream, daysBetween } from '@aida-dev/core';
import { categorizeFile } from './cohort.js';
import { FileCategory, Persistence } from './schema/metrics.js';

// Categories whose lifecycle is governed by convention, not code quality:
// migrations are append-only (never modified once applied), generated files
// (lockfiles, changelogs) churn on every release regardless of author.
// Either way their survival carries no signal, so they are excluded from
// persistence by default. They still appear in the task-mix table.
export const DEFAULT_PERSISTENCE_EXCLUDED_CATEGORIES: FileCategory[] = [
  'migrations',
  'generated',
];

export interface PersistenceOptions {
  excludeCategories?: FileCategory[];
  // End of the observation window, used to measure censored files (never
  // modified again). Defaults to the stream's collection time.
  observationEnd?: Date;
}

interface FileLifecycle {
  firstTargetIndex: number;
  firstTargetDate: Date;
  // Set when a later commit modifies or deletes the file: survival ends
  eventDate: Date | null;
}

// Persistence = survival: days from the first target-cohort touch of a file
// until the FIRST subsequent modification (or deletion) by any commit.
// Files never touched again are censored at the observation end — they
// survived the whole window, which is the best possible outcome, not zero.
export function calculatePersistence(
  commitStream: CommitStream,
  isTarget: (commit: Commit) => boolean = (commit) => commit.tags.attribution === 'ai',
  options: PersistenceOptions = {}
): Persistence {
  const {
    excludeCategories = DEFAULT_PERSISTENCE_EXCLUDED_CATEGORIES,
    observationEnd = new Date(commitStream.generatedAt),
  } = options;
  const excluded = new Set<FileCategory>(excludeCategories);

  const targetCommits = commitStream.commits.filter(isTarget);

  const empty: Persistence = {
    commitsConsidered: targetCommits.length,
    filesConsidered: 0,
    filesExcluded: 0,
    censored: 0,
    avgDays: 0,
    medianDays: 0,
    buckets: { d0_1: 0, d2_7: 0, d8_30: 0, d31_90: 0, d90_plus: 0 },
  };

  if (targetCommits.length === 0) {
    return { ...empty, commitsConsidered: 0 };
  }

  // Sort commits by date (oldest first)
  const sortedCommits = [...commitStream.commits].sort(
    (a, b) => new Date(a.authorDate).getTime() - new Date(b.authorDate).getTime()
  );

  // First target-cohort touch per file
  const lifecycles = new Map<string, FileLifecycle>();
  let filesExcluded = 0;
  sortedCommits.forEach((commit, index) => {
    if (!isTarget(commit)) return;
    for (const file of commit.stats.files) {
      if (lifecycles.has(file.path)) continue;
      if (excluded.has(categorizeFile(file.path))) {
        filesExcluded++;
        lifecycles.set(file.path, { firstTargetIndex: -1, firstTargetDate: new Date(0), eventDate: null });
        continue;
      }
      lifecycles.set(file.path, {
        firstTargetIndex: index,
        firstTargetDate: new Date(commit.authorDate),
        eventDate: null,
      });
    }
  });

  // First subsequent modification (or deletion) ends the survival clock
  sortedCommits.forEach((commit, index) => {
    for (const file of commit.stats.files) {
      const lifecycle = lifecycles.get(file.path);
      if (!lifecycle || lifecycle.firstTargetIndex < 0) continue; // excluded category
      if (index <= lifecycle.firstTargetIndex) continue; // not later than first touch
      if (lifecycle.eventDate === null) {
        lifecycle.eventDate = new Date(commit.authorDate);
      }
    }
  });

  const survivalDays: number[] = [];
  let censored = 0;
  for (const lifecycle of lifecycles.values()) {
    if (lifecycle.firstTargetIndex < 0) continue; // excluded category
    if (lifecycle.eventDate) {
      survivalDays.push(daysBetween(lifecycle.firstTargetDate, lifecycle.eventDate));
    } else {
      // Never modified again: survived to the end of the observation window
      censored++;
      survivalDays.push(Math.max(0, daysBetween(lifecycle.firstTargetDate, observationEnd)));
    }
  }

  if (survivalDays.length === 0) {
    return { ...empty, filesExcluded };
  }

  const avgDays = survivalDays.reduce((sum, days) => sum + days, 0) / survivalDays.length;
  const sortedDays = [...survivalDays].sort((a, b) => a - b);
  const medianDays =
    sortedDays.length % 2 === 0
      ? (sortedDays[sortedDays.length / 2 - 1] + sortedDays[sortedDays.length / 2]) / 2
      : sortedDays[Math.floor(sortedDays.length / 2)];

  return {
    commitsConsidered: targetCommits.length,
    filesConsidered: survivalDays.length,
    filesExcluded,
    censored,
    avgDays: Math.round(avgDays * 100) / 100,
    medianDays: Math.round(medianDays * 100) / 100,
    buckets: {
      d0_1: survivalDays.filter((days) => days <= 1).length,
      d2_7: survivalDays.filter((days) => days >= 2 && days <= 7).length,
      d8_30: survivalDays.filter((days) => days >= 8 && days <= 30).length,
      d31_90: survivalDays.filter((days) => days >= 31 && days <= 90).length,
      d90_plus: survivalDays.filter((days) => days > 90).length,
    },
  };
}

export function calculateBaselinePersistence(
  commitStream: CommitStream,
  isTarget: (commit: Commit) => boolean = (commit) => commit.tags.attribution === 'human',
  options: PersistenceOptions = {}
): Persistence {
  return calculatePersistence(commitStream, isTarget, options);
}
