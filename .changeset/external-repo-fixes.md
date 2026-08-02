---
'@aida-dev/core': patch
'@aida-dev/cli': patch
---

Fix three correctness bugs found by running AIDA against an external repository

Validated against commander.js (1,517 commits, 2011–2026) — the first repo other than this one AIDA had ever analysed. All three would have produced confidently wrong numbers on someone else's project.

- **`github.com` removed from AI trailer domains.** `@users.noreply.github.com` is the default email of every GitHub account, so any commit co-authored through the web UI was flagged as AI. On commander.js, 2 of 3 "AI" detections were ordinary humans. AI bots hosted on GitHub are still caught by the `*bot*` rule, verified against the real `copilot-swe-agent[bot]` trailer.
- **Shallow clones now warn.** `actions/checkout` defaults to `fetch-depth: 1`, so AIDA would happily report on a single commit as if it were the whole history. Detected via `git rev-parse --is-shallow-repository`; both CI examples in the README now set `fetch-depth: 0` / `GIT_DEPTH: 0`, which was the upstream cause.
- **Empty repositories no longer crash** with a raw `fatal: ambiguous argument 'HEAD'`; `collect` returns a valid empty stream and the whole pipeline runs through.

Also: `copilot-swe-agent[bot]` (GitHub's autonomous coding agent) is now inferred as `agent` rather than `autocomplete` — it was matching the generic `copilot` rule first, which inverted exactly the distinction #25 exists to measure.
