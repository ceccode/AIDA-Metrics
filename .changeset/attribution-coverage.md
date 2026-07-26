---
'@aida-dev/core': minor
'@aida-dev/metrics': minor
'@aida-dev/cli': minor
---

Attribution coverage as headline metric (#34)

Three-state attribution replaces the silent AI/human binary:

- Every commit is attributed `ai`, `human`, or `unknown` (`tags.attribution`). Message heuristics emit only `ai` or `unknown`: the absence of an AI signal is not evidence of human authorship. `human` will come from explicit declarations (attribution manifest, #10).
- `metrics.json` gains a leading `attribution` block with per-state counts and **coverage** — the share of commits with known provenance — plus a configurable `coverageThreshold` (default 0.7) that flags all metrics as low-confidence when coverage falls below it.
- `baseline` and `delta` are now nullable: when no commits are attributed `human` and no prior assigns the unknowns, AIDA reports "no baseline" instead of silently comparing AI commits against unattributed ones.
- New `defaultAttribution` option (`.aida.json` or `aida analyze --default-attribution`) consciously assigns unknown commits to a cohort (`human` for traditional repos, `ai` for AI-first ones). The prior affects cohorts, never coverage; an assumed baseline is labeled `assumed` in output and report.
- The markdown report opens with an "Attribution Coverage" section and a warning banner when coverage is below threshold.

Breaking (0.x minor): `commit-stream.json` requires the new `tags.attribution` field — rerun `aida collect`. `metrics.json` consumers must handle `baseline: null` / `delta: null` and the renamed baseline semantics (human cohort, not "non-AI").
