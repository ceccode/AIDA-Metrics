---
'@aida-dev/cli': minor
---

GitLab CI provider for `aida comment` (#16)

`aida comment` now auto-detects GitLab CI and posts the report as a merge request note, finding and updating its own note by marker on re-runs instead of adding a new one — the same behaviour as the GitHub provider.

- Uses `CI_MERGE_REQUEST_IID`, `CI_PROJECT_ID` and `CI_API_V4_URL`, so self-managed instances work without configuration.
- Requires `GITLAB_TOKEN` (project or group access token with the `api` scope). `CI_JOB_TOKEN` cannot post notes and is deliberately not used as a fallback: the command fails with that explanation instead of an opaque 401.
- Token patterns are scrubbed from any surfaced API error.

PR-scoped collection (`--pr`) already supported GitLab, so `collect → analyze → report → comment` now works end to end there.
