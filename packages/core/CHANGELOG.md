# @aida/core

## 0.4.0

### Minor Changes

- 5d27e31: Accurate merge ratio and multiple fixes

  **@aida-dev/core:**
  - Collect commits from all branches (`--all`) instead of only the default branch
  - Determine `inDefaultBranchAncestry` accurately using `git rev-list`
  - Deduplicate commits reachable from multiple branches
  - Use `git --name-status` for exact file status detection (added/modified/deleted/renamed)

  **@aida-dev/cli:**
  - Remove duplicate `report.json` output (was identical to `metrics.json`)
  - Remove unused `--format` flag from report command

## 0.3.1

### Patch Changes

- 503ef4a: Fix AI detection for Co-Authored-By trailers in commit body

  simple-git stores git trailers in a separate `body` field. The AI tagger now reads both `message` and `body` to correctly detect Co-Authored-By trailers from Claude, Copilot, ChatGPT, and other AI tools.

## 0.3.0

### Minor Changes

- 76f5bda: Add AI detection for Claude Code, ChatGPT, and Gemini commits

## 0.2.2

### Patch Changes

- d86d3e2: Fix --since/--until date filters and remove maxCount cap (#4)

## 0.2.1

### Patch Changes

- 2200625: Fix ESLint and Prettier configuration for monorepo

## 0.2.0

### Minor Changes

- da1d92c: Initial release of AIDA - AI Development Accounting CLI tool
