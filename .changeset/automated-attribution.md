---
'@aida-dev/core': minor
'@aida-dev/metrics': minor
'@aida-dev/cli': patch
---

'automated' as fourth attribution state (#39)

Merge commits and bot-authored commits are automation, not authored code — their provenance is known, yet they landed in `unknown`, dragging coverage down forever (and decaying it with every release) or getting pulled into cohorts by `defaultAttribution` priors.

- New attribution state `automated`: auto-detected at collect time (merge commits via parent count, bots via the #21 blocklist matched against author/committer identity) or declared via manifest `excluded_commits`. In-commit AI evidence and manifest ai/human declarations always win over the structural heuristics.
- Coverage now counts `automated` as known provenance: `(ai + human + automated) / total`.
- Automated commits join no cohort and priors never touch them; they carry `mode: none`.
- Report and logs show the automated count; the `defaultAttribution` prior note is hidden when there are no unknown commits left.

Breaking for `metrics.json`/`commit-stream.json` consumers: attribution enum gains `automated`; the attribution block gains a required `automated` count.
