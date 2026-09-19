import { describe, it, expect } from 'vitest';
import { splitRenamePath } from './paths.js';

// The forms are copied from real `git log --numstat` output on react-router,
// where the brace form outnumbers the plain one forty to one.
describe('splitRenamePath', () => {
  it('leaves an ordinary path alone', () => {
    expect(splitRenamePath('src/index.ts')).toEqual({ path: 'src/index.ts' });
    // an arrow inside a name that is not a rename is not a rename
    expect(splitRenamePath('docs/a=>b.md')).toEqual({ path: 'docs/a=>b.md' });
  });

  it('splits the plain form', () => {
    expect(splitRenamePath('old.ts => new.ts')).toEqual({ path: 'new.ts', previousPath: 'old.ts' });
    expect(
      splitRenamePath(
        'integration/helpers/app/entry.server.tsx => packages/react-router-dev/config/defaults/entry.server.web.tsx'
      )
    ).toEqual({
      path: 'packages/react-router-dev/config/defaults/entry.server.web.tsx',
      previousPath: 'integration/helpers/app/entry.server.tsx',
    });
  });

  it('expands the brace form with a shared prefix and suffix', () => {
    expect(splitRenamePath('.github/workflows/{shared-integration.yml => integration-run.yml}')).toEqual({
      path: '.github/workflows/integration-run.yml',
      previousPath: '.github/workflows/shared-integration.yml',
    });
    expect(splitRenamePath('src/{old => new}/index.ts')).toEqual({
      path: 'src/new/index.ts',
      previousPath: 'src/old/index.ts',
    });
  });

  it('expands the brace form at the start of the path', () => {
    expect(
      splitRenamePath('{packages/react-router-dev/config/defaults => integration/helpers/app}/entry.server.tsx')
    ).toEqual({
      path: 'integration/helpers/app/entry.server.tsx',
      previousPath: 'packages/react-router-dev/config/defaults/entry.server.tsx',
    });
  });

  it('expands a brace form with an empty side without leaving a double slash', () => {
    expect(splitRenamePath('src/{ => lib}/util.ts')).toEqual({
      path: 'src/lib/util.ts',
      previousPath: 'src/util.ts',
    });
    expect(splitRenamePath('src/{lib => }/util.ts')).toEqual({
      path: 'src/util.ts',
      previousPath: 'src/lib/util.ts',
    });
  });
});
