import { execFile } from 'child_process';
import { promisify } from 'util';
import { BLAME_STREAM_SCHEMA_VERSION, BlameStream } from '../schema/blame.js';
import { Logger } from '../utils/log.js';

const execFileAsync = promisify(execFile);

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
  file: string,
  ref = 'HEAD'
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  // -w ignores whitespace-only changes, so reformatting does not reattribute
  // a line to whoever ran the formatter.
  // `file` comes from the repository and is therefore hostile input. Passing
  // it through a shell used to make names such as `$(touch PWNED)` execute
  // command substitutions even though the value had been JSON-stringified:
  // double quotes are not a shell security boundary. Keep every git argument
  // separate so no shell is involved (# security audit, pre-1.0).
  const { stdout } = await execFileAsync(
    'git',
    ['blame', '--incremental', '-w', ref, '--', file],
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
export async function findBinaryFiles(repoPath: string, ref = 'HEAD'): Promise<Set<string>> {
  const binary = new Set<string>();
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--numstat', '-z', EMPTY_TREE, ref], {
      cwd: repoPath,
      maxBuffer: 64 * 1024 * 1024,
    });
    const records = stdout.split('\0');
    for (let i = 0; i < records.length; i++) {
      const parts = records[i].split('\t');
      if (parts.length < 3) continue;
      // With -z a rename is `<add>\t<del>\t\0<old>\0<new>\0`.
      // The empty third field therefore consumes the following two records.
      const path = parts[2] || records[i + 2];
      if (!parts[2]) i += 2;
      if (path && parts[0] === '-' && parts[1] === '-') binary.add(path);
    }
  } catch {
    // An empty repo or unreadable history: nothing to exclude
  }
  return binary;
}

// Evenly spaced subset of `items`, at most `max` long, preserving order.
// `max >= items.length` returns everything.
function stride<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  const picked: T[] = [];
  for (let i = 0; picked.length < max; i++) {
    picked.push(items[Math.floor(i * step)]);
  }
  return picked;
}

export interface CollectBlameOptions {
  repoPath: string;
  ref?: string;
  // Paths to skip — lockfiles and generated output would dominate the line
  // count while carrying no authorship signal.
  exclude?: (path: string) => boolean;
  maxFiles?: number;
  logger?: Logger;
}

export async function collectBlame(options: CollectBlameOptions): Promise<BlameStream> {
  const { repoPath, ref = 'HEAD', exclude, maxFiles, logger } = options;

  // NUL separation is required for valid git paths containing newlines.
  const { stdout: fileList } = await execFileAsync(
    'git',
    ['ls-tree', '-r', '-z', ref, '--name-only'],
    {
      cwd: repoPath,
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  const { stdout: headSha } = await execFileAsync('git', ['rev-parse', ref], {
    cwd: repoPath,
  });

  const allFiles = fileList.split('\0').filter(Boolean);
  const binaryFiles = await findBinaryFiles(repoPath, ref);
  const textFiles = allFiles.filter((f) => !binaryFiles.has(f));
  const binarySkipped = allFiles.length - textFiles.length;

  const candidates = exclude ? textFiles.filter((f) => !exclude(f)) : textFiles;
  const excludedByFilter = textFiles.length - candidates.length;

  // `--max-files` used to take the first N in `git ls-tree` order, which is
  // path order — on a monorepo that is one corner of the alphabet, not a
  // sample of the repo. On babel, `--max-files 500` never got past
  // `packages/babel-c*`, and 183 of the 500 came from a single package.
  // Striding instead spreads the same budget across the whole tree; it stays
  // fully deterministic, so two runs of the same commit still agree.
  const selected = maxFiles ? stride(candidates, maxFiles) : candidates;
  const truncated = selected.length < candidates.length;

  const linesBySha: Record<string, number> = {};
  const blamedPaths: string[] = [];
  let filesBlamed = 0;
  let filesSkipped = binarySkipped;
  let filesFailed = 0;
  let firstFailure = '';
  let totalLines = 0;

  for (const file of selected) {
    let counts: Map<string, number>;
    try {
      counts = await blameFileLineCounts(repoPath, file, ref);
    } catch (error) {
      // Submodules, unreadable paths, a missing object in a partial clone,
      // or stdout past maxBuffer. Never fatal — but counting these as
      // "skipped (binary/empty)" hid a failing run inside a normal-looking
      // one, so they are tallied and reported separately.
      filesFailed++;
      if (!firstFailure) {
        firstFailure = `${file}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`;
      }
      continue;
    }

    if (counts.size === 0) {
      filesSkipped++; // empty or binary
      continue;
    }

    filesBlamed++;
    blamedPaths.push(file);
    for (const [sha, count] of counts) {
      linesBySha[sha] = (linesBySha[sha] ?? 0) + count;
      totalLines += count;
    }

    if (logger && filesBlamed % 100 === 0) {
      logger.info(`Blamed ${filesBlamed}/${selected.length} files...`);
    }
  }

  if (filesFailed > 0) {
    logger?.warn(
      `git blame failed on ${filesFailed} of ${selected.length} file(s) — their lines are missing from every figure below. First: ${firstFailure}`
    );
  }

  return {
    schemaVersion: BLAME_STREAM_SCHEMA_VERSION,
    repoPath,
    headSha: headSha.trim(),
    generatedAt: new Date().toISOString(),
    filesBlamed,
    filesSkipped,
    filesFailed,
    filesExcluded: excludedByFilter,
    truncated,
    totalLines,
    linesBySha,
    blamedPaths,
  };
}
