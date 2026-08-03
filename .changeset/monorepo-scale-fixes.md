---
'@aida-dev/core': patch
'@aida-dev/metrics': patch
'@aida-dev/cli': patch
---

Fix three correctness bugs found by running AIDA against a large monorepo

Validated against babel/babel (18,851 commits, 28,732 tracked files) — the scale profile the first two external repos were missing. The two suspected failure modes (a 64MB `maxBuffer` ceiling, and blame being unusably slow) both turned out to be non-issues; what the run actually found were three ways of reporting a wrong number confidently.

- **An unnamed bot co-author is no longer read as AI.** The `Co-authored-by:.*bot.*` trailer rule treated "a bot participated" as "AI wrote this" — two different claims. On babel, 47 of 52 "AI" commits were ordinary PRs co-authored by *Babel Bot*, the project's own release and formatting bot; the rule was also unanchored, so any human whose name merely contains "bot" matched. A co-author must now name a known AI tool or AI domain. Precision went 5/52 → 8/8, and recall improved too: the tool-name rule catches `Copilot <copilot@github.com>` and `Copilot Autofix`, which the old `*bot*` rule missed. This also establishes an invariant worth keeping — a trailer-detected AI commit now always has a known autonomy mode, where all 47 false positives had `mode: unknown`. The tagger already knew it could not name a tool, and asserted AI anyway.

- **The line-survival denominator now covers the same files as the numerator.** `approxSurvivalRate` divided AI lines surviving in the blamed files by AI lines added across the *entire* history. Since blame never covers the whole tree — generated files are excluded, `--max-files` caps the walk — the two halves described different repos. On babel, `aida blame --max-files 500` over 28,732 files reported **"1.7% of AI-introduced lines survive"**: 453 files' worth of survivors over the whole history's worth of additions. Arithmetically correct, and it told the reader that AI code gets deleted when it actually said the sample was 1.6% of the tree. `BlameStream` now carries `blamedPaths` (schema v2) and the denominator is scoped to it.

- **`--max-files` now samples the tree instead of its first corner.** It took the first N paths in `git ls-tree` order, which is path order. On babel, `--max-files 500` never got past `packages/babel-c*` and drew 183 of its 500 files from a single package — then the report called it "a sample". Selection now strides evenly across the candidate list, staying fully deterministic.

Also: **a failing `git blame` is no longer indistinguishable from a binary file.** Errors were absorbed into `filesSkipped`, so a run that failed on half the tree read as a clean run with some binaries in it. They are now counted in `filesFailed`, warned about with the first error, and surfaced in the report. This is the path a `maxBuffer` overflow would have taken: silently missing lines rather than a failure. The overflow itself proved unreachable — `git blame --incremental` emits one line per chunk rather than per line, so babel's worst file produced 78KB against the 64MB cap, and `ls-tree` and `diff --numstat` peaked at 2.7MB.
