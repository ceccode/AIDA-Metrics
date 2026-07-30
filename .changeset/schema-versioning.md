---
'@aida-dev/core': minor
'@aida-dev/metrics': minor
'@aida-dev/cli': minor
---

Version the output schemas + end-to-end CLI tests (#53)

`commit-stream.json` and `metrics.json` now carry a `schemaVersion` (both v1). The shape of these files changed six times in three days and a consumer had no way to detect it — a stale file parsed against a newer schema yields silent `undefined`s, not an error.

- **Contract**: additive changes don't bump the version; removing a field, renaming it, or changing its meaning does. Documented in the README, replacing the previous (untrue) "stable JSON schemas" claim.
- **Readers refuse what they don't understand**: `aida analyze` and `aida report` check the version before schema parsing and fail with an actionable message (`Rerun 'aida collect'`) instead of a zod dump or a half-parsed result. Pre-versioning output is named as such.
- **End-to-end CLI tests**: the `collect → analyze → report → comment --dry-run` pipeline is now covered on a fixture repo (CLI package went from 1 test to 7), including the version gate and `--redact-authors`.
- **`pnpm typecheck`**: new script (wired into CI) that typechecks tests too. It immediately caught pre-existing type errors in test fixtures that had been invisible, since vitest transpiles without checking.
