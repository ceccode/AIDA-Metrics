---
'@aida-dev/core': minor
'@aida-dev/cli': minor
---

Commit-time mode stamping via git hook (#61)

The attribution manifest (#10) declares provenance retroactively; this declares it at the source, turning `declared` evidence from the exception into the norm — the prerequisite for making autonomy the primary axis (#25 step 3).

- **`AI-Mode:` trailer** (`none` | `autocomplete` | `assisted` | `agent`) parsed as `mode` with `modeEvidence: declared`, beating tool inference. `AI-Mode: none` is the first mechanism that declares *human* authorship at commit time, without a manifest.
- **`aida install-hooks`** writes a `prepare-commit-msg` hook: self-contained POSIX shell (no dependency on `aida` at commit time), idempotent, refuses to overwrite a hook it didn't write unless `--force`, `--uninstall` removes only its own marked block, and it can never block a commit.
- **Mode resolution**: `AIDA_MODE` env var → known agent environment detection → `defaultMode` in `.aida.json` → nothing. An unknown mode writes no trailer: absence honestly means unknown, a guess would be a fabricated declaration.
