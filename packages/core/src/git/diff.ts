import { simpleGit } from 'simple-git';
import { FileChange } from '../schema/commit.js';
import type { z } from 'zod';

type FileChangeType = z.infer<typeof FileChange>;

export interface DiffStats {
  totalAdditions: number;
  totalDeletions: number;
  files: FileChangeType[];
}

export async function getDiffStats(repoPath: string, commitHash: string): Promise<DiffStats> {
  const git = simpleGit(repoPath);

  try {
    // Get exact file statuses from git
    const nameStatus = await git.raw(['show', '--name-status', '--format=', commitHash]);
    const statusMap = new Map<string, FileChangeType['status']>();

    for (const line of nameStatus.trim().split('\n').filter((l) => l.trim())) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const code = parts[0].charAt(0);
        const path = parts[parts.length - 1]; // last element handles renames (old\tnew)
        switch (code) {
          case 'A':
            statusMap.set(path, 'added');
            break;
          case 'D':
            statusMap.set(path, 'deleted');
            break;
          case 'R':
            statusMap.set(path, 'renamed');
            break;
          default:
            statusMap.set(path, 'modified');
            break;
        }
      }
    }

    // Get line counts from numstat
    const numstat = await git.raw(['show', '--numstat', '--format=', commitHash]);

    const files: FileChangeType[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    const lines = numstat
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
        const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
        const path = parts[parts.length - 1];

        // Skip binary files (marked with -)
        if (parts[0] === '-' && parts[1] === '-') {
          continue;
        }

        totalAdditions += additions;
        totalDeletions += deletions;

        files.push({
          path,
          status: statusMap.get(path) || 'modified',
          additions,
          deletions,
        });
      }
    }

    return {
      totalAdditions,
      totalDeletions,
      files,
    };
  } catch {
    // Return empty stats if diff fails
    return {
      totalAdditions: 0,
      totalDeletions: 0,
      files: [],
    };
  }
}
