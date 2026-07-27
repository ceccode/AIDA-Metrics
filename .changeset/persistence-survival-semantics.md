---
'@aida-dev/metrics': minor
'@aida-dev/cli': patch
---

Fix persistence semantics: survival with censoring, convention-driven categories excluded

The file-level persistence metric measured the span from a file's first target-cohort touch to the **last** time anyone touched it — churn duration, not survival. A stable file never modified again scored 0 days (the best outcome counted as the worst), while a changelog touched by every release scored maximum.

Now persistence = **survival**: days until the *first* subsequent modification or deletion. Files never modified again are **censored** at collection time (they survived the window) and reported via a new `censored` count. Migrations (append-only by convention) and generated files (churned on every release) carry no quality signal and are excluded from persistence by default — new `filesConsidered`/`filesExcluded` fields make this visible; they still appear in the task-mix table.

Found via community feedback on the task-mix feature. Breaking for `metrics.json` consumers: `persistence` gains required `filesConsidered`, `filesExcluded`, `censored` fields, and bucket distributions shift meaning.
