import { Command } from 'commander';
import { collectCommits, writeJSON, createLogger } from '@aida-dev/core';
import { join } from 'path';
import { CLIConfig } from '../schema/config.js';

export function createCollectCommand(): Command {
  return new Command('collect')
    .description('Collect commits and generate commit-stream.json')
    .option('--repo <path>', 'Repository path', process.cwd())
    .option('--since <date>', 'Start date (ISO or relative like 90d)')
    .option('--until <date>', 'End date (ISO or relative)')
    .option('--ai-pattern <pattern>', 'AI detection pattern (repeatable)', (value, previous) => {
      return previous ? [...previous, value] : [value];
    }, [])
    .option('--default-branch <name>', 'Default branch name')
    .option('--out-dir <path>', 'Output directory', './aida-output')
    .option('--verbose', 'Verbose logging', false)
    .action(async (options) => {
      const config = CLIConfig.parse(options);
      const logger = createLogger(config.verbose);
      
      try {
        logger.info('Starting commit collection...');
        
        const commitStream = await collectCommits({
          repoPath: config.repo,
          since: config.since,
          until: config.until,
          aiPatterns: config.aiPatterns,
          defaultBranch: config.defaultBranch,
          logger,
        });
        
        const outputPath = join(config.outDir, 'commit-stream.json');
        await writeJSON(outputPath, commitStream);
        
        logger.info(`Collected ${commitStream.commits.length} commits`);
        logger.info(`AI-tagged commits: ${commitStream.commits.filter(c => c.tags.ai).length}`);
        logger.info(`Output written to: ${outputPath}`);
      } catch (error) {
        logger.error(`Collection failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
