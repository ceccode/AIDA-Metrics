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

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

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
    ? `\n> ⚠️ **Coverage is below ${(a.coverageThreshold * 100).toFixed(0)}%${a.recent ? ` in the last ${a.recent.windowDays} days` : ''}.** The sections from here down depend on attribution evidence and are low-confidence — the Code Quality section above is unaffected, it needs no evidence. Install the commit hook (\`aida install-hooks\`) so new commits declare their autonomy mode, or set \`defaultMode\` in \`.aida.json\` for the history that predates it.\n`
    : '';

  const priorNote =
    a.defaultMode !== null && a.evidence.none > 0
      ? `\nCommits with no evidence are **assumed \`${a.defaultMode}\`** via \`defaultMode\` — this is a prior, not observed data, and it does not count toward coverage.\n`
      : '';

  // Overlay gating (#77 step 4). A cohort whose every commit was placed
  // there by the `defaultMode` prior is not a measurement — it is the
  // assumption describing itself, rendered as a table with numbers in it.
  // The earlier `(N assumed)` labelling made the prior's contribution
  // visible; this stops it from conjuring an overlay on its own. Cohorts
  // stay in `metrics.json` either way: the gate is on presentation, not on
  // data, so a consumer that wants the prior's view can still have it.
  const evidenceBacked = (stats: Metrics['byMode']['agent']) =>
    stats !== null && stats.commits - stats.assumed > 0;

  const AI_MODES = ['agent', 'assisted', 'autocomplete'] as const;
  const aiCohortHasEvidence = AI_MODES.some((mode) => evidenceBacked(metrics.byMode[mode]));
  const baselineHasEvidence = evidenceBacked(metrics.byMode.none);

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

  const comparisonSection = metrics.baseline && metrics.delta && aiCohortHasEvidence && baselineHasEvidence
    ? `## AI vs Baseline

| Metric | AI commits | ${baselineLabel} | Delta |
|---|---:|---:|---:|
| Commits | ${metrics.persistence.commitsConsidered} | ${metrics.baseline.persistence.commitsConsidered} | — |
| Avg persistence (days) | ${metrics.persistence.avgDays} | ${metrics.baseline.persistence.avgDays} | ${formatDelta(metrics.delta.avgPersistenceDays, '')} |
| Median persistence (days) | ${metrics.persistence.medianDays} | ${metrics.baseline.persistence.medianDays} | ${formatDelta(metrics.delta.medianPersistenceDays, '')} |
${fairComparisonSection}`
    : `## AI vs Baseline

${
      metrics.baseline && metrics.delta
        ? `**Comparison withheld** — one side of it exists only because of the \`${a.defaultMode}\` prior: ${
            aiCohortHasEvidence
              ? 'every commit in the baseline cohort was placed there by assumption'
              : 'every commit in the AI cohort was placed there by assumption'
          }, not by evidence. A measured cohort against an assumed one yields a delta that describes the prior, not the repo. Install the commit hook (\`aida install-hooks\`) so commits declare their own mode — the cohorts stay in \`metrics.json\` meanwhile.`
        : `**No baseline available** — no commits sit at autonomy level \`none\`, so there is nothing honest to compare against. If the commits with no evidence in this repo were hand-written, set \`"defaultMode": "none"\` in \`.aida.json\`.`
    }
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

  // Gated only when NEITHER side has evidence — then every column would be
  // the prior's doing. With one real cohort the table still carries its age
  // and task mix, which is information the repo genuinely has; the empty
  // column speaks for itself, as it did before this gate existed.
  const fairnessSection = !(aiCohortHasEvidence || baselineHasEvidence)
    ? ''
    : `## Cohort Fairness

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
    // Gated (#77 step 4): a row with no evidence behind it is the prior
    // talking to itself. `unknown` is exempt — it IS the no-evidence bucket,
    // and reporting its size is the honest part.
    .filter((row) => row.mode === 'unknown' || evidenceBacked(row.stats))
    .filter((row) => row.stats !== null)
    .map(
      ({ mode, stats }) =>
        `| ${mode} | ${stats!.commits}${stats!.assumed > 0 ? ` (${stats!.assumed} assumed)` : ''} | ${stats!.persistence.avgDays} | ${stats!.persistence.medianDays} | ${stats!.persistence.censored} |`
    );
  const gatedModes = modeOrder.filter(
    (mode) => mode !== 'unknown' && metrics.byMode[mode] !== null && !evidenceBacked(metrics.byMode[mode])
  );
  // Three states, not two: a rendered table, an explained withholding, or
  // nothing at all when there is genuinely no cohort data. The middle case
  // matters — dropping the section silently would hide the fact that a prior
  // is configured and doing nothing, which is itself worth knowing.
  const hasAnyCohort = modeOrder.some((mode) => metrics.byMode[mode] !== null);
  const byModeSection =
    modeRows.length > 0
      ? `## By Autonomy Level

The comparison that stays meaningful when everything is AI-assisted: how code holds up per autonomy level (automated commits excluded).

Cohorts here include commits placed by the \`defaultMode\` prior, marked *assumed* — so these counts can exceed the observed ones above, which only ever report what the commits themselves declare.${
          gatedModes.length > 0
            ? `\n\n> ${gatedModes.length === 1 ? `The \`${gatedModes[0]}\` level is` : `The \`${gatedModes.join('`, `')}\` levels are`} not shown: every commit in ${gatedModes.length === 1 ? 'it' : 'them'} is there by prior, with no evidence behind it. The data is still in \`metrics.json\`.`
            : ''
        }

| Mode | Commits | Avg persistence (d) | Median (d) | Surviving |
|---|---:|---:|---:|---:|
${modeRows.join('\n')}

`
      : hasAnyCohort
        ? `## By Autonomy Level

**Withheld** — every autonomy cohort in this repo exists only because of the \`${a.defaultMode}\` prior${gatedModes.length > 0 ? ` (${gatedModes.join(', ')})` : ''}: not one commit carries evidence of the level it was written at, so a table here would be the assumption describing itself. The cohorts are still in \`metrics.json\` for anyone who wants the prior's view.

Install the commit hook (\`aida install-hooks\`) so commits declare their own mode — see Data Quality below.

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

  // Code Quality opens the report (#77 step 2): the repo-level block from
  // step 1, rendered first because it is the only view that needs no
  // attribution evidence — valid at 0% coverage, untouched by the prior.
  // It also replaces the old "Persistence (file-level survival)" section,
  // which rendered the AI cohort's numbers under a generic-looking heading —
  // the same defect class as the assumed-cohort and automated-mode bugs:
  // cohort data wearing a repo-level label.
  const rq = metrics.repo;
  const rqp = rq.persistence;

  // Quality over time (#77 step 3). The headline of a quality-first report is
  // the direction of travel, not the snapshot — and the direction is only
  // readable between periods that have had the same amount of time to be
  // reworked, hence the maturity marker below.
  const tr = metrics.trend;
  const lc = tr.latestComparison;
  const trendHeadline = lc
    ? `**${lc.from} → ${lc.to}:** average persistence ${lc.avgPersistenceDays.from}d → **${lc.avgPersistenceDays.to}d** (${formatDelta(lc.avgPersistenceDays.delta, 'd')})${
        lc.reworkRate
          ? `, rework ${(lc.reworkRate.from * 100).toFixed(1)}% → **${(lc.reworkRate.to * 100).toFixed(1)}%** (${formatDelta(round1(lc.reworkRate.delta * 100), 'pt')})`
          : ''
      }.`
    : `**No comparison yet** — fewer than two periods have been over for the full ${tr.observationDays}-day observation window. A trend needs two points that have had the same amount of time.`;

  const immature = tr.periods.filter((p) => !p.mature).length;
  const trendRows = tr.periods.map((p) => {
    const persistence = p.persistence;
    return `| ${p.label}${p.mature ? '' : ' *(immature)*'} | ${p.commitsAuthored} | ${persistence ? persistence.avgDays : '—'} | ${persistence?.rework ? `${(persistence.rework.rate * 100).toFixed(1)}%` : '—'} | ${p.coverage === null ? '—' : `${(p.coverage * 100).toFixed(0)}%`} |`;
  });

  const trendSection =
    tr.periods.length > 0
      ? `
### Trend (${tr.granularity}ly, ${tr.observationDays}-day observation window)

${trendHeadline}

Every period is measured through the same ${tr.observationDays}-day window, so no period gets credit for time the others have not had.

| Period | Commits | Avg persistence (d) | Rework | Coverage |
|---|---:|---:|---:|---:|
${trendRows.join('\n')}
${immature > 0 ? `\n*(immature)* — Too recent to judge: the period has not been over for the full ${tr.observationDays}-day window, so its files have had less time to be reworked than every period above. Shown for completeness, excluded from the comparison — otherwise every report would find quality declining.\n` : ''}`
      : '';
  const codeQualitySection = `## Code Quality

How the code holds up, as a property of the **repo** — measured over all ${rq.commitsAuthored} authored commits (${rq.commitsAutomated} automated excluded). No attribution evidence required: these numbers do not move with coverage or with the \`defaultMode\` prior.

- Files measured: ${rqp.filesConsidered} (${rqp.censored} still surviving at collection time; ${rqp.filesExcluded} excluded: migrations/generated)
- Average persistence: ${rqp.avgDays} days · median: ${rqp.medianDays}${
    rqp.rework
      ? `
- **Rework rate (${rqp.rework.windowDays}d):** ${(rqp.rework.rate * 100).toFixed(1)}% — ${rqp.rework.reworked} of ${rqp.rework.determined} files with a determined outcome${rqp.rework.undetermined > 0 ? ` (${rqp.rework.undetermined} too recent to judge)` : ''}`
      : ''
  }

| 0–1d | 2–7d | 8–30d | 31–90d | 90d+ |
|---:|---:|---:|---:|---:|
| ${rqp.buckets.d0_1} | ${rqp.buckets.d2_7} | ${rqp.buckets.d8_30} | ${rqp.buckets.d31_90} | ${rqp.buckets.d90_plus} |
${trendSection}
`;

  const baselineDetail = metrics.baseline && baselineHasEvidence
    ? `## ${baselineLabel}
- Persistence — commits considered: ${metrics.baseline.persistence.commitsConsidered}, avg: ${metrics.baseline.persistence.avgDays}d, median: ${metrics.baseline.persistence.medianDays}d

`
    : '';

  return `# AIDA Report

**Repo:** ${metrics.repoPath}  
**Default branch:** ${metrics.defaultBranch}  
**Window:** ${metrics.window.since || 'beginning'} → ${metrics.window.until || 'now'}  
**Generated:** ${metrics.generatedAt}

${codeQualitySection}${lineSection}${outcomeSection}${prSection}## Autonomy

The lens over the quality above: **at what level of AI autonomy** the code was written. Everything from here down depends on attribution evidence — see Data Quality below for how much of it this repo has.
${coverageWarning}
| Autonomy level | Commits |
|---|---:|
| agent | ${a.modes.agent} |
| assisted | ${a.modes.assisted} |
| autocomplete | ${a.modes.autocomplete} |
| none (hand-written) | ${a.modes.none} |
| unknown | ${a.modes.unknown} |
| _automated (no cohort)_ | ${a.automated} |

*Three-state view:* ai ${a.ai} · human ${a.human} · automated ${a.automated} · unknown ${a.unknown} — a projection of the table above, kept for a one-word headline.
${priorNote}
${byModeSection}${comparisonSection}
${fairnessSection}${baselineDetail}## Data Quality

**${coveragePct}% of commits carry attribution evidence** — declared ${a.evidence.declared} · inferred ${a.evidence.inferred} · none ${a.evidence.none} (${unknownPct}%). Evidence gates the autonomy sections above, never Code Quality.
${recentLine}
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
