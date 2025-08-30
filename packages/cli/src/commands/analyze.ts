import { Command } from 'commander';
import { readJSON, writeJSON, createLogger } from '@aida/core';
import { calculateMetrics } from '@aida/metrics';
import { join } from 'path';
import { CLIConfig } from '../schema/config.js';

export function createAnalyzeCommand(): Command {
  return new Command('analyze')
    .description('Analyze commit stream and generate metrics.json')
    .option('--out-dir <path>', 'Output directory', './aida-output')
    .option('--verbose', 'Verbose logging', false)
    .action(async (options) => {
      const config = CLIConfig.parse(options);
      const logger = createLogger(config.verbose);
      
      try {
        logger.info('Starting metrics analysis...');
        
        const inputPath = join(config.outDir, 'commit-stream.json');
        const commitStream = await readJSON(inputPath);
        
        logger.info(`Analyzing ${commitStream.commits.length} commits`);
        
        const metrics = calculateMetrics(commitStream);
        
        const outputPath = join(config.outDir, 'metrics.json');
        await writeJSON(outputPath, metrics);
        
        logger.info(`Merge ratio: ${(metrics.mergeRatio.mergeRatio * 100).toFixed(1)}%`);
        logger.info(`Average persistence: ${metrics.persistence.avgDays} days`);
        logger.info(`Output written to: ${outputPath}`);
      } catch (error) {
        logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
