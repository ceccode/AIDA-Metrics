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
- **Merge Ratio** — Track what percentage of AI commits make it to production
- **Persistence** — Measure how long AI-generated code survives in your codebase
- **Comparative Baseline** — AI vs non-AI side-by-side with delta, so metrics are interpretable
- **Fast & Deterministic** — Built for production use with stable JSON schemas
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

1. **Merge Ratio**  
   Percentage of AI-generated code that actually gets merged into the main branch.

2. **Persistence**  
   How long AI-generated code survives in the codebase before being rewritten or removed (file-level proxy).

3. **Comparative Baseline**  
   The same metrics computed for non-AI commits, with a signed delta. Turns raw numbers into interpretable signal — e.g. "AI code is rewritten 17 days sooner than human code in the same repo."

The report outputs a side-by-side table:

```markdown
| Metric                  | AI commits | Non-AI baseline | Delta   |
|-------------------------|------------|-----------------|---------|
| Merge ratio             | 73.2%      | 81.4%           | −8.2 pp |
| Avg persistence (days)  | 45.3       | 62.1            | −16.8   |
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
- **`@aida-dev/metrics`** - Merge ratio and persistence calculations  
- **`@aida-dev/cli`** - Command-line interface for end users

## CLI Usage

### Commands

#### `aida collect`

Collect commits and generate normalized commit stream:

```bash
aida collect --since 90d --out-dir ./aida-output
```

#### `aida analyze`

Calculate merge ratio and persistence metrics:

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
- `--out-dir <path>` - Output directory (default: ./aida-output)
- `--verbose` - Verbose logging

#### `aida analyze`

- `--out-dir <path>` - Output directory (default: ./aida-output)
- `--verbose` - Verbose logging

#### `aida report`

- `--out-dir <path>` - Output directory (default: ./aida-output)
- `--verbose` - Verbose logging

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

### Attribution Manifest (`aida-attribution.json`)

Heuristics only see what commit messages admit to. The manifest lets you declare attribution **retroactively and explicitly** — for commits made before your team adopted trailers, or to correct heuristic false positives. Place it at the repo root; `aida collect` picks it up automatically ([#10](https://github.com/ceccode/AIDA-Metrics/issues/10)).

```json
{
  "version": "1.0",
  "tool": "windsurf",
  "model": "claude-opus",
  "note": "Commits made before Co-Authored-By trailers were adopted.",
  "ai_assisted_commits": [
    { "hash": "2f972ace3ff158fbe272d2850e879008abb0b197", "message": "first commit" }
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
| `excluded_commits` | Forces attribution `unknown` (overrides heuristics) — for automation like release bots and merge commits |

Precedence: in-commit evidence beats retroactive declarations. A commit with an explicit AI trailer stays `ai` even if the manifest declares it human (with a warning); `excluded_commits` always wins, since it exists to correct heuristic false positives. Full hashes are matched exactly (`message` is documentation only); an invalid manifest logs a warning and is ignored — it never fails `collect`.

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

The headline metric ([#34](https://github.com/ceccode/AIDA-Metrics/issues/34)). Every commit gets a three-state attribution: `ai` (explicit/implicit detection), `human` (explicit declaration — coming with the attribution manifest, [#10](https://github.com/ceccode/AIDA-Metrics/issues/10)), or `unknown` (no signal — the absence of an AI tag is *not* evidence of human authorship).

**Coverage** = share of commits with known provenance. It is reported first in every output, because every other number is only as trustworthy as coverage says it is. Below `coverageThreshold` (default 70%), the report carries a low-confidence warning.

`defaultAttribution` lets a team consciously assign unattributed commits to a cohort (`human` for traditional repos, `ai` for AI-first ones). The prior affects cohort metrics but never coverage: unknown stays unknown in the attribution block, and an assumed baseline is labeled as such.

### Merge Ratio

Percentage of AI-tagged commits that were merged into the default branch.

### Persistence (MVP)

File-level proxy for how long AI-modified files survive before being changed again.

- Buckets: 0-1d, 2-7d, 8-30d, 31-90d, 90d+
- Provides average and median survival times

### Comparative Baseline

Both merge ratio and persistence are computed for the human cohort as well.  
The `metrics.json` output includes `baseline` (human cohort) and `delta` (AI minus human) sections.  
The markdown report renders a side-by-side comparison table at the top.  
If no commits are attributed `human` and no `defaultAttribution` prior assigns the unknowns, `baseline` and `delta` are `null`: AIDA does not invent a comparison cohort.

### Known Limits

These metrics are honest approximations, not ground truth. Read the numbers with these caveats in mind:

- **Detection is voluntary** — AIDA only sees what commits admit to. Untagged AI code lands in the `unknown` bucket, and attribution coverage ([#34](https://github.com/ceccode/AIDA-Metrics/issues/34)) reports how big that bucket is instead of hiding it; the attribution manifest ([#10](https://github.com/ceccode/AIDA-Metrics/issues/10)) lets you shrink it retroactively. But the tool still cannot see through a commit that lies.
- **Squash merges break merge ratio** — branch commits disappear from history, inflating the ratio ([#20](https://github.com/ceccode/AIDA-Metrics/issues/20)).
- **Persistence is file-level** — one AI-touched line marks the whole file as AI-touched; line-level tracking via `git blame` is planned ([#23](https://github.com/ceccode/AIDA-Metrics/issues/23)).
- **Cohort age skews persistence** — older commits have had more time to accumulate survival. The report now shows each cohort's age so you can judge fairness; normalization is still open ([#29](https://github.com/ceccode/AIDA-Metrics/issues/29)).
- **Task mix skews persistence** — AI is often pointed at boilerplate, tests, and migrations, which survive longer because nobody has a reason to touch them. The report now shows each cohort's file-category mix; within-category comparison is still open ([#36](https://github.com/ceccode/AIDA-Metrics/issues/36)).

## Output Files

- `commit-stream.json` - Normalized commit data with AI tagging
- `metrics.json` - Calculated metrics with merge ratio, persistence, baseline (non-AI), and delta
- `report.md` - Human-readable Markdown report with AI vs non-AI comparison table

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
- **Next** → Autonomy levels, step 1: `mode` × `evidence` collection ([#25](https://github.com/ceccode/AIDA-Metrics/issues/25)), `automated` attribution state ([#39](https://github.com/ceccode/AIDA-Metrics/issues/39)).  
- **Next** → Fix squash-merge merge ratio ([#20](https://github.com/ceccode/AIDA-Metrics/issues/20)), anti-leaderboard hardening: author redaction in outputs ([#35](https://github.com/ceccode/AIDA-Metrics/issues/35)).  
- **Next** → Rework rate ([#22](https://github.com/ceccode/AIDA-Metrics/issues/22)), line-level persistence via blame ([#23](https://github.com/ceccode/AIDA-Metrics/issues/23)).  
- **Next** → Autonomy levels — autocomplete vs assisted vs agent ([#25](https://github.com/ceccode/AIDA-Metrics/issues/25)), outcome correlation ([#26](https://github.com/ceccode/AIDA-Metrics/issues/26)), cost metrics ([#27](https://github.com/ceccode/AIDA-Metrics/issues/27)).  
- **Next** → GitLab ([#16](https://github.com/ceccode/AIDA-Metrics/issues/16)) and Bitbucket ([#17](https://github.com/ceccode/AIDA-Metrics/issues/17)) PR comment providers.  
- **v1.0** → Dashboard / GitHub Action for continuous tracking.  

### Direction: from AI detection to AI accountability

In an AI-first world, "was this commit written by AI?" is becoming the wrong question — the honest answer trends toward "yes, mostly". AIDA's direction reflects that:

- **Three-state attribution** — `ai` / `human` / `unknown` instead of forcing unattributed commits into a binary bucket ([#34](https://github.com/ceccode/AIDA-Metrics/issues/34)). Attribution **coverage** becomes the headline metric ("62% attributed · 38% unknown" is a data-quality signal, not something to hide inside a default) — because the unknown bucket grows fastest exactly where the numbers are taken most seriously. A configurable `defaultAttribution` prior will let AI-first teams opt into "AI unless stated otherwise" — consciously, instead of the tool silently assuming either way.
- **Quality over adoption** — the durable question is not "how much code is AI?" but "does AI code hold up?": rework rate ([#22](https://github.com/ceccode/AIDA-Metrics/issues/22)), line-level survival ([#23](https://github.com/ceccode/AIDA-Metrics/issues/23)), outcome correlation ([#26](https://github.com/ceccode/AIDA-Metrics/issues/26)).
- **Autonomy over the binary** — autocomplete vs assisted vs agent ([#25](https://github.com/ceccode/AIDA-Metrics/issues/25)) is the axis that will replace AI/non-AI.
- **Shrink the unknown at the source** — the attribution manifest ([#10](https://github.com/ceccode/AIDA-Metrics/issues/10), shipped) makes attribution declarative; commit-time stamping via git hooks will make it automatic.
- **Cohorts, not people** — AIDA compares groups of commits, never developers. No per-author aggregation will ever ship, and author identity can be redacted from output artifacts ([#35](https://github.com/ceccode/AIDA-Metrics/issues/35)) so the data model doesn't hand anyone a leaderboard for free.

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
