import { exec } from 'child_process';
import { promisify } from 'util';
import { BLAME_STREAM_SCHEMA_VERSION, BlameStream } from '../schema/blame.js';
import { Logger } from '../utils/log.js';

const execAsync = promisify(exec);

// Line-level survival via `git blame` (#23).
//
// File-level persistence answers "was this file touched again?", which is a
// proxy: one AI line in a thousand marks the whole file, and any later commit
// stops the clock. Blame answers the direct question instead — for every line
// alive in HEAD right now, which commit last wrote it?
//
// This is exact for what it measures (the living codebase) and says nothing
// about deleted lines: blame cannot see what is no longer there. The
// "survival rate" derived from it is therefore an approximation, and labelled
// as one.

// `--incremental` emits compact chunk headers: "<sha> <orig> <final> <count>"
// followed by metadata. Summing the count per sha is all we need, and it is
// far cheaper to parse than --line-porcelain.
const CHUNK_HEADER = /^([0-9a-f]{40})\s+\d+\s+\d+\s+(\d+)$/;

export async function blameFileLineCounts(
  repoPath: string,
  file: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  // -w ignores whitespace-only changes, so reformatting does not reattribute
  // a line to whoever ran the formatter.
  const { stdout } = await execAsync(
    `git blame --incremental -w HEAD -- ${JSON.stringify(file)}`,
    { cwd: repoPath, maxBuffer: 64 * 1024 * 1024 }
  );

  for (const line of stdout.split('\n')) {
    const match = line.match(CHUNK_HEADER);
    if (!match) continue;
    const [, sha, count] = match;
    counts.set(sha, (counts.get(sha) ?? 0) + Number(count));
  }

  return counts;
}

// The empty tree, so a single diff against HEAD enumerates every tracked
// file with its line counts — and `-` in place of numbers marks binaries.
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

// `git blame` does not fail on binary files: it reports the whole blob as a
// single line, which would silently add junk to the line totals. Detecting
// them up front in one command is both correct and cheap.
export async function findBinaryFiles(repoPath: string): Promise<Set<string>> {
  const binary = new Set<string>();
  try {
    const { stdout } = await execAsync(`git diff --numstat ${EMPTY_TREE} HEAD`, {
      cwd: repoPath,
      maxBuffer: 64 * 1024 * 1024,
    });
    for (const line of stdout.split('\n')) {
      const parts = line.split('\t');
      if (parts.length >= 3 && parts[0] === '-' && parts[1] === '-') {
        binary.add(parts[parts.length - 1]);
      }
    }
  } catch {
    // An empty repo or unreadable history: nothing to exclude
  }
  return binary;
}

export interface CollectBlameOptions {
  repoPath: string;
  // Paths to skip — lockfiles and generated output would dominate the line
  // count while carrying no authorship signal.
  exclude?: (path: string) => boolean;
  maxFiles?: number;
  logger?: Logger;
}

export async function collectBlame(options: CollectBlameOptions): Promise<BlameStream> {
  const { repoPath, exclude, maxFiles, logger } = options;

  const { stdout: fileList } = await execAsync('git ls-tree -r HEAD --name-only', {
    cwd: repoPath,
    maxBuffer: 64 * 1024 * 1024,
  });

  const allFiles = fileList.split('\n').filter(Boolean);
  const binaryFiles = await findBinaryFiles(repoPath);
  const textFiles = allFiles.filter((f) => !binaryFiles.has(f));
  const binarySkipped = allFiles.length - textFiles.length;

  const candidates = exclude ? textFiles.filter((f) => !exclude(f)) : textFiles;
  const excludedByFilter = textFiles.length - candidates.length;

  const selected = maxFiles ? candidates.slice(0, maxFiles) : candidates;
  const truncated = selected.length < candidates.length;

  const linesBySha: Record<string, number> = {};
  let filesBlamed = 0;
  let filesSkipped = binarySkipped;
  let totalLines = 0;

  for (const file of selected) {
    let counts: Map<string, number>;
    try {
      counts = await blameFileLineCounts(repoPath, file);
    } catch {
      // Binary files, submodules and unreadable paths: skipped, never fatal
      filesSkipped++;
      continue;
    }

    if (counts.size === 0) {
      filesSkipped++; // empty or binary
      continue;
    }

    filesBlamed++;
    for (const [sha, count] of counts) {
      linesBySha[sha] = (linesBySha[sha] ?? 0) + count;
      totalLines += count;
    }

    if (logger && filesBlamed % 100 === 0) {
      logger.info(`Blamed ${filesBlamed}/${selected.length} files...`);
    }
  }

  return {
    schemaVersion: BLAME_STREAM_SCHEMA_VERSION,
    repoPath,
    generatedAt: new Date().toISOString(),
    filesBlamed,
    filesSkipped,
    filesExcluded: excludedByFilter,
    truncated,
    totalLines,
    linesBySha,
  };
}
