import { Command } from 'commander';
import { readJSON, writeJSON, createLogger } from '@aida-dev/core';
import { Metrics } from '@aida-dev/metrics';
import { join } from 'path';
import { promises as fs } from 'fs';
import { CLIConfig } from '../schema/config.js';

function generateMarkdownReport(metrics: Metrics): string {
  const mergeRatioPct = (metrics.mergeRatio.mergeRatio * 100).toFixed(1);

  return `# AIDA Report

**Repo:** ${metrics.repoPath}  
**Default branch:** ${metrics.defaultBranch}  
**Window:** ${metrics.window.since || 'beginning'} → ${metrics.window.until || 'now'}  
**Generated:** ${metrics.generatedAt}

## Merge Ratio
- AI-tagged commits (total): ${metrics.mergeRatio.aiCommitsTotal}
- AI-tagged commits merged: ${metrics.mergeRatio.aiCommitsMerged}
- **Merge Ratio:** ${mergeRatioPct}%

## Persistence (file-level proxy)
- Commits considered: ${metrics.persistence.commitsConsidered}
- Average days: ${metrics.persistence.avgDays}
- Median days: ${metrics.persistence.medianDays}

| 0–1d | 2–7d | 8–30d | 31–90d | 90d+ |
|---:|---:|---:|---:|---:|
| ${metrics.persistence.buckets.d0_1} | ${metrics.persistence.buckets.d2_7} | ${metrics.persistence.buckets.d8_30} | ${metrics.persistence.buckets.d31_90} | ${metrics.persistence.buckets.d90_plus} |

### Caveats
${metrics.caveats.map((caveat) => `- ${caveat}`).join('\n')}
`;
}

export function createReportCommand(): Command {
  return new Command('report')
    .description('Generate report from metrics.json')
    .option('--out-dir <path>', 'Output directory', './aida-output')
    .option('--format <format>', 'Output format: json, md, both', 'both')
    .option('--verbose', 'Verbose logging', false)
    .action(async (options) => {
      const config = CLIConfig.parse(options);
      const logger = createLogger(config.verbose);

      try {
        logger.info('Generating report...');

        const inputPath = join(config.outDir, 'metrics.json');
        const metrics: Metrics = await readJSON(inputPath);

        if (config.format === 'json' || config.format === 'both') {
          const jsonPath = join(config.outDir, 'report.json');
          await writeJSON(jsonPath, metrics);
          logger.info(`JSON report written to: ${jsonPath}`);
        }

        if (config.format === 'md' || config.format === 'both') {
          const markdown = generateMarkdownReport(metrics);
          const mdPath = join(config.outDir, 'report.md');
          await fs.writeFile(mdPath, markdown, 'utf-8');
          logger.info(`Markdown report written to: ${mdPath}`);
        }

        logger.info('Report generation completed');
      } catch (error) {
        logger.error(
          `Report generation failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
