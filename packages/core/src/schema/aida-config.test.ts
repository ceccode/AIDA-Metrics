import { describe, it, expect } from 'vitest';
import { AidaConfig, assertNoRetiredConfigKeys } from './aida-config.js';

describe('assertNoRetiredConfigKeys', () => {
  // zod strips unknown keys, so a config still carrying the retired prior
  // would parse cleanly and quietly stop applying — changing which commits
  // join which cohort on the day a repo upgrades, with no warning at all.
  it('refuses a config that still uses defaultAttribution', () => {
    expect(() => assertNoRetiredConfigKeys({ defaultAttribution: 'ai' })).toThrow(/defaultMode/);
  });

  it('names the replacement value for each retired one', () => {
    expect(() => assertNoRetiredConfigKeys({ defaultAttribution: 'human' })).toThrow(
      /"defaultMode": "none"/
    );
    expect(() => assertNoRetiredConfigKeys({ defaultAttribution: 'ai' })).toThrow(
      /"defaultMode": "assisted"/
    );
  });

  it('accepts a migrated config, and anything without the key', () => {
    expect(() => assertNoRetiredConfigKeys({ defaultMode: 'agent' })).not.toThrow();
    expect(() => assertNoRetiredConfigKeys({})).not.toThrow();
    expect(() => assertNoRetiredConfigKeys(null)).not.toThrow();
  });

  it('parses a migrated config into the expected shape', () => {
    const config = AidaConfig.parse({ defaultMode: 'agent' });
    expect(config.defaultMode).toBe('agent');
    expect(config).not.toHaveProperty('defaultAttribution');
  });
});
