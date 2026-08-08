---
'@aida-dev/cli': minor
---

A prior can no longer conjure a cohort overlay out of assumption alone (#77 step 4)

The last step of the quality-first migration. Earlier work made the prior's contribution *visible* — `(N assumed)` next to each cohort size. This stops it from creating an overlay at all: a cohort whose every commit was placed there by `defaultMode` is not a measurement, it is the assumption describing itself with numbers next to it.

- **Per-level rows** in `By Autonomy Level` render only where at least one commit carries real evidence. `unknown` is exempt — it *is* the no-evidence bucket, and reporting its size is the honest part.
- **The AI-vs-baseline comparison is withheld** when either side is pure prior, because a measured cohort against an assumed one yields a delta that describes the prior rather than the repo.
- **Nothing is dropped silently.** When every cohort is gated, the section still renders and explains why, and names the prior responsible — a configured `defaultMode` doing nothing is itself worth knowing. Writing the gate surfaced this: the first implementation made the section vanish, which its own test caught.
- **Cohort Fairness** is gated only when *neither* side has evidence. With one real cohort its age and task mix are information the repo genuinely has, so the table stays as it was.

The gate is on presentation only — every cohort remains in `metrics.json`, so a consumer that wants the prior's view still has it.

Dogfooded on both repos: this one (full evidence) renders the agent cohort unchanged; varano-239 renders `agent 26 (11 assumed)` because 15 commits genuinely declare `agent`, while a synthetic 0%-evidence repo with `--default-mode agent` gets the explained withholding instead of a fabricated table.
