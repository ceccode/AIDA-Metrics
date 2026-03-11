---
'@aida-dev/core': minor
---

Remove bare 'ai' keyword from default detection patterns to eliminate false positives. Add `aiConfidence` field ('high' | 'low' | 'none') to tag results — trailers and explicit [AI] tags are high confidence, keyword-only matches are low.
