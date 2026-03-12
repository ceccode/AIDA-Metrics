# @aida/cli

## 0.2.0

### Minor Changes

- 194723a: 4-level AI attribution classification (explicit/implicit/mention/none). Only explicit and implicit commits are counted as AI-assisted, reducing false positives from tool mentions.

  Configurable AI tools via `.aida.json` config file and new CLI flags (`--ai-tool`, `--ai-trailer-domain`). Custom tools benefit from all 4 classification levels.

  Fix: `--ai-pattern` CLI flag was silently ignored due to Commander naming mismatch.

### Patch Changes

- Updated dependencies [194723a]
  - @aida-dev/core@0.6.0
  - @aida-dev/metrics@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [eed6a95]
  - @aida-dev/core@0.5.0
  - @aida-dev/metrics@0.1.6

## 0.1.5

### Patch Changes

- 5d27e31: Accurate merge ratio and multiple fixes

  **@aida-dev/core:**
  - Collect commits from all branches (`--all`) instead of only the default branch
  - Determine `inDefaultBranchAncestry` accurately using `git rev-list`
  - Deduplicate commits reachable from multiple branches
  - Use `git --name-status` for exact file status detection (added/modified/deleted/renamed)

  **@aida-dev/cli:**
  - Remove duplicate `report.json` output (was identical to `metrics.json`)
  - Remove unused `--format` flag from report command

- Updated dependencies [5d27e31]
  - @aida-dev/core@0.4.0
  - @aida-dev/metrics@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [503ef4a]
  - @aida-dev/core@0.3.1
  - @aida-dev/metrics@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [76f5bda]
  - @aida-dev/core@0.3.0
  - @aida-dev/metrics@0.1.3

## 0.1.2

### Patch Changes

- d86d3e2: Fix --since/--until date filters and remove maxCount cap (#4)
- Updated dependencies [d86d3e2]
  - @aida-dev/core@0.2.2
  - @aida-dev/metrics@0.1.2

## 0.1.1

### Patch Changes

- 2200625: Fix ESLint and Prettier configuration for monorepo
- Updated dependencies [2200625]
  - @aida-dev/metrics@0.1.1
  - @aida-dev/core@0.2.1

## 0.1.0

### Minor Changes

- da1d92c: Initial release of AIDA - AI Development Accounting CLI tool

### Patch Changes

- Updated dependencies [da1d92c]
  - @aida/core@0.2.0
  - @aida/metrics@0.1.0
