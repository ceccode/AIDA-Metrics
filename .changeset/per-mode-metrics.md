---
'@aida-dev/metrics': minor
'@aida-dev/cli': patch
---

Per-mode cohort metrics (#25, step 2)

`metrics.json` gains a `byMode` block: merge ratio and persistence computed per autonomy level (`agent` / `assisted` / `autocomplete` / `none` / `unknown`), `null` for modes with no commits. Automated commits are excluded — automation is not authored code. The report renders a "By Autonomy Level" table.

This is the comparison that stays meaningful in an AI-first world: agent vs assisted vs autocomplete, instead of AI vs human.
