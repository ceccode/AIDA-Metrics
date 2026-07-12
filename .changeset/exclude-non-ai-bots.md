---
'@aida-dev/core': minor
'@aida-dev/cli': minor
---

Exclude non-AI automation bots from `Co-authored-by` trailer matching. Commits from `dependabot`, `renovate`, `github-actions`, `greenkeeper`, `snyk-bot`, `mergify`, `imgbot`, and `allcontributors` are no longer miscounted as explicit AI contributions.

The blocklist is extensible via `botBlocklist` in `.aida.json` and the new `--ai-bot-blocklist` CLI flag.

Also fixes PR-scoped collection (`--pr` / `--diff-base`) in CI checkouts: the default-branch commit set is now computed against the diff base ref (e.g. `origin/main`) instead of the bare branch name, which is unresolvable in a detached PR checkout.
