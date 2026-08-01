---
'@aida-dev/core': minor
'@aida-dev/metrics': minor
'@aida-dev/cli': minor
---

PR acceptance rate via forge APIs (#51)

The honest successor to the merge ratio removed in #20. Git history cannot say whether work was accepted — squash merges and deleted branches erase discarded work — but a forge never deletes a closed pull request.

- **New `aida fetch-prs` command**: fetches closed PRs (merged and closed-unmerged) from the GitHub API into `pr-stream.json` (schema v1). It is the *only* command that touches the network, kept separate on purpose so `collect` stays git-only and offline.
- **`aida analyze` picks it up when present**: `metrics.json` gains `prAcceptance` with acceptance rates overall, per attribution cohort, and per autonomy mode. Absent without the file — with a caveat pointing at `fetch-prs`, never a silent 0%.
- **Attribution from the PR's own commit messages** as returned by the API, not from a join against local git: this is what makes it work for squash-merged PRs whose branches no longer exist.
- **No author identity is fetched or stored** — PR numbers, outcomes, dates, and commit attribution only (#35).
- Bounded API usage via `--since` and `--max-prs`; a capped fetch is flagged `truncated` and carries a caveat. Rate-limit exhaustion produces a distinct, actionable error.
