---
'@aida-dev/core': patch
'@aida-dev/cli': patch
---

Report the git diagnosis instead of the whole git output when a command fails

A failing git command puts its entire output in the error message — simple-git and `child_process.exec` both do. On a large repo that is not a message but a data dump: a broken `git log --numstat` over babel printed **22MB of per-file statistics**, with the one line that explained the failure (`fatal: unable to read <object>`) buried somewhere inside it. Found while validating against babel, where diagnosing a bad clone took far longer than it should have.

git puts its diagnosis on lines prefixed `fatal:` or `error:`, so `describeError` keeps those and drops the rest; when there are none it truncates at 1500 characters and says how much was omitted. Applied at every CLI command's top-level catch. The same 22MB failure now reads as a single line.

Matters most in CI, which is where AIDA is meant to run and where nobody scrolls back through a megabyte of log to find the cause.
