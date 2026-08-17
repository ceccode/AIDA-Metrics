---
'@aida-dev/core': major
'@aida-dev/metrics': major
'@aida-dev/cli': major
---

Establish the 1.0 measurement contract: default to default-branch ancestry, bind artifacts to a repository snapshot, report fixed-horizon rapid retouch with explicit censoring, harden untrusted Git paths and configuration, make analysis deterministic, and label incomplete PR evidence. PR reports now focus on the change set, identify commits missing provenance, and omit time-based tables that cannot be interpreted on fresh work. The repository's prepare bootstrap installs the canonical provenance hook before the CLI is built, closing the clean-clone gap that silently produced `unknown` commits. The breaking schema changes are intentional so older artifacts cannot be read under the new meanings.
