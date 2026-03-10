---
'@aida-dev/core': minor
'@aida-dev/cli': patch
---

Accurate merge ratio and multiple fixes

**@aida-dev/core:**
- Collect commits from all branches (`--all`) instead of only the default branch
- Determine `inDefaultBranchAncestry` accurately using `git rev-list`
- Deduplicate commits reachable from multiple branches
- Use `git --name-status` for exact file status detection (added/modified/deleted/renamed)

**@aida-dev/cli:**
- Remove duplicate `report.json` output (was identical to `metrics.json`)
- Remove unused `--format` flag from report command
