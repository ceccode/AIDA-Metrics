---
'@aida-dev/core': minor
'@aida-dev/cli': minor
---

Exclude non-AI automation bots from `Co-authored-by` trailer matching. Commits from `dependabot`, `renovate`, `github-actions`, `greenkeeper`, `snyk-bot`, `mergify`, `imgbot`, and `allcontributors` are no longer miscounted as explicit AI contributions.

The blocklist is extensible via `botBlocklist` in `.aida.json` and the new `--ai-bot-blocklist` CLI flag.
