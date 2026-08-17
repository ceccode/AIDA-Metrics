import { SimpleGit } from 'simple-git';
import { FileChange } from '../schema/commit.js';
import type { z } from 'zod';

type FileChangeType = z.infer<typeof FileChange>;

export interface RawCommit {
  hash: string;
  authorName: string;
  authorEmail: string;
  authorDate: string; // ISO 8601 (%aI)
  committerName: string;
  committerEmail: string;
  committerDate: string; // ISO 8601 (%cI)
  parents: string[];
  message: string; // full message: subject + body (%B)
  stats: {
    totalAdditions: number;
    totalDeletions: number;
    files: FileChangeType[];
  };
}

// Record separator / field separator (ASCII control chars, cannot appear in
// normal commit metadata) so multi-line messages parse unambiguously.
const RS = '\x1e';
const FS = '\x1f';
const LOG_FORMAT = `${RS}%H${FS}%an${FS}%ae${FS}%aI${FS}%cn${FS}%ce${FS}%cI${FS}%P${FS}%B${FS}`;

const NUMSTAT_LINE = /^(\d+|-)\t(\d+|-)\t(.+)$/;
const NAME_STATUS_LINE = /^([A-Z])\S*\t(.+)$/;

function parseStatus(code: string): FileChangeType['status'] {
  switch (code) {
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    default:
      return 'modified';
  }
}

/**
 * Fetch commits with metadata and diff stats in two batched `git log` passes
 * (one with --numstat, one with --name-status — git ignores --numstat when
 * both are combined), instead of spawning one git process per commit.
 *
 * `rangeArgs` selects the commits (e.g. `['--all', '--after=...']` or
 * `['base..HEAD']`) and must be identical for both passes.
 */
export async function logWithStats(git: SimpleGit, rangeArgs: string[]): Promise<RawCommit[]> {
  const [numstatRaw, nameStatusRaw] = await Promise.all([
    // Newest-first topological order is part of the stream contract. Metrics
    // reverse this array to define "subsequent"; author timestamps can move
    // backwards after a rebase and must not reorder history.
    git.raw(['log', '--topo-order', `--format=${LOG_FORMAT}`, '--numstat', ...rangeArgs]),
    git.raw(['log', '--topo-order', `--format=${RS}%H`, '--name-status', ...rangeArgs]),
  ]);

  // hash -> path -> status
  const statusByCommit = new Map<string, Map<string, FileChangeType['status']>>();
  for (const record of nameStatusRaw.split(RS)) {
    const lines = record.split('\n').filter((l) => l.trim());
    if (lines.length === 0) continue;
    const hash = lines[0].trim();
    const statusMap = new Map<string, FileChangeType['status']>();
    for (const line of lines.slice(1)) {
      const match = line.match(NAME_STATUS_LINE);
      if (match) {
        const paths = match[2].split('\t');
        // last element handles renames (old\tnew)
        statusMap.set(paths[paths.length - 1], parseStatus(match[1]));
      }
    }
    statusByCommit.set(hash, statusMap);
  }

  const commits: RawCommit[] = [];
  for (const record of numstatRaw.split(RS)) {
    if (!record.trim()) continue;
    const parts = record.split(FS);
    if (parts.length < 10) continue;
    const [hash, authorName, authorEmail, authorDate, committerName, committerEmail, committerDate, parentsRaw, message, tail] = parts;

    const statusMap = statusByCommit.get(hash);
    const files: FileChangeType[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    for (const line of tail.split('\n')) {
      const match = line.match(NUMSTAT_LINE);
      if (!match) continue;
      // Skip binary files (marked with -)
      if (match[1] === '-' && match[2] === '-') continue;
      const additions = match[1] === '-' ? 0 : parseInt(match[1], 10) || 0;
      const deletions = match[2] === '-' ? 0 : parseInt(match[2], 10) || 0;
      const pathParts = match[3].split('\t');
      const path = pathParts[pathParts.length - 1];
      totalAdditions += additions;
      totalDeletions += deletions;
      files.push({
        path,
        status: statusMap?.get(path) || 'modified',
        additions,
        deletions,
      });
    }

    commits.push({
      hash,
      authorName,
      authorEmail,
      authorDate,
      committerName,
      committerEmail,
      committerDate,
      parents: parentsRaw.trim().split(' ').filter(Boolean),
      message: message.replace(/\n+$/, ''),
      stats: { totalAdditions, totalDeletions, files },
    });
  }

  return commits;
}
