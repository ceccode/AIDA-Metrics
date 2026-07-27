---
'@aida-dev/metrics': minor
'@aida-dev/cli': patch
---

Cohort fairness context (#29 step 1, #36 step 1)

`metrics.json` gains a `cohorts` block with, per cohort (AI and baseline):

- **Age stats** (#29): commits, average and median age in days — older cohorts accumulate persistence by default, so comparing raw persistence across cohorts of different ages is misleading.
- **Task mix** (#36): file touches classified as source / tests / migrations / config / docs / generated via path heuristics — a good persistence number may reflect *what* the cohort worked on, not how well.

The markdown report renders a "Cohort Fairness" table; a caveat warns to check it before reading the delta. Also fixed: manifest-excluded commits are never pulled into a cohort by the `defaultAttribution` prior — they were excluded precisely to stay out of both.
