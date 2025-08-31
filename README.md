# AIDA Metrics

**AI Development Accounting** - Track and measure AI-assisted development in your repositories.

AIDA is an open-source framework to measure the real impact of AI coding agents in software development.  

The goal is to move beyond "AI hype" and provide **tangible, auditable metrics** to distinguish between **AI noise** (suggestions discarded, unstable code) and **AI value** (stable, production-ready contributions).


## Why AIDA?

AI coding assistants (Copilot, Cursor, Windsurf, custom agents, etc.) are increasingly part of the development workflow.  

AIDA provides production-ready metrics for understanding how AI tools contribute to your development workflow, including merge ratios and code persistence analysis.

But today we lack a structured way to **quantify their real contribution**.

- CFOs and finance teams ask: *what part of AI costs can be capitalized as real development effort?*  
- CTOs and engineers ask: *is AI really saving time and delivering stable code?*  

AIDA wants to provide a **common language and tooling** for both worlds.


## Features

- **AI Detection**: Configurable heuristics to identify AI-assisted commits
- **Merge Ratio**: Track what percentage of AI commits make it to production
- **Persistence**: Measure how long AI-generated code survives in your codebase
- **Fast & Deterministic**: Built for production use with stable JSON schemas
- **CLI-First**: Simple commands for collection, analysis, and reporting
- **GitHub Actions**: Automated analysis on every push

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

The first version of AIDA will focus on four key metrics:

1. **Merge Ratio**  
   Percentage of AI-generated code that actually gets merged into the main branch.

2. **Persistence**  
   How long AI-generated code survives in the codebase before being rewritten or removed.

3. **Value per LOC**  
   Share of AI code contributing to released features (requires linking commits to tickets/issues).

4. **Hours Saved (estimated)**  
   A rough productivity delta: time estimated with AI vs without AI for comparable tasks.

> ⚠️ These metrics are **experimental**. The goal is not perfect precision, but providing **a baseline for discussion and analysis**.


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
aida report --format both --out-dir ./aida-output
```

### Global Options

- `--repo <path>` - Repository path (default: current directory)
- `--since <date>` - Start date (ISO or relative like 90d)
- `--until <date>` - End date (ISO or relative)
- `--ai-pattern <pattern>` - Custom AI detection pattern (repeatable)
- `--default-branch <name>` - Default branch name (auto-detect if omitted)
- `--out-dir <path>` - Output directory (default: ./aida-output)
- `--format <format>` - Output format: json, md, both (default: both)
- `--verbose` - Verbose logging

## AI Detection

AIDA uses configurable heuristics to identify AI-assisted commits:

### Default Patterns
- Commit messages containing: `ai`, `copilot`, `cursor`, `windsurf`, `codeium`
- AI tags: `[AI]`, `[ai]`
- Git trailers: `AI: true`, `X-AI: true`
- Bot co-authors: `Co-authored-by: *bot*`

### Custom Patterns
Add your own detection patterns:
```bash
aida collect --ai-pattern "claude" --ai-pattern "chatgpt"
```

## Metrics

### Merge Ratio
Percentage of AI-tagged commits that were merged into the default branch.

### Persistence (MVP)
File-level proxy for how long AI-modified files survive before being changed again.
- Buckets: 0-1d, 2-7d, 8-30d, 31-90d, 90d+
- Provides average and median survival times

## Output Files

- `commit-stream.json` - Normalized commit data with AI tagging
- `metrics.json` - Calculated metrics with merge ratio and persistence
- `report.json` - JSON report (mirrors metrics.json)
- `report.md` - Human-readable Markdown report

## CI/CD Integration

### GitHub Actions
```yaml
- name: Install AIDA
  run: npm install -g @aida-dev/cli

- name: Run AIDA Analysis
  run: |
    aida collect --since 30d
    aida analyze
    aida report

- name: Upload Reports
  uses: actions/upload-artifact@v4
  with:
    name: aida-reports
    path: aida-output/
```

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

The included workflow (`.github/workflows/aida-analyze.yml`) automatically:
1. Runs AIDA analysis on every push to main/master
2. Uploads artifacts with commit stream, metrics, and reports
3. Provides historical tracking of AI development patterns

## Repository Structure

```
/aida-metrics
├── packages/
│   ├── cli/           # @aida-dev/cli
│   ├── core/          # @aida-dev/core
│   └── metrics/       # @aida-dev/metrics
├── .github/workflows/ # CI/CD automation
└── docs/             # Documentation
```

## Roadmap

- **v0.1** → Git-based metrics (Merge Ratio + Persistence).  
- **v0.2** → Integration with AI assistants (Copilot, Cursor) if APIs available.  
- **v0.3** → Connect to issue trackers (GitHub Issues, Jira) for Value per LOC.  
- **v1.0** → Dashboard / GitHub Action for continuous tracking.  


## Contributing

This is just the starting point. We are looking for contributors who can help with:  
- Designing robust metrics  
- Building integrations (Copilot, Cursor, etc.)  
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

### Branch Rules
- **Main branch only** - no separate dev/release branches
- **Feature branches** - `feat/xyz`, `fix/abc`, `docs/update-readme`
- **Clean history** - squash merge preferred
- **Auto-publish** - changesets trigger NPM releases

Feel free to open an **Issue** or start a **Discussion**.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## License

MIT License – use it, modify it, contribute back.


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

## License

MIT
