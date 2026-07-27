# @aida/cli

## 0.6.1

### Patch Changes

- 0f4fb0d: Attribution manifest support (#10)

  `aida collect` now reads an optional `aida-attribution.json` at the repo root to apply retroactive, explicit attribution declarations on top of message heuristics:
  - `ai_assisted_commits` → attribution `ai`, level `explicit`, source `manifest`
  - `human_authored_commits` (new) → attribution `human` — the first way to build a real human baseline for the three-state model
  - `excluded_commits` → forces attribution `unknown`, overriding heuristics (for automation such as release bots and merge commits)

  Precedence: in-commit evidence beats retroactive declarations — a commit with an explicit AI signal stays `ai` even if declared human (with a warning); `excluded_commits` always wins. Invalid manifests log a warning and are ignored; they never fail `collect`. Manifest hashes that match no collected commit are reported informationally.

- 690fc53: Autonomy mode collection (#25, step 1)

  First step of the involvement × evidence model. Every commit now carries:
  - **`tags.mode`**: `none` | `autocomplete` | `assisted` | `agent` | `unknown` — what level of AI participated. The durable axis in an AI-first world.
  - **`tags.modeEvidence`**: `declared` (manifest `mode` field — top-level default or per-entry override) | `inferred` (derived from the tool named in trailers: Claude Code/Claude → agent, Copilot → autocomplete, Cursor/Windsurf/Codeium/ChatGPT/Gemini → assisted) | `none` (no signal).

  Manifest-declared human commits get `mode: none, declared`. `metrics.json` reports per-mode and per-evidence counts in the attribution block; the report shows an Autonomy line under the coverage headline. Per-mode cohort metrics are step 2.

- 027ff40: Cohort fairness context (#29 step 1, #36 step 1)

  `metrics.json` gains a `cohorts` block with, per cohort (AI and baseline):
  - **Age stats** (#29): commits, average and median age in days — older cohorts accumulate persistence by default, so comparing raw persistence across cohorts of different ages is misleading.
  - **Task mix** (#36): file touches classified as source / tests / migrations / config / docs / generated via path heuristics — a good persistence number may reflect _what_ the cohort worked on, not how well.

  The markdown report renders a "Cohort Fairness" table; a caveat warns to check it before reading the delta. Also fixed: manifest-excluded commits are never pulled into a cohort by the `defaultAttribution` prior — they were excluded precisely to stay out of both.

- Updated dependencies [0f4fb0d]
- Updated dependencies [690fc53]
- Updated dependencies [027ff40]
  - @aida-dev/core@0.10.0
  - @aida-dev/metrics@0.5.0

## 0.6.0

### Minor Changes

- 5ddbaf4: Attribution coverage as headline metric (#34)

  Three-state attribution replaces the silent AI/human binary:
  - Every commit is attributed `ai`, `human`, or `unknown` (`tags.attribution`). Message heuristics emit only `ai` or `unknown`: the absence of an AI signal is not evidence of human authorship. `human` will come from explicit declarations (attribution manifest, #10).
  - `metrics.json` gains a leading `attribution` block with per-state counts and **coverage** — the share of commits with known provenance — plus a configurable `coverageThreshold` (default 0.7) that flags all metrics as low-confidence when coverage falls below it.
  - `baseline` and `delta` are now nullable: when no commits are attributed `human` and no prior assigns the unknowns, AIDA reports "no baseline" instead of silently comparing AI commits against unattributed ones.
  - New `defaultAttribution` option (`.aida.json` or `aida analyze --default-attribution`) consciously assigns unknown commits to a cohort (`human` for traditional repos, `ai` for AI-first ones). The prior affects cohorts, never coverage; an assumed baseline is labeled `assumed` in output and report.
  - The markdown report opens with an "Attribution Coverage" section and a warning banner when coverage is below threshold.

  Breaking (0.x minor): `commit-stream.json` requires the new `tags.attribution` field — rerun `aida collect`. `metrics.json` consumers must handle `baseline: null` / `delta: null` and the renamed baseline semantics (human cohort, not "non-AI").

### Patch Changes

- Updated dependencies [5ddbaf4]
- Updated dependencies [9130689]
  - @aida-dev/core@0.9.0
  - @aida-dev/metrics@0.4.0

## 0.5.0

### Minor Changes

- 938a72d: Exclude non-AI automation bots from `Co-authored-by` trailer matching. Commits from `dependabot`, `renovate`, `github-actions`, `greenkeeper`, `snyk-bot`, `mergify`, `imgbot`, and `allcontributors` are no longer miscounted as explicit AI contributions.

  The blocklist is extensible via `botBlocklist` in `.aida.json` and the new `--ai-bot-blocklist` CLI flag.

  Also fixes PR-scoped collection (`--pr` / `--diff-base`) in CI checkouts: the default-branch commit set is now computed against the diff base ref (e.g. `origin/main`) instead of the bare branch name, which is unresolvable in a detached PR checkout.

### Patch Changes

- Updated dependencies [938a72d]
  - @aida-dev/core@0.8.0
  - @aida-dev/metrics@0.3.1

## 0.4.0

### Minor Changes

- Add comparative baseline metrics: compute merge ratio and persistence for both AI and non-AI commits, with baseline and delta in metrics.json and a side-by-side comparison table in report.md.

### Patch Changes

- Updated dependencies
  - @aida-dev/metrics@0.3.0

## 0.3.0

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
  - @aida-dev/metrics@0.2.0

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
