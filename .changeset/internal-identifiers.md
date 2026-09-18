---
'@evidtrail/core': minor
'@evidtrail/cli': patch
---

The rename reaches the identifiers no user ever sees

The 1.2 rename deliberately stopped at the surface: config file, environment variable, command name, markers. The code underneath still said `AidaConfig`, `installAidaHook`, `loadAidaConfig`, `isAidaHookInstalled`, and the schema lived in `aida-config.ts`. Harmless to run, confusing to read, and a trap for anyone opening the source after arriving from the new name.

- `@evidtrail/core` exports **`EvidtrailConfig`**; the schema file is `evidtrail-config.ts`. `AidaConfig` is a published export, so it stays as a deprecated alias of the same schema until the next major — renaming it outright would break importers on a minor upgrade, which is the opposite of what the rename promised. A test asserts the two are the same object.
- CLI internals drop the prefix rather than swapping it, where the surrounding module already says which tool it is: `loadConfig`, `installHook`, `uninstallHook`, `isHookInstalled`, `stripHookBlock`, `existingWorkflow`. Only `isEvidtrailHook` keeps a name, because its whole job is telling our hook from someone else's.

No behaviour changes: same schema, same checks, same output.
