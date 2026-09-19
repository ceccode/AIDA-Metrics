// How git names a renamed file in `--numstat` output.
//
// With rename detection on (the default), a moved file is one line, not a
// delete plus an add, and its path field carries both names:
//
//   old.ts => new.ts                        plain form, whole path differs
//   src/{old => new}/index.ts               brace form, shared prefix/suffix
//   {packages/a => integration/b}/entry.tsx brace form at the start
//   src/{ => lib}/util.ts                   brace form with an empty side
//
// Taking "the last tab-separated field" as the path — what this parser did
// before — kept the whole `old => new` string as a file name. Every rename
// then became a path that never existed, counted as one more eligible file,
// while the real file's later edits were filed under a name the first touch
// had never been recorded against. Found by an external review on a
// three-commit fixture; on react-router, 1,911 brace-form and 45 plain-form
// renames were doing this.
export interface SplitPath {
  path: string;
  previousPath?: string;
}

const BRACE = /^(.*)\{(.*) => (.*)\}(.*)$/;
const PLAIN = /^(.+) => (.+)$/;

function join(prefix: string, middle: string, suffix: string): string {
  // `src/{ => lib}/util.ts` → old side is `src//util.ts` before cleanup
  return `${prefix}${middle}${suffix}`.replace(/\/{2,}/g, '/');
}

export function splitRenamePath(raw: string): SplitPath {
  const brace = raw.match(BRACE);
  if (brace) {
    const [, prefix, from, to, suffix] = brace;
    return { path: join(prefix, to, suffix), previousPath: join(prefix, from, suffix) };
  }
  const plain = raw.match(PLAIN);
  if (plain) {
    return { path: plain[2], previousPath: plain[1] };
  }
  return { path: raw };
}
