---
'@aida-dev/metrics': minor
'@aida-dev/cli': minor
---

Quality over time: the repo compared with its own past (#77 step 3)

Once AI participates in nearly every commit, "AI vs human" has no second side left to compare against — `No baseline cohort` is the normal outcome, not bad luck. This adds the comparator that still works: the repo against its own history.

`metrics.trend` slices repo-level persistence, rework and coverage by calendar period (month or quarter), **derived from the commit stream in a single run**. A team gets a trend the first time they run AIDA, rather than after months of archiving reports; comparing stored `metrics.json` files remains possible on top of this and would add only what history cannot reconstruct.

**The naive version of this feature is guaranteed to lie**, and two mechanisms prevent it:

- Every period is measured through the same observation window (`--trend-window`, default 30 days), reusing the age-normalization from #29 — applied to time instead of cohorts. Otherwise an older period accumulates survival simply by having existed longer.
- A period is *mature* only once it has been over for that full window. Immature periods are computed and reported, clearly marked, and excluded from every comparison. Without this, **every report ever generated would find quality declining**, because the newest period is always the least observed.

Dogfooded on this repo, where the trap is vivid: the two immature periods show rework 98.1% and 96.7% with persistence under a day — a clock artifact that reads as catastrophic. The mature comparison says the opposite, 41.4% → 27.8% rework between 2026-03 and 2026-04. On varano-239, two months old, AIDA declines to compare at all rather than draw a line through one point.

Cost is negligible: 291ms for 12 periods over a synthetic 20,000-commit, 100,000-file-touch stream — the per-period passes are linear and the trend adds no measurable time to `aida analyze` at any realistic scale.

New flags: `--trend-granularity`, `--trend-window`, `--trend-periods`.
