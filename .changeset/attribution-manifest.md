---
'@aida-dev/core': minor
'@aida-dev/cli': patch
---

Attribution manifest support (#10)

`aida collect` now reads an optional `aida-attribution.json` at the repo root to apply retroactive, explicit attribution declarations on top of message heuristics:

- `ai_assisted_commits` → attribution `ai`, level `explicit`, source `manifest`
- `human_authored_commits` (new) → attribution `human` — the first way to build a real human baseline for the three-state model
- `excluded_commits` → forces attribution `unknown`, overriding heuristics (for automation such as release bots and merge commits)

Precedence: in-commit evidence beats retroactive declarations — a commit with an explicit AI signal stays `ai` even if declared human (with a warning); `excluded_commits` always wins. Invalid manifests log a warning and are ignored; they never fail `collect`. Manifest hashes that match no collected commit are reported informationally.
