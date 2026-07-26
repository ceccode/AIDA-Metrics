# @aida/core

## 0.9.0

### Minor Changes

- 5ddbaf4: Attribution coverage as headline metric (#34)

  Three-state attribution replaces the silent AI/human binary:
  - Every commit is attributed `ai`, `human`, or `unknown` (`tags.attribution`). Message heuristics emit only `ai` or `unknown`: the absence of an AI signal is not evidence of human authorship. `human` will come from explicit declarations (attribution manifest, #10).
  - `metrics.json` gains a leading `attribution` block with per-state counts and **coverage** — the share of commits with known provenance — plus a configurable `coverageThreshold` (default 0.7) that flags all metrics as low-confidence when coverage falls below it.
  - `baseline` and `delta` are now nullable: when no commits are attributed `human` and no prior assigns the unknowns, AIDA reports "no baseline" instead of silently comparing AI commits against unattributed ones.
  - New `defaultAttribution` option (`.aida.json` or `aida analyze --default-attribution`) consciously assigns unknown commits to a cohort (`human` for traditional repos, `ai` for AI-first ones). The prior affects cohorts, never coverage; an assumed baseline is labeled `assumed` in output and report.
  - The markdown report opens with an "Attribution Coverage" section and a warning banner when coverage is below threshold.

  Breaking (0.x minor): `commit-stream.json` requires the new `tags.attribution` field — rerun `aida collect`. `metrics.json` consumers must handle `baseline: null` / `delta: null` and the renamed baseline semantics (human cohort, not "non-AI").

- 9130689: Git data accuracy (#24):
  - Real committer name/email/date are now collected via a custom `git log --format` (previously duplicated from author fields, wrong after rebase/squash).
  - Commit metadata, parents, and diff stats are fetched in two batched `git log` passes instead of two git processes per commit — collection is dramatically faster on large repos.
  - Removed the misleading `branch` field from the `Commit` schema: it was always set to the default branch, even for commits collected from other branches.
  - New caveat documents that time-windowed collection (`--since`) also windows the ancestry check.

## 0.8.0

### Minor Changes

- 938a72d: Exclude non-AI automation bots from `Co-authored-by` trailer matching. Commits from `dependabot`, `renovate`, `github-actions`, `greenkeeper`, `snyk-bot`, `mergify`, `imgbot`, and `allcontributors` are no longer miscounted as explicit AI contributions.

  The blocklist is extensible via `botBlocklist` in `.aida.json` and the new `--ai-bot-blocklist` CLI flag.

  Also fixes PR-scoped collection (`--pr` / `--diff-base`) in CI checkouts: the default-branch commit set is now computed against the diff base ref (e.g. `origin/main`) instead of the bare branch name, which is unresolvable in a detached PR checkout.

## 0.7.0

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

## 0.6.0

### Minor Changes

- 194723a: 4-level AI attribution classification (explicit/implicit/mention/none). Only explicit and implicit commits are counted as AI-assisted, reducing false positives from tool mentions.

  Configurable AI tools via `.aida.json` config file and new CLI flags (`--ai-tool`, `--ai-trailer-domain`). Custom tools benefit from all 4 classification levels.

  Fix: `--ai-pattern` CLI flag was silently ignored due to Commander naming mismatch.

## 0.5.0

### Minor Changes

- eed6a95: Remove bare 'ai' keyword from default detection patterns to eliminate false positives. Add `aiConfidence` field ('high' | 'low' | 'none') to tag results — trailers and explicit [AI] tags are high confidence, keyword-only matches are low.

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
