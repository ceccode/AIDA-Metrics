// Installs AIDA's own commit hook on `pnpm install`, so this repo follows the
// `prepare` recipe it recommends to everyone else (#75).
//
// Two guards the published recipe does not need. `--if-git` covers the "no
// git" case; here we also have to survive being the tool itself: on a fresh
// clone `pnpm install` runs before `pnpm build`, so the CLI it would invoke
// does not exist yet. Skipping quietly is right — the next `pnpm install`
// after a build picks it up, and hook installation is idempotent.
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';

const CLI = 'packages/cli/dist/index.js';

if (!existsSync(CLI)) {
  // Not built yet: nothing to install from. Not an error, and not silent
  // enough to hide — a contributor who wonders why sees the reason.
  console.log('[aida] CLI not built yet — skipping hook install (run `pnpm build`, then `pnpm install`).');
  process.exit(0);
}

const result = spawnSync(process.execPath, [CLI, 'install-hooks', '--if-git'], {
  stdio: 'inherit',
});

// Never fail an install over a hook: a broken hook install must not block
// someone from working on the repo.
process.exit(result.status === 0 ? 0 : 0);
