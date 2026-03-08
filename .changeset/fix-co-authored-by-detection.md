---
'@aida-dev/core': patch
---

Fix AI detection for Co-Authored-By trailers in commit body

simple-git stores git trailers in a separate `body` field. The AI tagger now reads both `message` and `body` to correctly detect Co-Authored-By trailers from Claude, Copilot, ChatGPT, and other AI tools.
