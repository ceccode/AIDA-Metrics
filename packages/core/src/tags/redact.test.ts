import { describe, it, expect } from 'vitest';
import { createRedactor } from './redact.js';

describe('createRedactor', () => {
  it('produces stable hashes within a run, so identities can still be grouped', () => {
    const redactor = createRedactor('fixed-salt');
    expect(redactor.name('Alice Author')).toBe(redactor.name('Alice Author'));
    expect(redactor.email('alice@example.com')).toBe(redactor.email('alice@example.com'));
  });

  it('normalizes case and surrounding whitespace', () => {
    const redactor = createRedactor('fixed-salt');
    expect(redactor.email(' Alice@Example.com ')).toBe(redactor.email('alice@example.com'));
  });

  it('distinguishes different identities', () => {
    const redactor = createRedactor('fixed-salt');
    expect(redactor.name('Alice')).not.toBe(redactor.name('Bob'));
  });

  it('produces different hashes across runs, so values cannot be correlated', () => {
    expect(createRedactor().email('alice@example.com')).not.toBe(
      createRedactor().email('alice@example.com')
    );
  });

  it('never leaks the original value and emits a non-resolvable address', () => {
    const redactor = createRedactor('fixed-salt');
    const email = redactor.email('alice@example.com');
    expect(email).not.toContain('alice');
    expect(email).not.toContain('example.com');
    expect(email.endsWith('@redacted.invalid')).toBe(true);
    expect(redactor.name('Alice Author')).not.toContain('Alice');
  });
});
