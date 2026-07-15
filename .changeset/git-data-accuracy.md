---
'@aida-dev/core': minor
'@aida-dev/metrics': patch
---

Git data accuracy (#24):

- Real committer name/email/date are now collected via a custom `git log --format` (previously duplicated from author fields, wrong after rebase/squash).
- Commit metadata, parents, and diff stats are fetched in two batched `git log` passes instead of two git processes per commit — collection is dramatically faster on large repos.
- Removed the misleading `branch` field from the `Commit` schema: it was always set to the default branch, even for commits collected from other branches.
- New caveat documents that time-windowed collection (`--since`) also windows the ancestry check.
