---
'@aida-dev/core': minor
'@aida-dev/metrics': minor
'@aida-dev/cli': minor
---

Line-level survival via `aida blame` (#23)

Exact per-line attribution, replacing the file-level proxy as the precise measure: of the lines alive in the tree right now, which commit last wrote each one, and at what autonomy level. One AI line in a thousand no longer marks a whole file.

- **New `aida blame` command** writes `blame-stream.json` (schema v1) with per-commit surviving line counts — compact, one entry per commit rather than per line. Kept opt-in and separate because it runs one git process per file; `collect` stays fast.
- **`aida analyze` picks it up when present**: `metrics.lineSurvival` reports lines alive by attribution cohort and by autonomy mode, plus the AI share. Absent without the file, with a caveat pointing at the command.
- **Binary files are detected and excluded** via a single `git diff --numstat` against the empty tree. `git blame` does not fail on binaries — it reports the whole blob as one line — so they would otherwise have added phantom lines to the totals.
- Blame runs with `-w`, so reformatting does not reattribute lines to whoever ran the formatter. `--max-files` bounds the walk and flags the result as a sample; lines from commits outside the collected window are reported separately rather than folded into `unknown`.

Share figures are exact for the living codebase. The derived survival rate of AI-introduced lines is explicitly approximate: blame cannot see deleted lines, and a line rewritten twice was added twice.
