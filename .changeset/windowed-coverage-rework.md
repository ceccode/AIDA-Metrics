---
'@aida-dev/metrics': minor
'@aida-dev/cli': minor
---

Windowed coverage (#52), rework rate (#22), and correct `--version`

**Windowed coverage** — `attribution.recent` reports coverage over a recent window (default 90 days, `--coverage-window`). All-time coverage is a permanent verdict on history that predates adoption; the recent figure answers "are we tagging now?", so it is what drives the low-confidence warning. All-time stays reported as context, and `belowThreshold` keeps its existing all-time meaning, so this is additive — no schema version bump.

**Rework rate** — `persistence.rework` reports the share of AI-touched files modified again within a short window (default 7 days). Right-censoring is handled explicitly: a file too recent to have a determined outcome counts in neither the numerator nor the denominator, and the count of such files is reported. It is file-level, so within-session iteration inflates it — stated in the caveats and README.

**Fix**: `aida --version` reported a hardcoded `0.0.0` regardless of the installed build; it now reports the real package version.
