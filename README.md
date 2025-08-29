# AIDA Metrics – AI Development Accounting

**AIDA (AI Development Accounting)** is an open-source framework to measure the real impact of AI coding agents in software development.  
The goal is to move beyond "AI hype" and provide **tangible, auditable metrics** to distinguish between **AI noise** (suggestions discarded, unstable code) and **AI value** (stable, production-ready contributions).


## Why AIDA?

AI coding assistants (Copilot, Cursor, Windsurf, custom agents, etc.) are increasingly part of the development workflow.  
But today we lack a structured way to **quantify their real contribution**.

- CFOs and finance teams ask: *what part of AI costs can be capitalized as real development effort?*  
- CTOs and engineers ask: *is AI really saving time and delivering stable code?*  

AIDA wants to provide a **common language and tooling** for both worlds.


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


## Architecture (MVP)

- **Collector** → gathers data from Git history, AI tool logs (if available), or commit tags.  
- **Analyzer** → computes metrics based on history and metadata.  
- **Reporter** → exports results as JSON, CSV, or Markdown reports.  

Later: a GitHub Action or GitHub App to run AIDA automatically in CI/CD.


## Repository Structure

/aida-metrics
/docs
intro.md
roadmap.md
/src
/examples
demo-repo-with-ai-code
README.md
LICENSE


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

Feel free to open an **Issue** or start a **Discussion**.


## License

MIT License – use it, modify it, contribute back.


## Call to Action

The future of software development is hybrid – humans and AI agents working together.  
To account for it properly, we need better metrics.  

**Join us in building AIDA.**
