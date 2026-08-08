---
'@aida-dev/metrics': patch
'@aida-dev/cli': minor
---

Report reframe: Code Quality opens, autonomy is the lens, coverage becomes a Data Quality footnote (#77 step 2)

The report now leads with what needs no attribution evidence and demotes what does:

- **`## Code Quality` opens the report** — the repo-level block from step 1: persistence, rework and survival buckets over all authored commits. One framing line states the property that makes it first: these numbers do not move with coverage or with the `defaultMode` prior.
- **`## Autonomy` becomes the lens**, explicitly labelled as depending on attribution evidence. The low-coverage warning is scoped honestly: it used to say *"every metric below is low-confidence"*, which stopped being true the moment repo-level quality existed — it now says the attribution-dependent sections are low-confidence and Code Quality is unaffected. Same scoping applied to the `aida analyze` warning and the metrics caveat.
- **Coverage moves to `## Data Quality` at the end** — evidence counts and the 90-day window, framed as what gates the autonomy sections, never the report.
- **The old `## Persistence (file-level survival)` section is gone** — it rendered the *AI cohort's* numbers under a generic-looking heading, the same defect class found on babel and varano (cohort data wearing a repo-level label). Repo-level detail lives in Code Quality; cohort persistence stays in By Autonomy Level and AI vs Baseline, which say what they are.

Dogfooded on varano-239, the freshly adopted repo: the report now opens with persistence/rework figures that are valid at its 59.3% coverage, instead of opening with the coverage shortfall. Incidentally, that run showed the adoption loop working — coverage moved 35.3% → 59.3% since the last look, declared commits 5 → 15.
