import { Command } from 'commander';
import {
  readJSON,
  createLogger,
  METRICS_SCHEMA_VERSION,
  assertSchemaVersion,
} from '@aida-dev/core';
import { Metrics } from '@aida-dev/metrics';
import { join } from 'path';
import { promises as fs } from 'fs';
import { CLIConfig } from '../schema/config.js';

function formatDelta(value: number, suffix: string): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${suffix}`;
}

function generateMarkdownReport(metrics: Metrics): string {
  const a = metrics.attribution;
  const coveragePct = (a.coverage * 100).toFixed(1);
  const unknownPct = a.commitsTotal > 0 ? ((a.unknown / a.commitsTotal) * 100).toFixed(1) : '0.0';

  // The recent window is the actionable number, so it leads and it drives
  // the warning; all-time stays visible as context (#52).
  const recentLine = a.recent
    ? `\n**Last ${a.recent.windowDays} days: ${(a.recent.coverage * 100).toFixed(1)}%** (${a.recent.commitsTotal} commits) — the number you can move. All-time: ${coveragePct}%.\n`
    : '';
  const warnOnRecent = a.recent ? a.recent.belowThreshold : a.belowThreshold;

  const coverageWarning = warnOnRecent
    ? `\n> ⚠️ **Coverage is below ${(a.coverageThreshold * 100).toFixed(0)}%${a.recent ? ` in the last ${a.recent.windowDays} days` : ''}.** Provenance is largely unknown, so every metric below is low-confidence. Install the commit hook (\`aida install-hooks\`), tag AI commits, or set \`defaultAttribution\` in \`.aida.json\`.\n`
    : '';

  const priorNote =
    a.defaultAttribution !== 'unknown' && a.unknown > 0
      ? `\nUnattributed commits are **assumed \`${a.defaultAttribution}\`** via \`defaultAttribution\` — this is a prior, not observed data.\n`
      : '';

  const baselineLabel = metrics.baseline?.assumed
    ? 'Human baseline (assumed)'
    : 'Human baseline';

  const comparisonSection = metrics.baseline && metrics.delta
    ? `## AI vs Baseline

| Metric | AI commits | ${baselineLabel} | Delta |
|---|---:|---:|---:|
| Commits | ${metrics.persistence.commitsConsidered} | ${metrics.baseline.persistence.commitsConsidered} | — |
| Avg persistence (days) | ${metrics.persistence.avgDays} | ${metrics.baseline.persistence.avgDays} | ${formatDelta(metrics.delta.avgPersistenceDays, '')} |
| Median persistence (days) | ${metrics.persistence.medianDays} | ${metrics.baseline.persistence.medianDays} | ${formatDelta(metrics.delta.medianPersistenceDays, '')} |
`
    : `## AI vs Baseline

**No baseline available** — no commits are attributed as human, so there is nothing honest to compare against. If unattributed commits in this repo are human-authored, set \`"defaultAttribution": "human"\` in \`.aida.json\`.
`;

  const categories = ['source', 'tests', 'migrations', 'config', 'docs', 'generated'] as const;

  function mixCell(mix: Metrics['cohorts']['ai']['taskMix'], cat: (typeof categories)[number]) {
    if (!mix) return '—';
    const total = categories.reduce((sum, c) => sum + mix[c], 0);
    return total > 0 ? `${mix[cat]} (${((mix[cat] / total) * 100).toFixed(0)}%)` : '0';
  }

  const aiCtx = metrics.cohorts.ai;
  const baseCtx = metrics.cohorts.baseline;
  const fairnessSection = `## Cohort Fairness

Persistence comparisons are only meaningful between cohorts of similar **age** and **task mix**.

| | AI cohort | Baseline cohort |
|---|---:|---:|
| Commits | ${aiCtx.age?.commits ?? 0} | ${baseCtx.age?.commits ?? 0} |
| Avg age (days) | ${aiCtx.age?.avgAgeDays ?? '—'} | ${baseCtx.age?.avgAgeDays ?? '—'} |
| Median age (days) | ${aiCtx.age?.medianAgeDays ?? '—'} | ${baseCtx.age?.medianAgeDays ?? '—'} |
${categories.map((cat) => `| Files: ${cat} | ${mixCell(aiCtx.taskMix, cat)} | ${mixCell(baseCtx.taskMix, cat)} |`).join('\n')}
`;

  const modeOrder = ['agent', 'assisted', 'autocomplete', 'none', 'unknown'] as const;
  const modeRows = modeOrder
    .map((mode) => ({ mode, stats: metrics.byMode[mode] }))
    .filter((row) => row.stats !== null)
    .map(
      ({ mode, stats }) =>
        `| ${mode} | ${stats!.commits} | ${stats!.persistence.avgDays} | ${stats!.persistence.medianDays} | ${stats!.persistence.censored} |`
    );
  const byModeSection =
    modeRows.length > 0
      ? `## By Autonomy Level

The comparison that stays meaningful when everything is AI-assisted: how code holds up per autonomy level (automated commits excluded).

| Mode | Commits | Avg persistence (d) | Median (d) | Surviving |
|---|---:|---:|---:|---:|
${modeRows.join('\n')}

`
      : '';

  const ls = metrics.lineSurvival;
  const lineSection = ls
    ? `## Line Survival

Exact per-line attribution from \`git blame\` — of the code alive in the tree right now, who last wrote it. Unlike file-level persistence, one AI line no longer marks a whole file.${ls.truncated ? '\n\n> ⚠️ Capped sample (`--max-files`): not the whole tree.' : ''}

| Cohort | Lines alive | Share |
|---|---:|---:|
| ai | ${ls.byAttribution.ai} | ${(ls.aiShare * 100).toFixed(1)}% |
| human | ${ls.byAttribution.human} | ${ls.totalLines > 0 ? ((ls.byAttribution.human / ls.totalLines) * 100).toFixed(1) : '0.0'}% |
| automated | ${ls.byAttribution.automated} | ${ls.totalLines > 0 ? ((ls.byAttribution.automated / ls.totalLines) * 100).toFixed(1) : '0.0'}% |
| unknown | ${ls.byAttribution.unknown} | ${ls.totalLines > 0 ? ((ls.byAttribution.unknown / ls.totalLines) * 100).toFixed(1) : '0.0'}% |

By autonomy level: agent ${ls.byMode.agent} · assisted ${ls.byMode.assisted} · autocomplete ${ls.byMode.autocomplete} · none ${ls.byMode.none} · unknown ${ls.byMode.unknown}

${ls.filesBlamed} files blamed, ${ls.totalLines} lines${ls.filesSkipped > 0 ? `, ${ls.filesSkipped} skipped (binary/empty)` : ''}${ls.filesExcluded > 0 ? `, ${ls.filesExcluded} excluded (generated)` : ''}${ls.linesOutsideWindow > 0 ? `, ${ls.linesOutsideWindow} lines from commits outside the collected window` : ''}.

Approximate survival of AI-introduced lines: **${(ls.approxSurvivalRate * 100).toFixed(1)}%** (${ls.byAttribution.ai} alive of ${ls.introducedByAI} added). Approximate because blame cannot see deleted lines, and a line rewritten twice was added twice.

`
    : '';

  const acc = metrics.prAcceptance;
  function accRow(label: string, stats: { total: number; merged: number; closed: number; acceptanceRate: number } | null) {
    if (!stats) return null;
    return `| ${label} | ${stats.total} | ${stats.merged} | ${stats.closed} | ${(stats.acceptanceRate * 100).toFixed(1)}% |`;
  }
  const prSection = acc
    ? `## PR Acceptance

Whether the work was **accepted**, from the ${acc.provider} API — the question git history cannot answer, since squash merges and deleted branches erase what was discarded.${acc.truncated ? '\n\n> ⚠️ Capped sample (`--max-prs`): not the full history.' : ''}

| Cohort | PRs | Merged | Closed unmerged | Acceptance |
|---|---:|---:|---:|---:|
${[
  accRow('**All PRs**', acc.overall),
  accRow('ai', acc.byAttribution.ai),
  accRow('human', acc.byAttribution.human),
  accRow('unknown', acc.byAttribution.unknown),
  accRow('mode: agent', acc.byMode.agent),
  accRow('mode: assisted', acc.byMode.assisted),
  accRow('mode: autocomplete', acc.byMode.autocomplete),
]
  .filter(Boolean)
  .join('\n')}

`
    : '';

  const baselineDetail = metrics.baseline
    ? `## ${baselineLabel}
- Persistence — commits considered: ${metrics.baseline.persistence.commitsConsidered}, avg: ${metrics.baseline.persistence.avgDays}d, median: ${metrics.baseline.persistence.medianDays}d

`
    : '';

  return `# AIDA Report

**Repo:** ${metrics.repoPath}  
**Default branch:** ${metrics.defaultBranch}  
**Window:** ${metrics.window.since || 'beginning'} → ${metrics.window.until || 'now'}  
**Generated:** ${metrics.generatedAt}

## Attribution Coverage

**${coveragePct}% of commits have known provenance** — ai: ${a.ai} · human: ${a.human} · automated: ${a.automated} · unknown: ${a.unknown} (${unknownPct}%)

${recentLine}
**Autonomy:** agent ${a.modes.agent} · assisted ${a.modes.assisted} · autocomplete ${a.modes.autocomplete} · none ${a.modes.none} · unknown ${a.modes.unknown} — evidence: declared ${a.modeEvidence.declared} / inferred ${a.modeEvidence.inferred} / none ${a.modeEvidence.none}
${coverageWarning}${priorNote}
${comparisonSection}
${byModeSection}${lineSection}${prSection}${fairnessSection}
## Persistence (file-level survival)
- Commits considered: ${metrics.persistence.commitsConsidered}
- Files measured: ${metrics.persistence.filesConsidered} (${metrics.persistence.censored} still surviving at collection time; ${metrics.persistence.filesExcluded} excluded: migrations/generated)
- Average days: ${metrics.persistence.avgDays}
- Median days: ${metrics.persistence.medianDays}${
    metrics.persistence.rework
      ? `
- **Rework rate (${metrics.persistence.rework.windowDays}d):** ${(metrics.persistence.rework.rate * 100).toFixed(1)}% — ${metrics.persistence.rework.reworked} of ${metrics.persistence.rework.determined} files with a determined outcome${metrics.persistence.rework.undetermined > 0 ? ` (${metrics.persistence.rework.undetermined} too recent to judge)` : ''}`
      : ''
  }

| 0–1d | 2–7d | 8–30d | 31–90d | 90d+ |
|---:|---:|---:|---:|---:|
| ${metrics.persistence.buckets.d0_1} | ${metrics.persistence.buckets.d2_7} | ${metrics.persistence.buckets.d8_30} | ${metrics.persistence.buckets.d31_90} | ${metrics.persistence.buckets.d90_plus} |

${baselineDetail}### Caveats
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
        const raw = await readJSON<unknown>(inputPath);
        assertSchemaVersion(
          raw,
          METRICS_SCHEMA_VERSION,
          'metrics.json',
          "Rerun 'aida analyze' with this version of AIDA."
        );
        const metrics = Metrics.parse(raw);

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
