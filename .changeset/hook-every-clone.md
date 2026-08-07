---
'@aida-dev/cli': minor
---

Reach every clone with the commit hook: `--if-git` plus a `prepare` recipe, and a warning that names the gap (#75)

A hook is per-clone state while `.aida.json` is committed and shared, so declared coverage depended on each contributor remembering to run `aida install-hooks` in each clone. The failure is silent — nothing breaks, the no-evidence bucket just grows and the 90-day figure ("the number you can move") degrades without anyone deciding it should.

- **`aida install-hooks --if-git`** exits 0 quietly where there is no git to hook into — a tarball install, `npm ci` in a container, a Docker build context — instead of failing an unrelated install. That makes it safe in a `prepare` script, now documented (the husky model): `{ "scripts": { "prepare": "aida install-hooks --if-git" } }`. Installation was already idempotent and still refuses to overwrite a foreign hook, so `prepare` re-runs cost nothing.

- **The low-coverage warning names the gap.** When a repo has `.aida.json` but the local clone has no `prepare-commit-msg` hook, the warning says so and gives the `prepare` line, instead of repeating generic advice. It stays generic when the hook is present, and on repos that never opted into AIDA — running AIDA over someone else's project should not nag about a hook they never asked for.

No `postinstall` behaviour was added: mutating `.git` as a side effect of `npm install` violates least surprise, and install scripts are disabled in exactly the hardened setups that would care most. AIDA points at the gap where eyes already are instead.
