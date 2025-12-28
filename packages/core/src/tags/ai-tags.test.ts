import { describe, it, expect } from 'vitest';
import { createAITagger } from './ai-tags.js';

describe('AI Tagging', () => {
  const tagger = createAITagger();

  it('should detect AI patterns in commit messages', () => {
    const testCases = [
      { message: 'feat: add AI-powered search', expected: true },
      { message: 'fix: copilot suggestions', expected: true },
      { message: 'refactor: cursor improvements', expected: true },
      { message: '[AI] automated code generation', expected: true },
      { message: 'regular commit message', expected: false },
    ];

    testCases.forEach(({ message, expected }) => {
      const result = tagger(message);
      expect(result.ai).toBe(expected);
      if (expected) {
        expect(result.sources.length).toBeGreaterThan(0);
      }
    });
  });

  it('should detect AI trailers', () => {
    const messageWithTrailer = `feat: new feature

AI: true`;

    const result = tagger(messageWithTrailer);
    expect(result.ai).toBe(true);
    expect(result.sources.some((s) => s.includes('trailer_pattern'))).toBe(true);
  });

  it('should handle custom patterns', () => {
    const customTagger = createAITagger({ patterns: ['custom-ai-tool'] });

    const result = customTagger('fix: custom-ai-tool generated code');
    expect(result.ai).toBe(true);
    expect(result.sources.some((s) => s.includes('custom-ai-tool'))).toBe(true);
  });
});
