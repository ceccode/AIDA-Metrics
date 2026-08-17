import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Command } from 'commander';
import { createCollectCommand } from './collect.js';
import { createAnalyzeCommand } from './analyze.js';
import { createReportCommand } from './report.js';

// Overlay gating (#77 step 4): a cohort built entirely out of the
// `defaultMode` prior is the assumption describing itself. It must not be
// rendered as a measurement — while the underlying data stays in
// metrics.json, because the gate is on presentation, not on collection.

let repoPath: string;
let outDir: string;

function git(cmd: string) {
  execSync(cmd, { cwd: repoPath, env: { ...process.env, AIDA_MODE: '', CLAUDECODE: '' } });
}

// The report has an observed-counts table AND cohort overlays; assertions
// about gating must target the overlay, since the observed table showing
// `agent 0` is exactly right.
function section(report: string, heading: string): string {
  const start = report.indexOf(heading);
  if (start === -1) return '';
  const rest = report.slice(start + heading.length);
  const end = rest.indexOf('\n## ');
  return end === -1 ? rest : rest.slice(0, end);
}

function run(command: Command, args: string[]): Promise<Command> {
  return command.parseAsync(args, { from: 'user' });
}

interface ModeCohort {
  commits: number;
  assumed: number;
}

async function pipeline(
  extraArgs: string[] = []
): Promise<{ report: string; metrics: { byMode: Record<string, ModeCohort | null> } }> {
  await run(createCollectCommand(), ['--repo', repoPath, '--out-dir', outDir]);
  await run(createAnalyzeCommand(), ['--out-dir', outDir, ...extraArgs]);
  await run(createReportCommand(), ['--out-dir', outDir]);
  return {
    report: readFileSync(join(outDir, 'report.md'), 'utf-8'),
    metrics: JSON.parse(readFileSync(join(outDir, 'metrics.json'), 'utf-8')),
  };
}

beforeEach(() => {
  repoPath = mkdtempSync(join(tmpdir(), 'aida-gate-repo-'));
  outDir = mkdtempSync(join(tmpdir(), 'aida-gate-out-'));
  git('git init -q -b main');
  git('git config user.name test && git config user.email test@example.com');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(repoPath, { recursive: true, force: true });
  rmSync(outDir, { recursive: true, force: true });
});

describe('overlay gating (#77 step 4)', () => {
  it('withholds every cohort overlay when only the prior populates them', async () => {
    // Two commits, neither declaring anything: 0% evidence
    writeFileSync(join(repoPath, 'a.ts'), 'export const a = 1;\n');
    git('git add -A && git commit -q -m "feat: one"');
    writeFileSync(join(repoPath, 'a.ts'), 'export const a = 2;\n');
    git('git add -A && git commit -q -m "feat: two"');

    const { report, metrics } = await pipeline(['--default-mode', 'agent']);

    // The prior would otherwise conjure a full agent cohort out of nothing
    expect(metrics.byMode.agent).toEqual(expect.objectContaining({ commits: 2, assumed: 2 }));

    // ...but no overlay row is rendered from it. Scoped to the overlay: the
    // observed table above legitimately shows `agent 0`, which is the truth.
    expect(section(report, '## By Autonomy Level')).not.toMatch(/\| agent \|/);
    // Withheld with a reason, not silently dropped: a configured prior doing
    // nothing is itself worth telling the reader about
    expect(report).toContain('**Withheld**');
    expect(report).toContain('the assumption describing itself');
    expect(report).not.toContain('## Cohort Fairness');

    // Repo-level quality is untouched by the gate: it never needed evidence
    expect(report).toContain('## Repository Change Signals');
    expect(report).toContain('### Trend');
  });

  it('renders the overlay as soon as one commit carries real evidence', async () => {
    writeFileSync(join(repoPath, 'a.ts'), 'export const a = 1;\n');
    git('git add -A && git commit -q -m "feat: undeclared"');
    writeFileSync(join(repoPath, 'b.ts'), 'export const b = 1;\n');
    git('git add -A && git commit -q -m "feat: declared" -m "AI-Mode: agent"');

    const { report } = await pipeline(['--default-mode', 'agent']);

    // One real agent commit backs the cohort, so it is shown — with the
    // prior's contribution still labelled
    expect(section(report, '## By Autonomy Level')).toMatch(/\| agent \|/);
    expect(report).toContain('assumed)');
  });

  it('withholds the AI-vs-baseline comparison when one side is pure prior', async () => {
    // A declared AI commit and a set of undeclared ones assumed 'none'
    writeFileSync(join(repoPath, 'a.ts'), 'export const a = 1;\n');
    git(
      'git add -A && git commit -q -m "feat: ai" -m "Co-Authored-By: Claude <noreply@anthropic.com>"'
    );
    writeFileSync(join(repoPath, 'b.ts'), 'export const b = 1;\n');
    git('git add -A && git commit -q -m "feat: undeclared"');

    const { report } = await pipeline(['--default-mode', 'none']);

    // The baseline exists only because the prior said so
    expect(report).toContain('**Comparison withheld**');
    expect(report).toContain('placed there by assumption');
    expect(report).not.toContain('| Avg persistence (days) |');
  });

  it('keeps the unknown row: the no-evidence bucket is the honest part', async () => {
    writeFileSync(join(repoPath, 'a.ts'), 'export const a = 1;\n');
    git('git add -A && git commit -q -m "feat: undeclared"');

    // No prior at all: everything stays unknown
    const { report } = await pipeline();

    expect(section(report, '## By Autonomy Level')).toMatch(/\| unknown \|/);
    expect(report).not.toContain('**Comparison withheld**');
  });
});

describe('PR-scoped evidence report', () => {
  it('names unknown commits and suppresses immature repository-time metrics', async () => {
    writeFileSync(join(repoPath, '.aida.json'), JSON.stringify({ defaultMode: 'agent' }));
    writeFileSync(join(repoPath, 'base.ts'), 'export const base = true;\n');
    git('git add -A && git commit -q -m "chore: base"');
    git('git checkout -q -b feature');
    writeFileSync(join(repoPath, 'feature.ts'), 'export const feature = true;\n');
    git('git add -A && git commit -q -m "feat: undeclared PR work"');
    const prHash = execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim();

    await run(createCollectCommand(), [
      '--repo',
      repoPath,
      '--out-dir',
      outDir,
      '--diff-base',
      'main',
    ]);
    await run(createAnalyzeCommand(), ['--out-dir', outDir]);
    await run(createReportCommand(), ['--out-dir', outDir]);

    const report = readFileSync(join(outDir, 'report.md'), 'utf8');
    expect(report).toContain('# AIDA PR Evidence Report');
    expect(report).toContain(`\`${prHash.slice(0, 12)}\``);
    expect(report).toContain('feat: undeclared PR work');
    expect(report).toContain('a repository-wide prior is not evidence');
    expect(report).toContain('defaultMode: agent');

    // A one-commit PR is necessarily too young for time-to-next-touch
    // metrics. Showing 0/0 tables looked precise while saying nothing.
    expect(report).not.toContain('## Repository Change Signals');
    expect(report).not.toContain('### Trend');
    expect(report).not.toContain('## AI vs Baseline');
    expect(report).not.toContain("run 'aida fetch-prs'");

    const info = vi.mocked(console.log).mock.calls.flat().join('\n');
    const warnings = vi.mocked(console.warn).mock.calls.flat().join('\n');
    expect(info).not.toContain('Repo rapid retouch');
    expect(info).not.toContain('Trend:');
    expect(warnings).not.toContain('No baseline cohort');
  });
});
