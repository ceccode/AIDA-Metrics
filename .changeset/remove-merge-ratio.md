---
'@aida-dev/metrics': minor
'@aida-dev/cli': minor
---

Remove merge ratio (#20)

Git history structurally cannot measure "% of AI commits that land": squash merges erase branch commits (the known #20 bug), and deleted branches erase abandoned work entirely, so the ratio trends toward 100% for every repo and discriminates nothing. Patching squash handling would not fix the survivorship bias — the data source deletes the negative outcomes. Removed rather than patched.

- `metrics.json` no longer has `mergeRatio`; `baseline` is `{assumed, persistence}`, `delta` is persistence-only, `byMode` entries are `{commits, persistence}`.
- Report drops the Merge Ratio section and the merge-ratio rows/columns.
- `commit-stream.json` keeps `inDefaultBranchAncestry` (raw data stays available to consumers).

The honest successor is a PR acceptance rate built on forge APIs, where declined PRs are never deleted — tracked separately.
