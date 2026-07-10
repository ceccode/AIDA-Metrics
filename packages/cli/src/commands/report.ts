import { Command } from 'commander';
import { readJSON, createLogger } from '@aida-dev/core';
import { Metrics } from '@aida-dev/metrics';
import { join } from 'path';
import { promises as fs } from 'fs';
import { CLIConfig } from '../schema/config.js';

function formatDelta(value: number, suffix: string): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${suffix}`;
}

function generateMarkdownReport(metrics: Metrics): string {
  const mergeRatioPct = (metrics.mergeRatio.mergeRatio * 100).toFixed(1);
  const baselineMergeRatioPct = (metrics.baseline.mergeRatio.mergeRatio * 100).toFixed(1);
  const deltaMergeRatioPp = Math.round(metrics.delta.mergeRatio * 1000) / 10;

  return `# AIDA Report

**Repo:** ${metrics.repoPath}  
**Default branch:** ${metrics.defaultBranch}  
**Window:** ${metrics.window.since || 'beginning'} → ${metrics.window.until || 'now'}  
**Generated:** ${metrics.generatedAt}

## AI vs Baseline

| Metric | AI commits | Non-AI baseline | Delta |
|---|---:|---:|---:|
| Commits | ${metrics.mergeRatio.aiCommitsTotal} | ${metrics.baseline.mergeRatio.commitsTotal} | — |
| Merge ratio | ${mergeRatioPct}% | ${baselineMergeRatioPct}% | ${formatDelta(deltaMergeRatioPp, ' pp')} |
| Avg persistence (days) | ${metrics.persistence.avgDays} | ${metrics.baseline.persistence.avgDays} | ${formatDelta(metrics.delta.avgPersistenceDays, '')} |
| Median persistence (days) | ${metrics.persistence.medianDays} | ${metrics.baseline.persistence.medianDays} | ${formatDelta(metrics.delta.medianPersistenceDays, '')} |

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

## Baseline (non-AI commits)
- Commits (total): ${metrics.baseline.mergeRatio.commitsTotal}
- Commits merged: ${metrics.baseline.mergeRatio.commitsMerged}
- **Merge Ratio:** ${baselineMergeRatioPct}%
- Persistence — commits considered: ${metrics.baseline.persistence.commitsConsidered}, avg: ${metrics.baseline.persistence.avgDays}d, median: ${metrics.baseline.persistence.medianDays}d

### Caveats
${metrics.caveats.map((caveat) => `- ${caveat}`).join('\n')}
`;
}

export function createReportCommand(): Command {
  return new Command('report')
    .description('Generate report from metrics.json')
    .option('--out-dir <path>', 'Output directory', './aida-output')
    .option('--verbose', 'Verbose logging', false)
    .action(async (options) => {
      const config = CLIConfig.parse(options);
      const logger = createLogger(config.verbose);

      try {
        logger.info('Generating report...');

        const inputPath = join(config.outDir, 'metrics.json');
        const metrics = await readJSON(inputPath, Metrics);

        const markdown = generateMarkdownReport(metrics);
        const mdPath = join(config.outDir, 'report.md');
        await fs.writeFile(mdPath, markdown, 'utf-8');
        logger.info(`Markdown report written to: ${mdPath}`);

        logger.info('Report generation completed');
      } catch (error) {
        logger.error(
          `Report generation failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
