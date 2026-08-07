---
'@aida-dev/metrics': patch
'@aida-dev/cli': patch
---

Show how many commits a prior placed in each autonomy cohort

Found running AIDA against a freshly adopted repo (ceccode/varano-239, 17 commits): the same report said **`agent 5`** in the observed table and **`agent 16`** in `By Autonomy Level`. Both were correct under their own definition — the first counts what commits declare, the second counts cohort membership after the `defaultMode` prior fills in the 11 commits with no evidence — but nothing in the report said the two tables used different definitions, and a reader takes the larger number for the real one.

The same class of defect as the automated-commit miscount fixed in #25: two tables in one report describing the same commits differently. That fix caught one instance, this catches its sibling.

`ModeStats` now carries `assumed`, and the per-level table renders `16 (11 assumed)` with a line stating that these cohorts include prior-placed commits while the observed table never does. With no prior configured, `assumed` is 0 and the two tables agree exactly — asserted by a test.
