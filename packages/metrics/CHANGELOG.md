# @aida/metrics

## 0.2.0

### Minor Changes

- ### Performance & Quality Improvements
  - **Fix N+1 git operations**: `getDiffStats` now reuses a shared `SimpleGit` instance instead of spawning one per commit
  - **Remove unsafe `any` casts**: typed `gitCommit.body` directly, batch-fetch parents in single git call
  - **Bound rev-list in PR mode**: use `git merge-base` to limit scope instead of fetching entire branch history
  - **Add Zod validation to `readJSON`**: optional schema param for runtime validation at file I/O boundaries
  - **Sanitize GitHub API error messages**: strip tokens and credentials from error output
  - **Add tests**: 19 new tests for `parseRelativeDate`, `getDiffStats`, and `calculatePersistence` (36 total)
  - **Package metadata**: added description, author, license, homepage, repository, keywords, engines to all packages
  - **Remove dead `format` field** from CLIConfig schema

### Patch Changes

- Updated dependencies
  - @aida-dev/core@0.7.0

## 0.1.7

### Patch Changes

- Updated dependencies [194723a]
  - @aida-dev/core@0.6.0

## 0.1.6

### Patch Changes

- Updated dependencies [eed6a95]
  - @aida-dev/core@0.5.0

## 0.1.5

### Patch Changes

- Updated dependencies [5d27e31]
  - @aida-dev/core@0.4.0

## 0.1.4

### Patch Changes

- Updated dependencies [503ef4a]
  - @aida-dev/core@0.3.1

## 0.1.3

### Patch Changes

- Updated dependencies [76f5bda]
  - @aida-dev/core@0.3.0

## 0.1.2

### Patch Changes

- d86d3e2: Fix --since/--until date filters and remove maxCount cap (#4)
- Updated dependencies [d86d3e2]
  - @aida-dev/core@0.2.2

## 0.1.1

### Patch Changes

- 2200625: Fix ESLint and Prettier configuration for monorepo
- Updated dependencies [2200625]
  - @aida-dev/core@0.2.1

## 0.1.0

### Minor Changes

- da1d92c: Initial release of AIDA - AI Development Accounting CLI tool

### Patch Changes

- Updated dependencies [da1d92c]
  - @aida/core@0.2.0
