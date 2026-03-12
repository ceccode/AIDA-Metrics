export type AILevel = 'explicit' | 'implicit' | 'mention' | 'none';

export interface AITagResult {
  ai: boolean;
  level: AILevel;
  sources: string[];
}

export interface AITagConfig {
  patterns: string[];
}

const AI_TOOLS = 'copilot|cursor|windsurf|codeium|claude|chatgpt|gemini';

// Level 1: Explicit attribution — clear statement of AI authorship
const EXPLICIT_TAG_PATTERN = '\\[ai\\]';
const EXPLICIT_VERB_PATTERNS = [
  `(generated|created|written|built|authored|produced)\\s+(by|with|using)\\s+\\b(${AI_TOOLS})\\b`,
  `\\b(${AI_TOOLS})\\b\\s+(generated|created|wrote|built|authored|produced)`,
];

const TRAILER_PATTERNS = [
  '^AI:\\s*true$',
  '^X-AI:\\s*true$',
  '^Co-authored-by:.*bot.*$',
  '^Co-authored-by:.*\\b(anthropic|openai|github\\.com)\\b.*$',
];

// Level 2: Implicit attribution — suggests AI involvement
const IMPLICIT_PATTERNS = [
  `\\b(${AI_TOOLS})\\b\\s+(suggestions?|assisted|helped|recommended|review)`,
  `(suggested|assisted|helped|reviewed|recommended)\\s+(by|with|from)\\s+\\b(${AI_TOOLS})\\b`,
  `(with\\s+help\\s+from|with\\s+assistance\\s+from)\\s+\\b(${AI_TOOLS})\\b`,
];

// Level 3: Mention context — tool name in non-attribution context
const MENTION_CONTEXT_PATTERNS = [
  `(fix|add|remove|disable|enable|configure|update|install|setup|document|test)\\b.*\\b(${AI_TOOLS})\\b`,
  `\\b(${AI_TOOLS})\\b\\s+(support|integration|config|configuration|setup|plugin|extension|bug|issue|error|detection|pattern|rule)`,
];

// Bare tool name match (used as fallback → mention)
const TOOL_NAME_PATTERN = `\\b(${AI_TOOLS})\\b`;

export function createAITagger(
  config: AITagConfig = { patterns: [] }
): (message: string) => AITagResult {
  const explicitTagRegex = new RegExp(EXPLICIT_TAG_PATTERN, 'im');
  const explicitVerbRegexes = EXPLICIT_VERB_PATTERNS.map((p) => new RegExp(p, 'im'));
  const trailerRegexes = TRAILER_PATTERNS.map((p) => new RegExp(p, 'mi'));
  const implicitRegexes = IMPLICIT_PATTERNS.map((p) => new RegExp(p, 'im'));
  const mentionContextRegexes = MENTION_CONTEXT_PATTERNS.map((p) => new RegExp(p, 'im'));
  const toolNameRegex = new RegExp(TOOL_NAME_PATTERN, 'im');
  const customRegexes = config.patterns.map((p) => new RegExp(p, 'im'));

  return (message: string): AITagResult => {
    const sources: string[] = [];
    let level: AILevel = 'none';

    // 1. Check trailers (always explicit)
    for (let i = 0; i < trailerRegexes.length; i++) {
      if (trailerRegexes[i].test(message)) {
        level = 'explicit';
        sources.push(`trailer:${TRAILER_PATTERNS[i]}`);
      }
    }

    // 2. Check [AI] tag (explicit)
    if (explicitTagRegex.test(message)) {
      level = 'explicit';
      sources.push('tag:[ai]');
    }

    // 3. Check creation verb + tool (explicit)
    for (const regex of explicitVerbRegexes) {
      if (regex.test(message)) {
        level = 'explicit';
        sources.push(`explicit_verb:${regex.source}`);
      }
    }

    // 4. Check custom patterns (treated as explicit)
    for (const regex of customRegexes) {
      if (regex.test(message)) {
        level = 'explicit';
        sources.push(`custom:${regex.source}`);
      }
    }

    // If already explicit, skip lower-level checks
    if (level !== 'explicit') {
      // 5. Check implicit patterns first (higher priority than mention)
      let isImplicit = false;
      for (const regex of implicitRegexes) {
        if (regex.test(message)) {
          isImplicit = true;
          sources.push(`implicit:${regex.source}`);
        }
      }

      // 6. Check mention context (only if not implicit)
      let isMention = false;
      if (!isImplicit) {
        for (const regex of mentionContextRegexes) {
          if (regex.test(message)) {
            isMention = true;
            sources.push(`mention_context:${regex.source}`);
          }
        }
      }

      // 7. Check bare tool name (fallback)
      const hasToolName = toolNameRegex.test(message);

      if (isImplicit) {
        level = 'implicit';
      } else if (isMention) {
        level = 'mention';
      } else if (hasToolName) {
        level = 'mention';
        sources.push('tool_name_only');
      }
    }

    // ai: true only for explicit and implicit
    const ai = level === 'explicit' || level === 'implicit';
    return { ai, level, sources };
  };
}
