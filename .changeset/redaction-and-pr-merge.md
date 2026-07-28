---
'@aida-dev/core': minor
'@aida-dev/cli': minor
---

Author redaction (#35) and synthetic PR merge commit fix (#40)

**Author redaction** — `aida collect --redact-authors` (or `redactAuthors: true` in `.aida.json`) replaces author/committer names and emails in `commit-stream.json` with a per-run salted hash: stable within one output file so identities can still be grouped, but not reversible to a person and not correlatable across runs. Redaction runs after identity-based detection (bots, #39), so it costs no accuracy. Recommended in CI, where the stream is uploaded as an artifact.

**Synthetic PR merge commit** — in PR-scoped mode (`--pr` / `--diff-base`), the merge head that `actions/checkout` creates for `pull_request` events (`Merge <sha> into <sha>`, authored by nobody) is skipped. It was inflating commit counts and coverage percentages on every PR comment — a 1-commit PR read as 2 commits. Standard time-windowed collection is unchanged: real merge commits are still collected and classified `automated`.
