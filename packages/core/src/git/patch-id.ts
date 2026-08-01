import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Squash-merge detection via `git patch-id` (proposal for #20).
//
// With a squash-merge workflow, the branch commits never become ancestors of
// the default branch: their content lands as a single new commit with a new
// hash. An ancestry check therefore reports them as unmerged.
//
// `git patch-id --stable` hashes a diff independently of commit metadata, so
// a branch commit and the squashed commit that contains its changes *can*
// produce the same id — when the squash contains exactly one commit's worth
// of changes. That caveat is the crux of this proposal: see the PR discussion.

export interface PatchIdMap {
  // patch-id → commit shas that produce it
  byPatchId: Map<string, string[]>;
  bySha: Map<string, string>;
}

// `git log -p | git patch-id` streams one "<patchId> <commitSha>" line per
// commit, which is far cheaper than spawning a process per commit.
export async function computePatchIds(repoPath: string, revRange: string): Promise<PatchIdMap> {
  const byPatchId = new Map<string, string[]>();
  const bySha = new Map<string, string>();

  // maxBuffer raised: `log -p` over a long history is large
  const { stdout } = await execAsync(
    `git log -p --no-merges --no-color ${revRange} | git patch-id --stable`,
    { cwd: repoPath, maxBuffer: 256 * 1024 * 1024 }
  );

  for (const line of stdout.split('\n')) {
    const [patchId, sha] = line.trim().split(/\s+/);
    if (!patchId || !sha) continue;
    bySha.set(sha, patchId);
    const existing = byPatchId.get(patchId);
    if (existing) {
      existing.push(sha);
    } else {
      byPatchId.set(patchId, [sha]);
    }
  }

  return { byPatchId, bySha };
}

// Returns the sha of the default-branch commit whose patch matches, if any.
export function findSquashMatch(
  sha: string,
  branchIds: PatchIdMap,
  defaultBranchIds: PatchIdMap
): string | null {
  const patchId = branchIds.bySha.get(sha);
  if (!patchId) return null;
  const matches = defaultBranchIds.byPatchId.get(patchId);
  return matches?.[0] ?? null;
}
