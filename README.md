<h1 align="center">📊 AIDA Metrics</h1>

<p align="center">
  <strong>AI Development Accounting — Track and measure AI-assisted development in your repositories.</strong><br/>
  Move beyond AI hype. Measure what actually ships to production.<br/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@aida-dev/cli"><img src="https://img.shields.io/npm/v/@aida-dev/cli?label=cli&color=blue" alt="npm cli"></a>
  <a href="https://www.npmjs.com/package/@aida-dev/core"><img src="https://img.shields.io/npm/v/@aida-dev/core?label=core&color=blue" alt="npm core"></a>
  <a href="https://github.com/ceccode/AIDA-Metrics/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ceccode/AIDA-Metrics" alt="license"></a>
  <a href="https://github.com/ceccode/AIDA-Metrics/stargazers"><img src="https://img.shields.io/github/stars/ceccode/AIDA-Metrics?style=social" alt="stars"></a>
</p>

<p align="center">
  <a href="#why-aida">Why AIDA</a> •
  <a href="#features">Features</a> •
  <a href="#installation">Install</a> •
  <a href="#usage">Usage</a> •
  <a href="#ai-detection">AI Detection</a> •
  <a href="#metrics">Metrics</a> •
  <a href="#cicd-integration">CI/CD</a> •
  <a href="https://ceccode.github.io/AIDA-Metrics/">Demo</a>
</p>

---

## Why AIDA?

AI coding assistants (Copilot, Cursor, Windsurf, Claude Code, ChatGPT, Gemini, etc.) are increasingly part of the development workflow — but today we lack a structured way to **quantify their real contribution**.

- **CFOs and finance teams** ask: *what part of AI costs can be capitalized as real development effort?*
- **CTOs and engineers** ask: *is AI really saving time and delivering stable code?*

AIDA provides **tangible, auditable metrics** to distinguish between **AI noise** (suggestions discarded, unstable code) and **AI value** (stable, production-ready contributions).

## Features

- **4-Level AI Detection** — Classifies commits as explicit, implicit, mention, or none across Claude Code, Copilot, ChatGPT, Cursor, Windsurf/Devin, Gemini, Codeium
- **Configurable Tools** — Add custom AI tools via `.aida.json` or CLI flags
- **Attribution Coverage** — Four-state provenance (`ai`/`human`/`automated`/`unknown`) with coverage as the headline metric
- **Persistence** — Measure how long AI-generated code survives in your codebase
- **Comparative Baseline** — AI vs non-AI side-by-side with delta, so metrics are interpretable
- **Fast & Deterministic** — Versioned JSON output schemas, so consumers detect breaking changes instead of reading silent `undefined`s
- **CLI-First** — Simple commands for collection, analysis, and reporting
- **CI/CD Ready** — GitHub Actions integration out of the box

## Installation

### Global CLI (Recommended)

```bash
npm install -g @aida-dev/cli
```

### From Source

```bash
git clone https://github.com/ceccode/aida-metrics.git
cd aida-metrics
pnpm install
pnpm build
```

## Core Metrics

1. **Attribution Coverage**  
   Share of commits with known provenance (`ai` / `human` / `automated`), reported first because every other number is only as trustworthy as this one.

2. **Persistence**  
   How long AI-generated code survives in the codebase before being rewritten or removed (file-level survival with censoring).

3. **Comparative Baseline**  
   The same metrics computed per cohort (human baseline, autonomy levels), with a signed delta. Turns raw numbers into interpretable signal — e.g. "AI code is rewritten 17 days sooner than human code in the same repo."

The report outputs a side-by-side table:

```markdown
| Metric                  | AI commits | Human baseline | Delta   |
|-------------------------|------------|----------------|---------|
| Avg persistence (days)  | 45.3       | 62.1           | −16.8   |
```

> ⚠️ Metrics are **evolving**. The goal is not perfect precision, but providing **a baseline for discussion and analysis**.

## Quick Start

### Using Global CLI

```bash
# Install globally
npm install -g @aida-dev/cli

# Navigate to your Git repository
cd /path/to/your/repo

# Collect commits from last 90 days
aida collect --since 90d

# Analyze the data
aida analyze

# Generate reports
aida report
```

### Using from Source

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Collect commits from last 90 days
node packages/cli/dist/index.js collect --since 90d

# Analyze the data
node packages/cli/dist/index.js analyze

# Generate reports
node packages/cli/dist/index.js report
```

## Architecture

This is a TypeScript monorepo with three main packages:

- **`@aida-dev/core`** - Git collection, AI tagging, and data schemas
- **`@aida-dev/metrics`** - Attribution coverage and persistence calculations  
- **`@aida-dev/cli`** - Command-line interface for end users

## CLI Usage

### Commands

#### `aida collect`

Collect commits and generate normalized commit stream:

```bash
aida collect --since 90d --out-dir ./aida-output
```

#### `aida install-hooks`

Install the commit-time mode stamping hook:

```bash
aida install-hooks
```

#### `aida fetch-prs`

Fetch pull request outcomes from the forge API (**opt-in, the only command that uses the network**):

```bash
GITHUB_TOKEN=... aida fetch-prs --github-repo owner/name --since 90d
```

#### `aida analyze`

Calculate attribution coverage and persistence metrics:

```bash
aida analyze --out-dir ./aida-output
```

#### `aida report`

Generate human-readable reports:

```bash
aida report --out-dir ./aida-output
```

### Options

#### `aida collect`

- `--repo <path>` - Repository path (default: current directory)
- `--since <date>` - Start date (ISO or relative like 90d)
- `--until <date>` - End date (ISO or relative)
- `--pr` - PR-scoped analysis (auto-detect base ref from CI env vars)
- `--diff-base <ref>` - Explicit base ref for PR-scoped analysis (e.g., `origin/main`)
- `--ai-pattern <pattern>` - Custom AI detection regex (repeatable)
- `--ai-tool <name>` - Additional AI tool name (repeatable, benefits from 4-level classification)
- `--ai-trailer-domain <domain>` - Additional Co-authored-by domain (repeatable)
- `--ai-bot-blocklist <name>` - Non-AI bot to exclude from trailer matching (repeatable)
- `--default-branch <name>` - Default branch name (auto-detect if omitted)
- `--redact-authors` - Replace author/committer identities with a per-run salted hash (recommended in CI)
- `--out-dir <path>` - Output directory (default: ./aida-output)
- `--verbose` - Verbose logging

#### `aida analyze`

- `--out-dir <path>` - Output directory (default: ./aida-output)
- `--verbose` - Verbose logging

#### `aida report`

- `--out-dir <path>` - Output directory (default: ./aida-output)
- `--verbose` - Verbose logging

#### `aida install-hooks`

- `--repo <path>` - Repository path (default: current directory)
- `--force` - Overwrite an existing unrelated hook
- `--uninstall` - Remove the AIDA hook block
- `--verbose` - Verbose logging

#### `aida fetch-prs`

- `--github-repo <owner/name>` - GitHub repository (default: `$GITHUB_REPOSITORY`)
- `--since <date>` - Only PRs closed after this date (ISO or relative like 90d)
- `--max-prs <n>` - Stop after this many PRs (bounds API usage)
- `--repo <path>` - Repository path, for reading `.aida.json`
- `--out-dir <path>` - Output directory (default: ./aida-output)
- `--verbose` - Verbose logging

Requires `GITHUB_TOKEN`. Without it the command refuses to run and PR acceptance stays **absent** from the report — never a silent 0%.

#### `aida comment`

- `--out-dir <path>` - Output directory (default: ./aida-output)
- `--dry-run` - Print report to stdout instead of posting
- `--verbose` - Verbose logging

## AI Detection

AIDA classifies commits into four attribution levels:

| Level        | ai      | Description                                            |
|--------------|---------|--------------------------------------------------------|
| **explicit** | `true`  | Clear AI authorship — trailers, `[AI]` tag, creation verbs |
| **implicit** | `true`  | AI involvement — suggestion/help language               |
| **mention**  | `false` | Tool referenced but not used — "fix copilot bug"       |
| **none**     | `false` | No AI reference                                        |

### Explicit Detection (high confidence)

- Git trailers: `AI: true`, `X-AI: true`
- Co-authors: `Co-authored-by` with known AI domains (`anthropic.com`, `openai.com`, `github.com`) or `*bot*`
- `[AI]` / `[ai]` tags
- Creation verbs + tool name: "generated by copilot", "written with claude"

Non-AI automation bots (`dependabot`, `renovate`, `github-actions`, `greenkeeper`, `snyk-bot`, `mergify`, `imgbot`, `allcontributors`) are excluded from trailer matching by default, so their commits are not miscounted as AI. Extend the list via `botBlocklist` in `.aida.json` or `--ai-bot-blocklist`.

### Implicit Detection

- Suggestion/help verbs + tool name: "copilot suggestions", "with help from claude"

### Mention (not counted as AI)

- Tool name in non-attribution context: "fix copilot bug", "add cursor support"
- Bare tool name without verb context

### Supported Tools (built-in)

`copilot`, `cursor`, `windsurf`, `codeium`, `claude`, `chatgpt`, `gemini`

### Commit-Time Mode Stamping (git hook)

The manifest is retroactive; a hook is **prospective** — it declares provenance at the moment the commit is made, turning `declared` from the exception into the norm ([#61](https://github.com/ceccode/AIDA-Metrics/issues/61)).

```bash
aida install-hooks          # writes .git/hooks/prepare-commit-msg
aida install-hooks --uninstall
```

The hook appends an `AI-Mode:` trailer when the mode is known:

```
feat: add rate limiting

AI-Mode: agent
```

| Mode | Meaning |
|------|---------|
| `none` | Hand-written — the only mechanism that declares **human** authorship at commit time |
| `autocomplete` | Line-level suggestions |
| `assisted` | Supervised pair-programming |
| `agent` | Autonomous, multi-file work |

Resolution order: **`AIDA_MODE`** env var (explicit and reliable — set it in your agent, wrapper, or shell alias) → auto-detection of known agent environments (best-effort convenience) → `defaultMode` in `.aida.json` → **nothing**. When the mode is unknown the hook writes no trailer at all: an absent declaration honestly means unknown, while a guessed one would be a fabrication.

```bash
AIDA_MODE=agent git commit -m "feat: ..."
```

The hook is self-contained POSIX shell with no dependency on `aida` being installed, never blocks a commit whatever happens inside it, refuses to overwrite a hook it didn't write (unless `--force`), and removes only its own block on uninstall.

**Honest limit**: a hook is voluntary and local to each clone. It shrinks the unknown bucket, it does not eliminate it — someone who doesn't install it, or unsets the variable, is invisible to it.

### Attribution Manifest (`aida-attribution.json`)

Heuristics only see what commit messages admit to. The manifest lets you declare attribution **retroactively and explicitly** — for commits made before your team adopted trailers, or to correct heuristic false positives. Place it at the repo root; `aida collect` picks it up automatically ([#10](https://github.com/ceccode/AIDA-Metrics/issues/10)).

```json
{
  "version": "1.0",
  "tool": "windsurf",
  "model": "claude-opus",
  "mode": "agent",
  "note": "Commits made before Co-Authored-By trailers were adopted.",
  "ai_assisted_commits": [
    { "hash": "2f972ace3ff158fbe272d2850e879008abb0b197", "message": "first commit" },
    { "hash": "9f8e7d6c5b4a39281706f5e4d3c2b1a09876fedc", "message": "feat: inline suggestion", "mode": "autocomplete" }
  ],
  "human_authored_commits": [
    { "hash": "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b", "message": "fix: hand-written hotfix" }
  ],
  "excluded_commits": [
    { "hash": "1be7b68039b5156881c080def855c7d4dd30698d", "message": "chore: release packages", "reason": "Automated by changesets" }
  ]
}
```

| List | Effect |
|------|--------|
| `ai_assisted_commits` | Attribution `ai`, level `explicit`, source `manifest` |
| `human_authored_commits` | Attribution `human`, source `manifest` — the way to build a real human baseline |
| `excluded_commits` | Declares attribution `automated` (overrides heuristics) — for automation the auto-detection misses (bots not in the blocklist, templates) |
| `mode` (top-level or per-entry) | Declares the autonomy level of `ai_assisted_commits`: `autocomplete` \| `assisted` \| `agent` ([#25](https://github.com/ceccode/AIDA-Metrics/issues/25)). Per-entry beats top-level. A manifest mode is `declared` evidence; without one, AIDA infers a coarse mode from the tool named in trailers (`inferred`) |

Precedence: in-commit evidence beats retroactive declarations. A commit with an explicit AI trailer stays `ai` even if the manifest declares it human (with a warning); `excluded_commits` always wins, since it exists to correct heuristic false positives. Full hashes are matched exactly (`message` is documentation only); an invalid manifest logs a warning and is ignored — it never fails `collect`.

### Privacy: no leaderboards

AIDA compares **cohorts of commits, never people**. This is a design constraint, not a default:

- No per-author metric will ever ship. Requests for per-developer breakdowns are out of scope by policy, not by omission.
- `commit-stream.json` carries author identities so identity-based detection (bots, #39) can work — but that file travels: committed to CI, uploaded as an artifact. Pass `--redact-authors` (or set `redactAuthors` in `.aida.json`) to replace names and emails with a **per-run salted hash**: stable within one output file, so grouping still works, but not reversible to a person and not correlatable across runs.
- Redaction runs *after* detection, so enabling it costs no accuracy.

Git history itself is not anonymous, so nobody can stop a determined manager from writing their own script. What AIDA can do is refuse to make it convenient ([#35](https://github.com/ceccode/AIDA-Metrics/issues/35)).

### Configuration File (`.aida.json`)

Place a `.aida.json` file in your project root to add custom tools, trailer domains, and patterns:

```json
{
  "tools": ["devbot", "codyai", "internal-copilot"],
  "trailerDomains": ["mycompany\\.com"],
  "botBlocklist": ["acme-ci-bot"],
  "patterns": ["my-custom-regex"],
  "defaultAttribution": "unknown",
  "coverageThreshold": 0.7
}
```

| Field | Description |
|-------|-------------|
| `tools` | Additional AI tool names — benefits from all 4 classification levels |
| `trailerDomains` | Additional domains for `Co-authored-by` trailer matching |
| `botBlocklist` | Additional non-AI bots to exclude from `Co-authored-by` trailer matching |
| `patterns` | Raw regex patterns (treated as explicit) |
| `defaultAttribution` | Prior applied to unattributed commits at analysis time: `ai`, `human`, or `unknown` (default). With `unknown`, unattributed commits join no cohort — AIDA does not invent a comparison. This repo sets `ai`: it is AI-written with human review. |
| `coverageThreshold` | Attribution coverage below this fraction (default `0.7`) flags all metrics as low-confidence |
| `defaultMode` | Autonomy mode the commit hook stamps when nothing else determines it: `none` \| `autocomplete` \| `assisted` \| `agent` ([#61](https://github.com/ceccode/AIDA-Metrics/issues/61)). Absent means leave unknown rather than guess |
| `redactAuthors` | Replace author/committer identities in `commit-stream.json` with a per-run salted hash (default `false`; recommended in CI) |

### CLI Flags

Override or supplement `.aida.json` via CLI:

```bash
aida collect --ai-tool "devbot" --ai-tool "codyai"
aida collect --ai-trailer-domain "mycompany\\.com"
aida collect --ai-bot-blocklist "acme-ci-bot"
aida collect --ai-pattern "my-custom-regex"
aida analyze --default-attribution human --coverage-threshold 0.8
```

## Metrics

### Attribution Coverage

The headline metric ([#34](https://github.com/ceccode/AIDA-Metrics/issues/34)). Every commit gets a four-state attribution: `ai` (explicit/implicit detection or manifest), `human` (explicit declaration via manifest), `automated` (provenance-known automation, [#39](https://github.com/ceccode/AIDA-Metrics/issues/39) — merge commits and known bots auto-detected at collect time, or manifest `excluded_commits`; counts toward coverage, joins no cohort), or `unknown` (no signal — the absence of an AI tag is *not* evidence of human authorship).

**Coverage** = share of commits with known provenance (`ai` + `human` + `automated`). It is reported first in every output, because every other number is only as trustworthy as coverage says it is. Below `coverageThreshold` (default 70%), the report carries a low-confidence warning.

`defaultAttribution` lets a team consciously assign unattributed commits to a cohort (`human` for traditional repos, `ai` for AI-first ones). The prior affects cohort metrics but never coverage: unknown stays unknown in the attribution block, and an assumed baseline is labeled as such.

### By Autonomy Level

Merge ratio and persistence computed per autonomy mode (`agent` / `assisted` / `autocomplete` / `none`) — the comparison that stays meaningful when everything is AI-assisted ([#25](https://github.com/ceccode/AIDA-Metrics/issues/25)). Automated commits are excluded; modes with no commits are `null`.

### PR Acceptance

Whether AI-written work is **accepted**, measured from the forge API ([#51](https://github.com/ceccode/AIDA-Metrics/issues/51)): merged vs closed-unmerged pull requests, broken down by attribution and autonomy level.

This is the successor to the removed merge ratio. The difference is the data source: a forge never deletes a closed PR, so the negative outcome is observable — while git history erases it.

Two deliberate properties:

- **Opt-in and additive.** `aida fetch-prs` is the only command that touches the network; everything else stays git-only and offline. Without a token the metric is absent, with a caveat saying so.
- **No author identity is ever fetched or stored.** `pr-stream.json` holds PR numbers, outcomes, dates, and the attribution of the PR's own commits — nothing that names anyone ([#35](https://github.com/ceccode/AIDA-Metrics/issues/35)).

PRs are attributed from **their own commit messages as returned by the API**, not from a join against local git. That is what makes this work for squash-merged PRs whose branches no longer exist — the exact case where git-based measurement failed.

### Why there is no Merge Ratio

Early versions shipped a merge ratio ("% of AI commits that land on the default branch"). We removed it ([#20](https://github.com/ceccode/AIDA-Metrics/issues/20)) because git history structurally cannot answer that question honestly:

- **Squash merges destroy the numerator's evidence** — branch commits vanish from history, so unmerged work disappears.
- **Survivorship bias destroys the denominator** — abandoned branches get deleted, so discarded work leaves `git log --all` entirely. The ratio trends toward 100% for everyone and discriminates nothing.

A rough metric with visible error bars is worth shipping; a metric whose data source systematically deletes the negative outcomes is not. The honest successor is a **PR acceptance rate** built on forge APIs (GitHub/GitLab), where declined PRs are never deleted — planned as a separate metric.

### Persistence (MVP)

File-level survival: days from the first target-cohort touch of a file until the **first subsequent modification** (or deletion) by any commit.

- Files never modified again are **censored** at collection time — they survived the whole observation window, the best possible outcome (not zero). The report shows how many.
- **Migrations and generated files** (lockfiles, changelogs, snapshots) are excluded by default: their lifecycle is convention-driven — append-only or churned on every release — and carries no quality signal either way. They still appear in the task-mix table.
- Buckets: 0-1d, 2-7d, 8-30d, 31-90d, 90d+, with average and median survival times.
- Known roughness: multi-commit sessions touching the same file produce short survivals (the clock starts at the first touch); line-level tracking ([#23](https://github.com/ceccode/AIDA-Metrics/issues/23)) will refine this.

### Comparative Baseline

Both merge ratio and persistence are computed for the human cohort as well.  
The `metrics.json` output includes `baseline` (human cohort) and `delta` (AI minus human) sections.  
The markdown report renders a side-by-side comparison table at the top.  
If no commits are attributed `human` and no `defaultAttribution` prior assigns the unknowns, `baseline` and `delta` are `null`: AIDA does not invent a comparison cohort.

### Known Limits

These metrics are honest approximations, not ground truth. Read the numbers with these caveats in mind:

- **Detection is voluntary** — AIDA only sees what commits admit to. Untagged AI code lands in the `unknown` bucket, and attribution coverage ([#34](https://github.com/ceccode/AIDA-Metrics/issues/34)) reports how big that bucket is instead of hiding it; the attribution manifest ([#10](https://github.com/ceccode/AIDA-Metrics/issues/10)) lets you shrink it retroactively. But the tool still cannot see through a commit that lies.
- **Git can't see discarded work** — squash merges and deleted branches erase unmerged commits, which is why the merge ratio was removed entirely rather than patched ([#20](https://github.com/ceccode/AIDA-Metrics/issues/20)). PR acceptance ([#51](https://github.com/ceccode/AIDA-Metrics/issues/51)) answers the question from the forge API instead.
- **The attribution manifest does not apply to PR commits** — manifest entries are keyed by hash, and a squash-merged PR's original commits have different hashes from what landed on the default branch. PR-level attribution therefore relies on trailers alone, so a repo that adopted trailers late will see more `unknown` PRs than `unknown` commits.
- **Persistence is file-level** — one AI-touched line marks the whole file as AI-touched; line-level tracking via `git blame` is planned ([#23](https://github.com/ceccode/AIDA-Metrics/issues/23)).
- **Cohort age skews persistence** — older commits have had more time to accumulate survival. The report now shows each cohort's age so you can judge fairness; normalization is still open ([#29](https://github.com/ceccode/AIDA-Metrics/issues/29)).
- **Task mix skews persistence** — AI is often pointed at boilerplate, tests, and migrations, which survive longer because nobody has a reason to touch them. The report now shows each cohort's file-category mix; within-category comparison is still open ([#36](https://github.com/ceccode/AIDA-Metrics/issues/36)).

## Output Files

- `commit-stream.json` - Normalized commit data with four-state attribution and autonomy mode
- `metrics.json` - Attribution coverage, persistence, per-cohort and per-autonomy-level metrics
- `pr-stream.json` - PR outcomes and per-PR attribution (only when `aida fetch-prs` ran)
- `report.md` - Human-readable Markdown report

### Schema versioning

Both JSON files carry a `schemaVersion` ([#53](https://github.com/ceccode/AIDA-Metrics/issues/53)). The contract:

- **Additive changes** (a new field) do **not** bump the version — consumers keep working.
- **Removing a field, renaming it, or changing its meaning** bumps `schemaVersion`.
- Readers **refuse** a version they don't understand rather than parsing it half-way: `aida analyze` on a stale `commit-stream.json` fails with `Rerun 'aida collect'`, not a silent wrong result.

Current: `commit-stream.json` v1, `metrics.json` v1, `pr-stream.json` v1.

## CI/CD Integration

### GitHub Actions (with PR comments)

```yaml
- name: Install AIDA
  run: npm install -g @aida-dev/cli

- name: Run AIDA Analysis
  run: |
    aida collect --pr
    aida analyze
    aida report
    aida comment
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Upload Reports
  uses: actions/upload-artifact@v4
  with:
    name: aida-reports
    path: aida-output/
```

`aida comment` auto-detects the CI provider and posts the report as a PR comment. On subsequent pushes, it **updates** the existing comment instead of creating duplicates.

Use `--dry-run` to print the report to stdout without posting.

### PR-Scoped vs Time-Based Analysis

Use `--pr` for PR-specific metrics (analyzes only commits in the current PR):

```bash
aida collect --pr              # Auto-detect base ref from CI env vars
aida collect --diff-base origin/main  # Explicit base ref
```

Or use `--since` for time-based analysis:

| Approach | `--since` | Best for |
|----------|-----------|----------|
| Per-PR | `--pr` | PR-specific metrics (recommended) |
| Sprint report | `14d` or `30d` | Sprint retrospectives, scheduled runs |
| Monthly audit | `90d` | Management/finance reporting |
| Full history | *(omit)* | One-time baseline analysis |

### GitLab CI

```yaml
aida_analysis:
  script:
    - npm install -g @aida-dev/cli
    - aida collect --since 30d && aida analyze && aida report
  artifacts:
    paths:
      - aida-output/
```

> GitLab MR comments coming soon — see [#16](https://github.com/ceccode/AIDA-Metrics/issues/16). Bitbucket: [#17](https://github.com/ceccode/AIDA-Metrics/issues/17).

## Repository Structure

```bash
/aida-metrics
├── packages/
│   ├── cli/           # @aida-dev/cli
│   ├── core/          # @aida-dev/core
│   └── metrics/       # @aida-dev/metrics
├── .github/workflows/ # CI/CD automation
└── docs/             # Landing page (GitHub Pages)
```

## Roadmap

- **v0.1** ✅ Git-based metrics (Merge Ratio + Persistence).  
- **v0.2** ✅ AI detection for Claude Code, ChatGPT, Gemini, Copilot, Cursor, Windsurf, Codeium.  
- **v0.3** ✅ Attribution classification: explicit / implicit / mention / none ([#7](https://github.com/ceccode/AIDA-Metrics/issues/7)).  
- **v0.4** ✅ PR comment integration for GitHub Actions.  
- **v0.5** ✅ PR-scoped analysis with `--pr` and `--diff-base` flags ([#18](https://github.com/ceccode/AIDA-Metrics/issues/18)).  
- **v0.6** ✅ Comparative baseline — AI vs non-AI metrics with delta ([#19](https://github.com/ceccode/AIDA-Metrics/issues/19)).  
- **v0.7** ✅ Exclude non-AI bots (dependabot, renovate, …) from trailer matching, with configurable blocklist ([#21](https://github.com/ceccode/AIDA-Metrics/issues/21)).  
- **v0.8** ✅ Attribution coverage as headline metric — three-state `ai`/`human`/`unknown`, `defaultAttribution` prior, nullable baseline ([#34](https://github.com/ceccode/AIDA-Metrics/issues/34)).  
- **v0.9** ✅ Attribution manifest — retroactive `ai`/`human`/`excluded` declarations via `aida-attribution.json` ([#10](https://github.com/ceccode/AIDA-Metrics/issues/10)).  
- **v0.10** ✅ Cohort fairness context — age stats ([#29](https://github.com/ceccode/AIDA-Metrics/issues/29), step 1) and task mix by file category ([#36](https://github.com/ceccode/AIDA-Metrics/issues/36), step 1) per cohort.  
- **v0.11** ✅ Autonomy mode collection — `mode` × `evidence` per commit, manifest declarations, tool inference ([#25](https://github.com/ceccode/AIDA-Metrics/issues/25), step 1).  
- **v0.12** ✅ `automated` attribution state — merge commits and bots auto-detected, coverage counts known automation ([#39](https://github.com/ceccode/AIDA-Metrics/issues/39)).  
- **v0.13** ✅ Per-mode cohort metrics — persistence per autonomy level ([#25](https://github.com/ceccode/AIDA-Metrics/issues/25), step 2).  
- **v0.14** ✅ Merge ratio removed — git cannot measure it honestly; PR acceptance rate via forge APIs is the successor ([#20](https://github.com/ceccode/AIDA-Metrics/issues/20)).  
- **v0.15** ✅ Author redaction ([#35](https://github.com/ceccode/AIDA-Metrics/issues/35)) and synthetic PR merge commit fix ([#40](https://github.com/ceccode/AIDA-Metrics/issues/40)).  
- **v0.16** ✅ Versioned output schemas with reader-side version gate, plus end-to-end CLI tests and `pnpm typecheck` in CI ([#53](https://github.com/ceccode/AIDA-Metrics/issues/53)).  
- **v0.17** ✅ PR acceptance rate via forge APIs — opt-in `aida fetch-prs`, the honest successor to merge ratio ([#51](https://github.com/ceccode/AIDA-Metrics/issues/51)).  
- **v0.18** ✅ Commit-time mode stamping via git hook — `AI-Mode` trailer, `declared` evidence at the source ([#61](https://github.com/ceccode/AIDA-Metrics/issues/61)).  
- **Next** → Autonomy as primary axis ([#25](https://github.com/ceccode/AIDA-Metrics/issues/25) step 3, once declared data accumulates), windowed coverage ([#52](https://github.com/ceccode/AIDA-Metrics/issues/52)), GitLab ([#16](https://github.com/ceccode/AIDA-Metrics/issues/16)) / Bitbucket ([#17](https://github.com/ceccode/AIDA-Metrics/issues/17)) PR providers.  
- **Next** → Rework rate ([#22](https://github.com/ceccode/AIDA-Metrics/issues/22)), line-level persistence via blame ([#23](https://github.com/ceccode/AIDA-Metrics/issues/23)).  
- **Next** → Outcome correlation ([#26](https://github.com/ceccode/AIDA-Metrics/issues/26)), cost metrics ([#27](https://github.com/ceccode/AIDA-Metrics/issues/27)).  
- **Next** → GitLab ([#16](https://github.com/ceccode/AIDA-Metrics/issues/16)) and Bitbucket ([#17](https://github.com/ceccode/AIDA-Metrics/issues/17)) PR comment providers.  
- **v1.0** → Dashboard / GitHub Action for continuous tracking.  

### Direction: from AI detection to AI accountability

In an AI-first world, "was this commit written by AI?" is becoming the wrong question — the honest answer trends toward "yes, mostly". AIDA's direction reflects that:

- **Three-state attribution** — `ai` / `human` / `unknown` instead of forcing unattributed commits into a binary bucket ([#34](https://github.com/ceccode/AIDA-Metrics/issues/34)). Attribution **coverage** becomes the headline metric ("62% attributed · 38% unknown" is a data-quality signal, not something to hide inside a default) — because the unknown bucket grows fastest exactly where the numbers are taken most seriously. A configurable `defaultAttribution` prior will let AI-first teams opt into "AI unless stated otherwise" — consciously, instead of the tool silently assuming either way.
- **Quality over adoption** — the durable question is not "how much code is AI?" but "does AI code hold up?": rework rate ([#22](https://github.com/ceccode/AIDA-Metrics/issues/22)), line-level survival ([#23](https://github.com/ceccode/AIDA-Metrics/issues/23)), outcome correlation ([#26](https://github.com/ceccode/AIDA-Metrics/issues/26)).
- **Autonomy over the binary** — autocomplete vs assisted vs agent ([#25](https://github.com/ceccode/AIDA-Metrics/issues/25)) is the axis that will replace AI/non-AI.
- **Shrink the unknown at the source** — the attribution manifest ([#10](https://github.com/ceccode/AIDA-Metrics/issues/10)) makes attribution declarative retroactively; commit-time stamping via git hooks ([#61](https://github.com/ceccode/AIDA-Metrics/issues/61)) makes it automatic going forward. Both shipped.
- **Cohorts, not people** — AIDA compares groups of commits, never developers. No per-author aggregation will ever ship, and author identity can be redacted from output artifacts ([#35](https://github.com/ceccode/AIDA-Metrics/issues/35), shipped) so the data model doesn't hand anyone a leaderboard for free.

## Contributing

This is just the starting point. We are looking for contributors who can help with:  

- Designing robust metrics  
- Building integrations
- Improving analysis pipelines  
- Validating approaches with real-world projects  

### Git Workflow

We use a simple, main-branch workflow with automated publishing:

1. **Create Feature Branch**

   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

2. **Make Changes & Commit**

   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. **Add Changeset** (for version bumps)

   ```bash
   pnpm changeset
   # Select packages to version
   # Choose version bump type (patch/minor/major)
   # Add description for changelog
   ```

4. **Open Pull Request**
   - Target: `main` branch
   - Include changeset file if versioning needed
   - Describe changes and testing

5. **Merge & Auto-Publish**
   - Once merged, GitHub Actions automatically publishes to NPM
   - Feature branch gets deleted after merge

### AI Attribution Convention

If you use AI assistants (Claude, Copilot, ChatGPT, Cursor, Windsurf, etc.) while contributing, please add a `Co-Authored-By` trailer to your commit messages:

```bash
git commit -m "feat: add new feature

Co-Authored-By: Claude <noreply@anthropic.com>"
```

Common trailers:

- `Co-Authored-By: Claude <noreply@anthropic.com>`
- `Co-Authored-By: GitHub Copilot <noreply@github.com>`
- `Co-Authored-By: ChatGPT <noreply@openai.com>`

This helps AIDA accurately track AI contribution metrics — and it's what we're building this tool to measure.

### Branch Rules

- **Main branch only** - no separate dev/release branches
- **Feature branches** - `feat/xyz`, `fix/abc`, `docs/update-readme`
- **Clean history** - squash merge preferred
- **Auto-publish** - changesets trigger NPM releases

Feel free to open an **Issue** or start a **Discussion**.

## Call to Action

The future of software development is hybrid – humans and AI agents working together.  
To account for it properly, we need better metrics.  

**Join us in building AIDA.**

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Format code
pnpm format

# Lint code
pnpm lint
```

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm with workspaces
- **Build**: tsup (ESM output)
- **Testing**: vitest with coverage
- **Git**: simple-git for repository analysis
- **Validation**: zod for schema validation
- **CLI**: commander for command-line interface

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## License

MIT License
