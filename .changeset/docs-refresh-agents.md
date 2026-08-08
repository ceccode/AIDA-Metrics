---
'@aida-dev/cli': patch
---

Refresh documentation to match the shipped tool, and dogfood our own hook recipe

Six places still described a tool that no longer exists — found by auditing the docs against the four #77 PRs rather than trusting them:

- The **demo site** (`docs/index.html`) advertised **merge ratio** in its terminal demo, a metric removed in v0.14, and led its feature grid with coverage-as-headline. Now shows repo-level quality and a trend line, with the feature cards rewritten around quality-first.
- **`### By Autonomy Level`** claimed merge ratio was computed per mode.
- **`### Comparative Baseline`** claimed merge ratio was computed for the human cohort, and that the comparison table renders "at the top" — it has been below Code Quality since the report reframe.
- **Schema versioning** still said `commit-stream.json v1, metrics.json v1`; both are v2, and `blame-stream.json` is v2 as well. Now states what each bump changed.
- **Output Files** described `metrics.json` without the `repo` and `trend` blocks, and `commit-stream.json` in four-state terms rather than the two axes.

Also: **this repo now follows the `prepare` recipe it recommends** (#75). `scripts/install-hooks.mjs` installs the hook on `pnpm install`, with the one guard the published recipe does not need — AIDA is the CLI here, so on a fresh clone `pnpm install` runs before `pnpm build` and there is nothing to install from yet. It skips with a reason rather than silently, and never fails an install over a hook.

New **`AGENTS.md`** for coding agents: the honesty bar, the dogfood-before-PR and never-stack-PRs agreements, how to stamp provenance truthfully, four behaviours that look like bugs and are not (empty cohorts, priors that are not evidence, immature trend periods, `unknown` as a real answer), and the recurring defect class this project has now found four times — two tables describing the same commits under different definitions without saying so.
