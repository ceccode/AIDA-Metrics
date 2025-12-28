export interface AITagResult {
  ai: boolean;
  sources: string[];
}

export interface AITagConfig {
  patterns: string[];
}

const DEFAULT_PATTERNS = ['\\b(ai|copilot|cursor|windsurf|codeium)\\b', '\\[ai\\]'];

const DEFAULT_TRAILER_PATTERNS = ['^AI:\\s*true$', '^X-AI:\\s*true$', '^Co-authored-by:.*bot.*$'];

export function createAITagger(
  config: AITagConfig = { patterns: [] }
): (message: string) => AITagResult {
  const allPatterns = [...DEFAULT_PATTERNS, ...config.patterns];
  const messageRegexes = allPatterns.map((pattern) => new RegExp(pattern, 'im'));
  const trailerRegexes = DEFAULT_TRAILER_PATTERNS.map((pattern) => new RegExp(pattern, 'm'));

  return (message: string): AITagResult => {
    const sources: string[] = [];
    let ai = false;

    // Check message patterns
    for (let i = 0; i < messageRegexes.length; i++) {
      if (messageRegexes[i].test(message)) {
        ai = true;
        sources.push(`message_pattern:${allPatterns[i]}`);
      }
    }

    // Check trailer patterns
    for (let i = 0; i < trailerRegexes.length; i++) {
      if (trailerRegexes[i].test(message)) {
        ai = true;
        sources.push(`trailer_pattern:${DEFAULT_TRAILER_PATTERNS[i]}`);
      }
    }

    return { ai, sources };
  };
}
