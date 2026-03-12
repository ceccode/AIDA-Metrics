import { Command } from 'commander';
import { collectCommits, writeJSON, createLogger, AidaConfig } from '@aida-dev/core';
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

function collectRepeatable(value: string, previous: string[]): string[] {
  return previous ? [...previous, value] : [value];
}

export function createCollectCommand(): Command {
  return new Command('collect')
    .description('Collect commits and generate commit-stream.json')
    .option('--repo <path>', 'Repository path', process.cwd())
    .option('--since <date>', 'Start date (ISO or relative like 90d)')
    .option('--until <date>', 'End date (ISO or relative)')
    .option('--ai-pattern <pattern>', 'AI detection regex (repeatable)', collectRepeatable, [])
    .option('--ai-tool <name>', 'Additional AI tool name (repeatable)', collectRepeatable, [])
    .option('--ai-trailer-domain <domain>', 'Additional Co-authored-by domain (repeatable)', collectRepeatable, [])
    .option('--default-branch <name>', 'Default branch name')
    .option('--out-dir <path>', 'Output directory', './aida-output')
    .option('--verbose', 'Verbose logging', false)
    .action(async (options) => {
      // Commander uses singular camelCase (--ai-tool → aiTool), schema uses plural
      const mapped = {
        ...options,
        aiPatterns: options.aiPattern || [],
        aiTools: options.aiTool || [],
        aiTrailerDomains: options.aiTrailerDomain || [],
      };
      const config = CLIConfig.parse(mapped);
      const logger = createLogger(config.verbose);

      try {
        // Load .aida.json config (merge with CLI flags)
        const fileConfig = await loadAidaConfig(config.repo);
        const aiPatterns = [...(fileConfig.patterns || []), ...config.aiPatterns];
        const aiTools = [...(fileConfig.tools || []), ...config.aiTools];
        const aiTrailerDomains = [...(fileConfig.trailerDomains || []), ...config.aiTrailerDomains];

        if (aiTools.length > 0) logger.info(`Custom AI tools: ${aiTools.join(', ')}`);
        if (aiTrailerDomains.length > 0) logger.info(`Custom trailer domains: ${aiTrailerDomains.join(', ')}`);

        logger.info('Starting commit collection...');

        const commitStream = await collectCommits({
          repoPath: config.repo,
          since: config.since,
          until: config.until,
          aiPatterns,
          aiTools,
          aiTrailerDomains,
          defaultBranch: config.defaultBranch,
          logger,
        });

        const outputPath = join(config.outDir, 'commit-stream.json');
        await writeJSON(outputPath, commitStream);

        logger.info(`Collected ${commitStream.commits.length} commits`);
        logger.info(`AI-tagged commits: ${commitStream.commits.filter((c) => c.tags.ai).length}`);
        logger.info(`Output written to: ${outputPath}`);
      } catch (error) {
        logger.error(
          `Collection failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
