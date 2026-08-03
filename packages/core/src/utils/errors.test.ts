import { describe, it, expect } from 'vitest';
import { describeError } from './errors.js';

describe('describeError', () => {
  it('keeps a short message untouched', () => {
    expect(describeError(new Error('something broke'))).toBe('something broke');
  });

  it('handles a non-Error throw', () => {
    expect(describeError('plain string')).toBe('plain string');
  });

  // The case that motivated this: a failing `git log --numstat` over babel put
  // 22MB of per-file statistics in the error message, with the one useful line
  // buried inside it.
  it('extracts the git diagnosis from a wall of command output', () => {
    const numstatDump = Array.from(
      { length: 5000 },
      (_, i) => `1\t1\tpackages/babel-plugin-${i}/package.json`
    ).join('\n');
    const error = new Error(`${numstatDump}\nfatal: unable to read a7009f8ff7f2`);

    const described = describeError(error);

    expect(described).toBe('fatal: unable to read a7009f8ff7f2');
    expect(described).not.toContain('package.json');
  });

  it('keeps every diagnostic line when git reports more than one', () => {
    const error = new Error(
      ['1\t1\tsome/file.ts', 'error: object file is empty', 'fatal: loose object corrupt'].join('\n')
    );

    expect(describeError(error)).toBe(
      'error: object file is empty\nfatal: loose object corrupt'
    );
  });

  it('truncates a long message that carries no git diagnosis, and says so', () => {
    const described = describeError(new Error('x'.repeat(5000)));

    expect(described.length).toBeLessThan(1700);
    expect(described).toMatch(/3500 more characters omitted/);
  });
});
