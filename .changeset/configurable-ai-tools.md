---
'@aida-dev/core': minor
'@aida-dev/cli': minor
---

4-level AI attribution classification (explicit/implicit/mention/none). Only explicit and implicit commits are counted as AI-assisted, reducing false positives from tool mentions.

Configurable AI tools via `.aida.json` config file and new CLI flags (`--ai-tool`, `--ai-trailer-domain`). Custom tools benefit from all 4 classification levels.

Fix: `--ai-pattern` CLI flag was silently ignored due to Commander naming mismatch.
