---
'@evidtrail/core': patch
'@evidtrail/metrics': patch
'@evidtrail/cli': patch
---

Observation stops at `--until`: a bounded run no longer reads truncated files as untouched, or a truncated month as mature

Found by an external review, reproduced, and it flatters: with `--until 2 Jan`, a file added on 1 Jan and edited on 4 Jan was reported as having survived a 7-day window untouched (0/1, 0%). The edit had been cut out of the stream, but every elapsed-time measurement still ran to the collection date months later, so "nothing happened" and "we stopped looking" were indistinguishable. The trend inherited the slip: a month cut short by the bound passed the maturity gate and entered the headline comparison with a window it never had.

- **Metrics**: observation ends at the earlier of the collection time and the `until` bound (`observationEndOf`). Persistence, rapid retouch, the recent-coverage window and trend maturity all run to that instant. The artifact records it as `window.observationEnd`.
- **Collect**: `since` and `until` are stored in the stream as the resolved instants, not the flag text. `--until 10d` re-read tomorrow would name a different day, and a metrics artifact must be a pure function of its input.
- **Report**: a bounded run says so next to the change-signals table — files first touched shortly before the bound are *too recent*, not untouched.

Runs without `--until` are unchanged. On external repositories bounded ten days back, files that had been promoted to *eligible* return to *too recent* (aspire: 362 → 723 at 30 days is the direction to expect; exact figures in the pull request).
