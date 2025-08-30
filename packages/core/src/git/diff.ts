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
    // Get numstat for the commit
    const numstat = await git.raw(['show', '--numstat', '--format=', commitHash]);
    
    const files: FileChangeType[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    
    const lines = numstat.trim().split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
        const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
        const path = parts[2];
        
        // Skip binary files (marked with -)
        if (parts[0] === '-' && parts[1] === '-') {
          continue;
        }
        
        totalAdditions += additions;
        totalDeletions += deletions;
        
        // Determine status (simplified)
        let status: FileChangeType['status'] = 'modified';
        if (additions > 0 && deletions === 0) {
          status = 'added';
        } else if (additions === 0 && deletions > 0) {
          status = 'deleted';
        }
        
        files.push({
          path,
          status,
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
  } catch (error) {
    // Return empty stats if diff fails
    return {
      totalAdditions: 0,
      totalDeletions: 0,
      files: [],
    };
  }
}
