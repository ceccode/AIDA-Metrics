import { Command } from 'commander';
import {
  readJSON,
  writeJSON,
  createLogger,
  CommitStream,
  AidaConfig,
  COMMIT_STREAM_SCHEMA_VERSION,
  assertSchemaVersion,
} from '@aida-dev/core';
import { calculateMetrics } from '@aida-dev/metrics';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { CLIConfig } from '../schema/config.js';

async function loadAidaConfig(repoPath: string): Promise<Partial<AidaConfig>> {
  try {
    const raw = await readFile(join(repoPath, '.aida.json'), 'utf-8');
    return AidaConfig.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function createAnalyzeCommand(): Command {
  return new Command('analyze')
    .description('Analyze commit stream and generate metrics.json')
    .option('--out-dir <path>', 'Output directory', './aida-output')
    .option(
      '--default-attribution <value>',
      'Prior for unattributed commits: ai | human | unknown (default: unknown, or .aida.json)'
    )
    .option(
      '--coverage-threshold <fraction>',
      'Coverage below this flags metrics as low-confidence (default: 0.7, or .aida.json)'
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
        const defaultAttribution =
          options.defaultAttribution ?? fileConfig.defaultAttribution ?? 'unknown';
        if (!['ai', 'human', 'unknown'].includes(defaultAttribution)) {
          throw new Error(
            `Invalid --default-attribution "${defaultAttribution}": expected ai, human, or unknown`
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

        const metrics = calculateMetrics(commitStream, { defaultAttribution, coverageThreshold });

        const outputPath = join(config.outDir, 'metrics.json');
        await writeJSON(outputPath, metrics);

        const a = metrics.attribution;
        logger.info(
          `Attribution coverage: ${(a.coverage * 100).toFixed(1)}% (ai: ${a.ai}, human: ${a.human}, automated: ${a.automated}, unknown: ${a.unknown})`
        );
        if (a.belowThreshold) {
          logger.warn(
            `Coverage is below ${(a.coverageThreshold * 100).toFixed(0)}%: metrics are low-confidence. Tag AI commits or set defaultAttribution.`
          );
        }
        logger.info(`Average persistence: ${metrics.persistence.avgDays} days`);
        if (!metrics.baseline) {
          logger.warn('No baseline cohort: no commits attributed as human (see caveats).');
        }
        logger.info(`Output written to: ${outputPath}`);
      } catch (error) {
        logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
