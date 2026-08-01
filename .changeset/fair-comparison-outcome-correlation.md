---
'@aida-dev/core': minor
'@aida-dev/metrics': minor
'@aida-dev/cli': minor
---

Age-normalized fair comparison (#29), within-category comparison (#36), outcome correlation (#26)

**Fair comparison (#29)** — the raw AI vs Baseline table can be misleading when one cohort's commits are systematically older than the other's: an older cohort accumulates persistence simply from clock time. `metrics.json` gains `fairComparison`, recomputing both cohorts' persistence with each file's observation window capped to the younger cohort's average commit age. Reported alongside the raw comparison, never in place of it; null under the same condition as `baseline`.

**Within-category comparison (#36 step 2)** — a pooled delta can hide a task-mix confound (AI mostly writing tests, humans mostly writing source). `metrics.json` gains `byCategory`: persistence per file category (source/tests/migrations/config/docs/generated) for each cohort, with a delta only where both sides touched that category. Always present, useful even without a baseline.

**Outcome correlation (#26)**, scoped to what git can answer — no incidents, no SAST, both would need network access this tool deliberately doesn't have:

- `commit-stream.json`: new `revertsCommit` field, parsed from the full commit body at collect time (`git revert` writes "This reverts commit \<sha\>." — the only reliable link back to what was reverted).
- `metrics.json` gains `outcomeCorrelation`: reverts resolved and attributed to the **reverted** commit's cohort/mode; hotfix-pattern commits (`fix`/`hotfix`/`patch`) linked to the closest prior touch of the same file(s) within a window (default 7 days, `--hotfix-window`) and attributed to that antecedent's cohort/mode. Always present, a repo-level property rather than a cohort comparison.

All three fields are additive; `schemaVersion` stays unchanged per the #53 contract.
