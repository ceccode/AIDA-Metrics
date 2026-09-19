---
'@evidtrail/core': patch
'@evidtrail/metrics': patch
---

Renames follow the file: a moved file is one file, not a phantom path plus a stranger

Found by an external review, reproduced, and it flatters: `old.ts` → `git mv new.ts` → edit `new.ts` produced three paths in the stream — `old.ts`, `old.ts => new.ts` and `new.ts` — with the rename filed as a *modification* of a file that never existed. Every rename in a repository was one more eligible file that could never be retouched, and the real file's later edits were filed under a name its first touch had never been recorded against. On react-router, 1,956 renames were doing this.

- **core** — `git log --numstat` names a renamed file as `old => new` or `dir/{old => new}/file`; both forms are now parsed (`splitRenamePath`). The stream records the file under its new name with `previousPath` set and status `renamed` (additive field, no schema bump). PR-scoped collection (`git show`) gets the same parsing.
- **metrics** — a file's lifecycle follows it across a rename. A pure rename (no lines changed) is not a touch: nothing about the code happened, only its address. A rename that also edits is one. Hotfix linking carries the touch history across the move the same way.

Direction of the change on real repositories: eligible files go down, retouches go up, and the rate rises — the phantom paths had been padding the denominator with files nothing could ever touch. Exact figures in the pull request.
