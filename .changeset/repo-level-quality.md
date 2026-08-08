---
'@aida-dev/metrics': minor
'@aida-dev/cli': patch
---

Repo-level quality block in metrics.json — quality as a property of the repo, not of a cohort (#77, step 1)

First step of the quality-first reframe: `metrics.json` gains a `repo` block with persistence and rework computed over **all authored commits** (everything except automation), cohort-free. It is fully populated at 0% evidence coverage — the normal case per #77's assumption — and is deliberately untouched by the `defaultMode` prior: the prior can move cohorts, but if it could move these numbers, "assume everything is AI" would quietly become "trust the assumption". A test asserts the block is identical with and without the prior.

Additive schema change: new field, no version bump per the #53 contract. The report still renders the cohort views — the report reframe is step 2.
