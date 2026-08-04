import { Command } from 'commander';
import {
  readJSON,
  createLogger,
  METRICS_SCHEMA_VERSION,
  assertSchemaVersion,
  describeError,
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
    ? `\n> ⚠️ **Coverage is below ${(a.coverageThreshold * 100).toFixed(0)}%${a.recent ? ` in the last ${a.recent.windowDays} days` : ''}.** Provenance is largely unknown, so every metric below is low-confidence. Install the commit hook (\`aida install-hooks\`) so new commits declare their autonomy mode, or set \`defaultMode\` in \`.aida.json\` for the history that predates it.\n`
    : '';

  const priorNote =
    a.defaultMode !== null && a.evidence.none > 0
      ? `\nCommits with no evidence are **assumed \`${a.defaultMode}\`** via \`defaultMode\` — this is a prior, not observed data, and it does not count toward coverage.\n`
      : '';

  const baselineLabel = metrics.baseline?.assumed
    ? 'Human baseline (assumed)'
    : 'Human baseline';

  const fc = metrics.fairComparison;
  const fairComparisonSection = fc
    ? `
**Age-normalized (fair) comparison** — both cohorts capped to ${fc.capDays} days of observation (the younger cohort's average commit age), so neither side gets credit for time it hasn't had:

| Metric | AI commits (capped) | ${baselineLabel} (capped) | Delta |
|---|---:|---:|---:|
| Avg persistence (days) | ${fc.ai.avgDays} | ${fc.baseline.avgDays} | ${formatDelta(fc.delta.avgPersistenceDays, '')} |
| Median persistence (days) | ${fc.ai.medianDays} | ${fc.baseline.medianDays} | ${formatDelta(fc.delta.medianPersistenceDays, '')} |
`
    : '';

  const comparisonSection = metrics.baseline && metrics.delta
    ? `## AI vs Baseline

| Metric | AI commits | ${baselineLabel} | Delta |
|---|---:|---:|---:|
| Commits | ${metrics.persistence.commitsConsidered} | ${metrics.baseline.persistence.commitsConsidered} | — |
| Avg persistence (days) | ${metrics.persistence.avgDays} | ${metrics.baseline.persistence.avgDays} | ${formatDelta(metrics.delta.avgPersistenceDays, '')} |
| Median persistence (days) | ${metrics.persistence.medianDays} | ${metrics.baseline.persistence.medianDays} | ${formatDelta(metrics.delta.medianPersistenceDays, '')} |
${fairComparisonSection}`
    : `## AI vs Baseline

**No baseline available** — no commits sit at autonomy level \`none\`, so there is nothing honest to compare against. If the commits with no evidence in this repo were hand-written, set \`"defaultMode": "none"\` in \`.aida.json\`.
`;

  const categories = ['source', 'tests', 'migrations', 'config', 'docs', 'generated'] as const;

  function mixCell(mix: Metrics['cohorts']['ai']['taskMix'], cat: (typeof categories)[number]) {
    if (!mix) return '—';
    const total = categories.reduce((sum, c) => sum + mix[c], 0);
    return total > 0 ? `${mix[cat]} (${((mix[cat] / total) * 100).toFixed(0)}%)` : '0';
  }

  const aiCtx = metrics.cohorts.ai;
  const baseCtx = metrics.cohorts.baseline;

  function categoryRow(cat: (typeof categories)[number]) {
    const c = metrics.byCategory[cat];
    if (!c.ai && !c.baseline) return null;
    return `| ${cat} | ${c.ai ? `${c.ai.avgDays}d (${c.ai.filesConsidered} files)` : '—'} | ${c.baseline ? `${c.baseline.avgDays}d (${c.baseline.filesConsidered} files)` : '—'} | ${c.deltaAvgDays !== null ? formatDelta(c.deltaAvgDays, '') : '—'} |`;
  }
  const categoryRows = categories.map(categoryRow).filter(Boolean);
  const byCategorySection =
    categoryRows.length > 0
      ? `

**Within-category comparison** — avg persistence per file category, instead of pooling everything (a mismatched task mix can't masquerade as a quality difference):

| Category | AI avg persistence | Baseline avg persistence | Delta |
|---|---:|---:|---:|
${categoryRows.join('\n')}
`
      : '';

  const fairnessSection = `## Cohort Fairness

Persistence comparisons are only meaningful between cohorts of similar **age** and **task mix**.

| | AI cohort | Baseline cohort |
|---|---:|---:|
| Commits | ${aiCtx.age?.commits ?? 0} | ${baseCtx.age?.commits ?? 0} |
| Avg age (days) | ${aiCtx.age?.avgAgeDays ?? '—'} | ${baseCtx.age?.avgAgeDays ?? '—'} |
| Median age (days) | ${aiCtx.age?.medianAgeDays ?? '—'} | ${baseCtx.age?.medianAgeDays ?? '—'} |
${categories.map((cat) => `| Files: ${cat} | ${mixCell(aiCtx.taskMix, cat)} | ${mixCell(baseCtx.taskMix, cat)} |`).join('\n')}
${byCategorySection}`;

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

Exact per-line attribution from \`git blame\` — of the code alive in the tree right now, who last wrote it. Unlike file-level persistence, one AI line no longer marks a whole file.${ls.truncated ? '\n\n> ⚠️ Capped sample (`--max-files`): an evenly spaced slice of the tree, not the whole tree.' : ''}

| Cohort | Lines alive | Share |
|---|---:|---:|
| ai | ${ls.byAttribution.ai} | ${(ls.aiShare * 100).toFixed(1)}% |
| human | ${ls.byAttribution.human} | ${ls.totalLines > 0 ? ((ls.byAttribution.human / ls.totalLines) * 100).toFixed(1) : '0.0'}% |
| automated | ${ls.byAttribution.automated} | ${ls.totalLines > 0 ? ((ls.byAttribution.automated / ls.totalLines) * 100).toFixed(1) : '0.0'}% |
| unknown | ${ls.byAttribution.unknown} | ${ls.totalLines > 0 ? ((ls.byAttribution.unknown / ls.totalLines) * 100).toFixed(1) : '0.0'}% |

By autonomy level: agent ${ls.byMode.agent} · assisted ${ls.byMode.assisted} · autocomplete ${ls.byMode.autocomplete} · none ${ls.byMode.none} · unknown ${ls.byMode.unknown}

${ls.filesBlamed} files blamed, ${ls.totalLines} lines${ls.filesSkipped > 0 ? `, ${ls.filesSkipped} skipped (binary/empty)` : ''}${ls.filesFailed > 0 ? `, **${ls.filesFailed} failed to blame** (their lines are missing from these figures)` : ''}${ls.filesExcluded > 0 ? `, ${ls.filesExcluded} excluded (generated)` : ''}${ls.linesOutsideWindow > 0 ? `, ${ls.linesOutsideWindow} lines from commits outside the collected window` : ''}.

Approximate survival of AI-introduced lines: **${(ls.approxSurvivalRate * 100).toFixed(1)}%** (${ls.byAttribution.ai} alive of ${ls.introducedByAI} added). Both figures cover only the ${ls.filesBlamed} files blamed above${ls.truncated ? ' — with a capped sample that is a slice of the tree, not a verdict on it' : ''}. Approximate because blame cannot see deleted lines, a line rewritten twice was added twice, and additions to files since deleted or renamed fall outside the count.

`
    : '';

  const oc = metrics.outcomeCorrelation;
  // A bare count is uninterpretable: in a repo that is 90% AI, 90% of
  // reverts being AI means nothing at all. Every row carries the cohort's
  // base rate and the ratio between them, so an excess is visible and a
  // non-excess can't be misread as one.
  function outcomeRows(rates: Metrics['outcomeCorrelation']['reverts']['rates']) {
    return (['ai', 'human', 'unknown'] as const)
      .map((cohort) => {
        const r = rates[cohort];
        if (r.share === null) return null;
        const ratio =
          r.ratio === null
            ? '—'
            : `**${r.ratio.toFixed(2)}×**${r.ratio >= 1.5 ? ' ⚠️' : r.ratio <= 0.67 ? ' ✅' : ''}`;
        return `| ${cohort} | ${r.count} | ${(r.share * 100).toFixed(1)}% | ${r.baseRate === null ? '—' : `${(r.baseRate * 100).toFixed(1)}%`} | ${ratio} |`;
      })
      .filter(Boolean);
  }

  const revertRows = oc.reverts.resolved > 0 ? outcomeRows(oc.reverts.rates) : [];
  const hotfixRows = oc.hotfixes.linked > 0 ? outcomeRows(oc.hotfixes.rates) : [];
  const outcomeSection =
    revertRows.length > 0 || hotfixRows.length > 0
      ? `## Outcome Correlation

Reverts and hotfix-pattern commits, linked back to the attribution of the commit(s) they respond to — scoped to what git itself can answer (no incidents, no SAST).

**Read the ratio, not the count.** A cohort's share of outcomes only means something against its share of authored commits: **1.00× is exactly what its size predicts**, above is an excess, below is better than average. Automated commits are excluded from both sides.
${
  revertRows.length > 0
    ? `
### Reverted commits (${oc.reverts.resolved} of ${oc.reverts.total} reverts resolved to a target)

| Cohort of the reverted commit | Count | Share of reverts | Share of commits | Ratio |
|---|---:|---:|---:|---:|
${revertRows.join('\n')}
`
    : ''
}${
  hotfixRows.length > 0
    ? `
### Hotfix antecedents (${oc.hotfixes.linked} of ${oc.hotfixes.total} hotfixes linked, ${oc.hotfixes.windowDays}d window)

| Cohort of the antecedent | Count | Share of hotfixes | Share of commits | Ratio |
|---|---:|---:|---:|---:|
${hotfixRows.join('\n')}
`
    : ''
}
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

## Autonomy

**${coveragePct}% of commits have known provenance** — declared ${a.evidence.declared} · inferred ${a.evidence.inferred} · no evidence ${a.evidence.none} (${unknownPct}%)

| Autonomy level | Commits |
|---|---:|
| agent | ${a.modes.agent} |
| assisted | ${a.modes.assisted} |
| autocomplete | ${a.modes.autocomplete} |
| none (hand-written) | ${a.modes.none} |
| unknown | ${a.modes.unknown} |
| _automated (no cohort)_ | ${a.automated} |

${recentLine}
*Three-state view:* ai ${a.ai} · human ${a.human} · automated ${a.automated} · unknown ${a.unknown} — a projection of the table above, kept for a one-word headline. What AI participation *was* is the question that keeps discriminating once "was AI involved?" is answered yes everywhere.
${coverageWarning}${priorNote}
${byModeSection}${comparisonSection}
${lineSection}${outcomeSection}${prSection}${fairnessSection}
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
          `Report generation failed: ${describeError(error)}`
        );
        process.exit(1);
      }
    });
}
