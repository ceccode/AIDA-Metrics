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
      { message: 'feat: claude generated code', expected: true },
      { message: 'fix: chatgpt suggestions applied', expected: true },
      { message: 'feat: gemini code review', expected: true },
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

  it('should detect Claude Code co-authored commits', () => {
    const claudeCommit = `fix: resolve authentication bug in login flow

Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>`;

    const result = tagger(claudeCommit);
    expect(result.ai).toBe(true);
    expect(result.sources.some((s) => s.includes('message_pattern'))).toBe(true);
    expect(result.sources.some((s) => s.includes('trailer_pattern'))).toBe(true);
  });

  it('should detect Co-authored-by with known AI domains', () => {
    const testCases = [
      { message: 'feat: new feature\n\nCo-authored-by: Claude <noreply@anthropic.com>', expected: true },
      { message: 'feat: new feature\n\nCo-authored-by: copilot[bot] <copilot@github.com>', expected: true },
      { message: 'feat: new feature\n\nCo-authored-by: ChatGPT <noreply@openai.com>', expected: true },
      { message: 'feat: new feature\n\nCo-authored-by: John <john@example.com>', expected: false },
    ];

    testCases.forEach(({ message, expected }) => {
      const result = tagger(message);
      expect(result.ai).toBe(expected);
    });
  });

  it('should handle custom patterns', () => {
    const customTagger = createAITagger({ patterns: ['custom-ai-tool'] });

    const result = customTagger('fix: custom-ai-tool generated code');
    expect(result.ai).toBe(true);
    expect(result.sources.some((s) => s.includes('custom-ai-tool'))).toBe(true);
  });
});
