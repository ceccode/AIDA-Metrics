import { Command } from 'commander';
import {
  readJSON,
  writeJSON,
  createLogger,
  CommitStream,
  AidaConfig,
  COMMIT_STREAM_SCHEMA_VERSION,
  BlameStream,
  BLAME_STREAM_SCHEMA_VERSION,
  PRStream,
  PR_STREAM_SCHEMA_VERSION,
  assertSchemaVersion,
  fileExists,
  assertNoRetiredConfigKeys,
  describeError,
} from '@aida-dev/core';
import { calculateMetrics } from '@aida-dev/metrics';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { CLIConfig } from '../schema/config.js';
import { HOOK_NAME, isAidaHookInstalled } from '../hooks/detect.js';

const MODES = ['none', 'autocomplete', 'assisted', 'agent'];

async function loadAidaConfig(repoPath: string): Promise<Partial<AidaConfig>> {
  let raw: string;
  try {
    raw = await readFile(join(repoPath, '.aida.json'), 'utf-8');
  } catch {
    return {}; // No config file: every setting keeps its default
  }
  // A present-but-broken config must not be silently ignored — that would
  // apply defaults the repo explicitly opted out of.
  const parsed = JSON.parse(raw);
  assertNoRetiredConfigKeys(parsed);
  return AidaConfig.parse(parsed);
}

export function createAnalyzeCommand(): Command {
  return new Command('analyze')
    .description('Analyze commit stream and generate metrics.json')
    .option('--out-dir <path>', 'Output directory', './aida-output')
    .option(
      '--default-mode <value>',
      'Prior for commits with no evidence: none | autocomplete | assisted | agent (default: no prior, or .aida.json)'
    )
    .option(
      '--coverage-threshold <fraction>',
      'Coverage below this flags metrics as low-confidence (default: 0.7, or .aida.json)'
    )
    .option(
      '--coverage-window <days>',
      'Window in days for the actionable coverage figure (default: 90)'
    )
    .option(
      '--hotfix-window <days>',
      'Window in days for linking a hotfix to its likely antecedent (default: 7)'
    )
    .option('--verbose', 'Verbose logging', false)
    .action(async (options) => {
      const config = CLIConfig.parse(options);
      const logger = createLogger(config.verbose);

      try {
        logger.info('Starting metrics analysis...');

        const inputPath = join(config.outDir, 'commit-stream.json');
        // Version gate before schema parsing, so an incompatible file gives an
        // actionable message instead of a zod dump (#53)
        const raw = await readJSON<unknown>(inputPath);
        assertSchemaVersion(
          raw,
          COMMIT_STREAM_SCHEMA_VERSION,
          'commit-stream.json',
          "Rerun 'aida collect' with this version of AIDA."
        );
        const commitStream = CommitStream.parse(raw);

        logger.info(`Analyzing ${commitStream.commits.length} commits`);

        // CLI flags override .aida.json (read from the collected repo's root)
        const fileConfig = await loadAidaConfig(commitStream.repoPath);
        const defaultMode = options.defaultMode ?? fileConfig.defaultMode;
        if (defaultMode && !MODES.includes(defaultMode)) {
          throw new Error(
            `Invalid --default-mode "${defaultMode}": expected ${MODES.join(', ')}`
          );
        }
        const coverageThreshold = options.coverageThreshold
          ? Number(options.coverageThreshold)
          : (fileConfig.coverageThreshold ?? 0.7);
        if (Number.isNaN(coverageThreshold) || coverageThreshold < 0 || coverageThreshold > 1) {
          throw new Error(
            `Invalid --coverage-threshold "${options.coverageThreshold}": expected a fraction between 0 and 1`
          );
        }

        // Optional PR outcomes (#51): absent unless `aida fetch-prs` ran.
        // Missing file is the normal offline case, not an error.
        const prStreamPath = join(config.outDir, 'pr-stream.json');
        let prStream = null;
        if (await fileExists(prStreamPath)) {
          const rawPRs = await readJSON<unknown>(prStreamPath);
          assertSchemaVersion(
            rawPRs,
            PR_STREAM_SCHEMA_VERSION,
            'pr-stream.json',
            "Rerun 'aida fetch-prs' with this version of AIDA."
          );
          prStream = PRStream.parse(rawPRs);
          logger.info(`PR outcomes loaded: ${prStream.prs.length} closed PR(s)`);
        }

        const coverageWindowDays = options.coverageWindow
          ? Number(options.coverageWindow)
          : undefined;
        if (
          coverageWindowDays !== undefined &&
          (!Number.isInteger(coverageWindowDays) || coverageWindowDays <= 0)
        ) {
          throw new Error(
            `Invalid --coverage-window "${options.coverageWindow}": expected a positive integer`
          );
        }

        // Optional line-level blame data (#23): absent unless `aida blame` ran
        const blamePath = join(config.outDir, 'blame-stream.json');
        let blameStream = null;
        if (await fileExists(blamePath)) {
          const rawBlame = await readJSON<unknown>(blamePath);
          assertSchemaVersion(
            rawBlame,
            BLAME_STREAM_SCHEMA_VERSION,
            'blame-stream.json',
            "Rerun 'aida blame' with this version of AIDA."
          );
          blameStream = BlameStream.parse(rawBlame);
          logger.info(`Blame data loaded: ${blameStream.totalLines} lines`);
        }

        const hotfixWindowDays = options.hotfixWindow ? Number(options.hotfixWindow) : undefined;
        if (
          hotfixWindowDays !== undefined &&
          (!Number.isInteger(hotfixWindowDays) || hotfixWindowDays <= 0)
        ) {
          throw new Error(
            `Invalid --hotfix-window "${options.hotfixWindow}": expected a positive integer`
          );
        }

        const metrics = calculateMetrics(commitStream, {
          defaultMode,
          coverageThreshold,
          coverageWindowDays,
          prStream,
          blameStream,
          hotfixWindowDays,
        });

        const outputPath = join(config.outDir, 'metrics.json');
        await writeJSON(outputPath, metrics);

        const a = metrics.attribution;
        logger.info(
          `Attribution coverage: ${(a.coverage * 100).toFixed(1)}% (ai: ${a.ai}, human: ${a.human}, automated: ${a.automated}, unknown: ${a.unknown})`
        );
        if (a.recent) {
          logger.info(
            `Recent coverage (${a.recent.windowDays}d): ${(a.recent.coverage * 100).toFixed(1)}% over ${a.recent.commitsTotal} commits`
          );
        }
        if (a.recent ? a.recent.belowThreshold : a.belowThreshold) {
          const threshold = (a.coverageThreshold * 100).toFixed(0);
          // A hook is per-clone state while `.aida.json` is committed, so a
          // repo can be set up for AIDA while the clone in front of you is
          // not — and nothing breaks, the unknown bucket just grows (#75).
          // Worth naming precisely rather than repeating generic advice.
          const configured = await fileExists(join(commitStream.repoPath, '.aida.json'));
          const hooked = await isAidaHookInstalled(commitStream.repoPath);
          logger.warn(
            configured && !hooked
              ? `Coverage is below ${threshold}%: metrics are low-confidence. This repo is set up for AIDA (.aida.json) but THIS CLONE has no ${HOOK_NAME} hook, so its commits declare nothing. Run 'aida install-hooks' — or add "prepare": "aida install-hooks --if-git" to package.json so every clone gets it.`
              : `Coverage is below ${threshold}%: metrics are low-confidence. Install the commit hook (aida install-hooks), or set defaultMode in .aida.json.`
          );
        }
        logger.info(`Average persistence: ${metrics.persistence.avgDays} days`);
        if (metrics.lineSurvival) {
          const ls = metrics.lineSurvival;
          logger.info(
            `Line survival: ${(ls.aiShare * 100).toFixed(1)}% of attributed lines were last written by AI (${ls.byAttribution.ai}/${ls.totalLines})`
          );
        }
        if (metrics.prAcceptance) {
          const ai = metrics.prAcceptance.byAttribution.ai;
          logger.info(
            `PR acceptance overall: ${(metrics.prAcceptance.overall.acceptanceRate * 100).toFixed(1)}%` +
              (ai ? ` · AI PRs: ${(ai.acceptanceRate * 100).toFixed(1)}% (${ai.total})` : '')
          );
        }
        const oc = metrics.outcomeCorrelation;
        if (oc.reverts.total > 0 || oc.hotfixes.total > 0) {
          logger.info(
            `Outcome correlation: ${oc.reverts.resolved}/${oc.reverts.total} reverts resolved, ${oc.hotfixes.linked}/${oc.hotfixes.total} hotfixes linked`
          );
        }
        if (!metrics.baseline) {
          logger.warn('No baseline cohort: no commits attributed as human (see caveats).');
        }
        logger.info(`Output written to: ${outputPath}`);
      } catch (error) {
        logger.error(`Analysis failed: ${describeError(error)}`);
        process.exit(1);
      }
    });
}
