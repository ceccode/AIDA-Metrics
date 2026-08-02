---
'@aida-dev/metrics': minor
'@aida-dev/cli': minor
---

Report outcome correlation against the base rate, not as raw counts

A bare count of "AI-caused" reverts or hotfixes is uninterpretable: in a repo where 90% of commits are AI, 90% of reverts being AI means nothing. The previous table showed only counts, which invited exactly the wrong conclusion from correct numbers.

`outcomeCorrelation.reverts.rates` and `.hotfixes.rates` now carry, per cohort, its `share` of the outcome, its `baseRate` (share of authored commits) and the `ratio` between them — 1.00× being exactly what the cohort's size predicts. Automated commits are excluded from both sides, since automation isn't authored work. The report renders share, base rate and ratio side by side, and leads with "read the ratio, not the count".

Found by running AIDA against `anthropics/claude-code-action`, where the raw numbers (3 of 11 reverts, 49 of 140 hotfix antecedents attributed to AI) read as alarming, while the ratios show 1.13× for reverts — no signal — and 1.45× for hotfixes, a real but modest excess.

Additive to the schema; `schemaVersion` unchanged.
