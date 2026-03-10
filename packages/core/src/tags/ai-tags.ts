export interface AITagResult {
  ai: boolean;
  aiConfidence: 'high' | 'low' | 'none';
  sources: string[];
}

export interface AITagConfig {
  patterns: string[];
}

const DEFAULT_PATTERNS = [
  '\\b(copilot|cursor|windsurf|codeium|claude|chatgpt|gemini)\\b',
  '\\[ai\\]',
];

// Patterns that indicate high confidence when matched in message body
const HIGH_CONFIDENCE_MESSAGE_PATTERNS = new Set([1]); // index of \[ai\]

const DEFAULT_TRAILER_PATTERNS = [
  '^AI:\\s*true$',
  '^X-AI:\\s*true$',
  '^Co-authored-by:.*bot.*$',
  '^Co-authored-by:.*\\b(anthropic|openai|github\\.com)\\b.*$',
];

export function createAITagger(
  config: AITagConfig = { patterns: [] }
): (message: string) => AITagResult {
  const allPatterns = [...DEFAULT_PATTERNS, ...config.patterns];
  const messageRegexes = allPatterns.map((pattern) => new RegExp(pattern, 'im'));
  const trailerRegexes = DEFAULT_TRAILER_PATTERNS.map((pattern) => new RegExp(pattern, 'mi'));

  return (message: string): AITagResult => {
    const sources: string[] = [];
    let ai = false;
    let hasHighConfidence = false;

    // Check message patterns
    for (let i = 0; i < messageRegexes.length; i++) {
      if (messageRegexes[i].test(message)) {
        ai = true;
        sources.push(`message_pattern:${allPatterns[i]}`);
        if (HIGH_CONFIDENCE_MESSAGE_PATTERNS.has(i)) {
          hasHighConfidence = true;
        }
      }
    }

    // Check trailer patterns (always high confidence)
    for (let i = 0; i < trailerRegexes.length; i++) {
      if (trailerRegexes[i].test(message)) {
        ai = true;
        hasHighConfidence = true;
        sources.push(`trailer_pattern:${DEFAULT_TRAILER_PATTERNS[i]}`);
      }
    }

    const aiConfidence = ai ? (hasHighConfidence ? 'high' : 'low') : 'none';
    return { ai, aiConfidence, sources };
  };
}
