import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchClosedPRs } from './github-prs.js';

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchClosedPRs completeness', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('filters by closed_at without stopping an updated_at-sorted scan and skips drafts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/pulls?')) {
          return response([
            {
              number: 1,
              state: 'closed',
              draft: false,
              created_at: '2024-01-01T00:00:00Z',
              closed_at: '2024-01-02T00:00:00Z',
              merged_at: null,
            },
            {
              number: 2,
              state: 'closed',
              draft: false,
              created_at: '2026-01-01T00:00:00Z',
              closed_at: '2026-01-02T00:00:00Z',
              merged_at: '2026-01-02T00:00:00Z',
            },
            {
              number: 3,
              state: 'closed',
              draft: true,
              created_at: '2026-01-01T00:00:00Z',
              closed_at: '2026-01-02T00:00:00Z',
              merged_at: null,
            },
          ]);
        }
        if (url.includes('/pulls/2/commits')) {
          return response([
            { sha: 'a'.repeat(40), commit: { message: 'AI-Mode: agent' }, parents: [] },
          ]);
        }
        throw new Error(`Unexpected URL: ${url}`);
      })
    );

    const stream = await fetchClosedPRs({
      repo: 'owner/repo',
      token: 'test',
      apiUrl: 'https://example.test',
      since: new Date('2025-01-01T00:00:00Z'),
    });

    expect(stream.prs.map((pr) => pr.number)).toEqual([2]);
    expect(stream.prs[0].commitsComplete).toBe(true);
  });

  it('paginates PR commits instead of classifying from the first 100 only', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      sha: String(index).padStart(40, '0'),
      commit: { message: 'plain commit' },
      parents: [],
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/pulls?')) {
          return response([
            {
              number: 9,
              state: 'closed',
              draft: false,
              created_at: '2026-01-01T00:00:00Z',
              closed_at: '2026-01-02T00:00:00Z',
              merged_at: null,
            },
          ]);
        }
        const page = new URL(url).searchParams.get('page');
        if (page === '1') return response(firstPage);
        if (page === '2') {
          return response([
            { sha: 'f'.repeat(40), commit: { message: 'AI-Mode: agent' }, parents: [] },
          ]);
        }
        throw new Error(`Unexpected URL: ${url}`);
      })
    );

    const stream = await fetchClosedPRs({
      repo: 'owner/repo',
      token: 'test',
      apiUrl: 'https://example.test',
    });

    expect(stream.prs[0].commits).toHaveLength(101);
    expect(stream.prs[0].commitsComplete).toBe(true);
    expect(stream.prs[0].commits.at(-1)?.tags.mode).toBe('agent');
  });
});
