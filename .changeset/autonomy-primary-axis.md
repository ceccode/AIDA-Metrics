---
'@aida-dev/core': minor
'@aida-dev/metrics': minor
'@aida-dev/cli': minor
---

Autonomy becomes the primary axis: involvement × evidence, three-state attribution demoted to a projection (#25)

For most teams today AI participates in nearly every commit, so "was AI involved?" trends to *yes* and stops discriminating anything. What still separates risk, cost and quality is **at what autonomy level**. This makes that the model rather than a field alongside the old one.

**Two orthogonal axes.** `mode` (`none`/`autocomplete`/`assisted`/`agent`/`unknown`) is what happened; `evidence` (`declared`/`inferred`/`none`) is how we know. They are separate because they fail separately: `mode: unknown, evidence: inferred` is a real state — we know AI participated, we cannot name the level — and the single-axis model had to misreport it as "no evidence", contradicting the `ai` it had just asserted.

**`attribution` is now derived.** `projectAttribution` is the only place the three states are decided, and a tag can only be built through `tagFromAxes`, so the projection cannot drift from the axes it projects. The headline still reads `ai`/`human`/`automated`/`unknown`, labelled as the projection it is. `unknown` is no longer a fourth kind of attribution: it is exactly `evidence: none`, an invariant now covered by tests in both directions.

**Coverage moved to the evidence axis** — the share of commits with any known provenance, declared or inferred. Numerically near-identical to the old `(ai + human + automated) / total` (on babel: 8.7% either way), because automation already carries inferred evidence. The reframe is honest, not a redefinition that flatters the number.

**`automated` is its own flag**, orthogonal to both axes: known provenance, no author, joins no cohort. The redundant `ai` boolean is gone.

**Breaking — `defaultAttribution` is replaced by `defaultMode`.** The prior now names an autonomy level instead of an AI/human label, and one key covers both moments: the commit hook stamps it at commit time (making new commits `declared`), while `aida analyze` applies it as a prior to older commits with no evidence. A prior joins a cohort but is never evidence — it does not touch the tags and does not raise coverage, so a repo leaning on it still reports how little it knows. Because zod strips unknown keys, a config still carrying `defaultAttribution` would silently stop applying and change cohorts on upgrade; `.aida.json` is now rejected with the translation in the message. `--default-attribution` becomes `--default-mode`.

Schema v2 for both `commit-stream.json` and `metrics.json`: rerun `aida collect`.

Dogfooded on this repo: 137 commits, coverage 100% (declared 72 · inferred 65), 100 agent · 37 automated. That run also caught a bug introduced here — the headline table counted automation's `mode: 'none'` as hand-written, contradicting `byMode`, which excludes it. Per-mode counts now exclude automated commits and the report lists them on their own row.
