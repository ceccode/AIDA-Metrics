import { describe, it, expect } from 'vitest';
import { createAutomatedDetector } from './automated.js';

const base = {
  parents: ['p1'],
  authorName: 'Alice',
  authorEmail: 'alice@example.com',
  committerName: 'Alice',
  committerEmail: 'alice@example.com',
};

describe('createAutomatedDetector', () => {
  const detect = createAutomatedDetector();

  it('flags merge commits via parent count', () => {
    expect(detect({ ...base, parents: ['p1', 'p2'] })).toBe('automated:merge-commit');
  });

  it('flags known bots by author or committer identity', () => {
    expect(detect({ ...base, authorName: 'github-actions[bot]' })).toBe('automated:bot');
    expect(detect({ ...base, authorEmail: 'dependabot@github.com' })).toBe('automated:bot');
    expect(detect({ ...base, committerName: 'renovate[bot]' })).toBe('automated:bot');
  });

  it('supports custom blocklist entries', () => {
    const custom = createAutomatedDetector(['acme-release-bot']);
    expect(custom({ ...base, authorName: 'acme-release-bot' })).toBe('automated:bot');
  });

  it('returns null for regular single-parent human-identity commits', () => {
    expect(detect(base)).toBeNull();
  });
});
