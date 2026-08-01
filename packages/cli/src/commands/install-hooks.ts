import { Command } from 'commander';
import { createLogger } from '@aida-dev/core';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import { join } from 'path';
import { promisify } from 'util';
import { HOOK_END_MARKER, HOOK_MARKER, HOOK_SCRIPT } from '../hooks/prepare-commit-msg.js';

const execFileAsync = promisify(execFile);

const HOOK_NAME = 'prepare-commit-msg';

// Resolves the real hooks directory: worktrees and `core.hooksPath` both
// move it away from `.git/hooks`.
async function resolveHooksDir(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--git-path', 'hooks'], {
      cwd: repoPath,
    });
    const relative = stdout.trim();
    return relative.startsWith('/') ? relative : join(repoPath, relative);
  } catch {
    return join(repoPath, '.git', 'hooks');
  }
}

function isAidaHook(content: string): boolean {
  return content.includes(HOOK_MARKER);
}

// Removes only AIDA's marked block, leaving any surrounding hook intact.
function stripAidaBlock(content: string): string {
  const start = content.indexOf(HOOK_MARKER);
  const end = content.indexOf(HOOK_END_MARKER);
  if (start === -1 || end === -1) return content;
  const before = content.slice(0, start);
  const after = content.slice(end + HOOK_END_MARKER.length);
  return `${before.trimEnd()}\n${after.trimStart()}`.trim() + '\n';
}

export function createInstallHooksCommand(): Command {
  return new Command('install-hooks')
    .description(
      'Install a prepare-commit-msg hook that stamps the autonomy mode (AI-Mode trailer)'
    )
    .option('--repo <path>', 'Repository path', process.cwd())
    .option('--force', 'Overwrite an existing unrelated hook', false)
    .option('--uninstall', 'Remove the AIDA hook block', false)
    .option('--verbose', 'Verbose logging', false)
    .action(async (options) => {
      const logger = createLogger(Boolean(options.verbose));

      try {
        const hooksDir = await resolveHooksDir(options.repo);
        const hookPath = join(hooksDir, HOOK_NAME);

        let existing: string | null = null;
        try {
          existing = await fs.readFile(hookPath, 'utf-8');
        } catch {
          existing = null;
        }

        if (options.uninstall) {
          if (!existing || !isAidaHook(existing)) {
            logger.info('No AIDA hook found: nothing to uninstall.');
            return;
          }
          const remainder = stripAidaBlock(existing);
          // Only our block was there → remove the file entirely
          if (remainder.replace(/^#!.*\n?/, '').trim() === '') {
            await fs.rm(hookPath);
            logger.info(`Removed ${hookPath}`);
          } else {
            await fs.writeFile(hookPath, remainder, { mode: 0o755 });
            logger.info(`Removed the AIDA block from ${hookPath}, leaving the rest intact`);
          }
          return;
        }

        if (existing && !isAidaHook(existing) && !options.force) {
          logger.error(
            `${hookPath} already exists and was not written by AIDA.\n` +
              'Refusing to overwrite someone else\'s hook. Re-run with --force to replace it, ' +
              'or add the AI-Mode trailer from your own hook.'
          );
          process.exit(1);
        }

        await fs.mkdir(hooksDir, { recursive: true });
        await fs.writeFile(hookPath, HOOK_SCRIPT, { mode: 0o755 });

        logger.info(`Installed ${hookPath}`);
        logger.info(
          'Commits will now carry an `AI-Mode:` trailer when the mode is known ' +
            '(AIDA_MODE env var, a detected agent environment, or defaultMode in .aida.json).'
        );
      } catch (error) {
        logger.error(
          `Hook installation failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
