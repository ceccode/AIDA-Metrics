export type AILevel = 'explicit' | 'implicit' | 'mention' | 'none';

export interface AITagResult {
  ai: boolean;
  level: AILevel;
  sources: string[];
}

export interface AITagConfig {
  patterns: string[];
  tools?: string[];
  trailerDomains?: string[];
}

export const DEFAULT_TOOLS = ['copilot', 'cursor', 'windsurf', 'codeium', 'claude', 'chatgpt', 'gemini'];
const DEFAULT_TRAILER_DOMAINS = ['anthropic', 'openai', 'github\\.com'];

function buildPatterns(tools: string, domains: string) {
  return {
    explicitTag: '\\[ai\\]',
    explicitVerbs: [
      `(generated|created|written|built|authored|produced)\\s+(by|with|using)\\s+\\b(${tools})\\b`,
      `\\b(${tools})\\b\\s+(generated|created|wrote|built|authored|produced)`,
    ],
    trailers: [
      '^AI:\\s*true$',
      '^X-AI:\\s*true$',
      '^Co-authored-by:.*bot.*$',
      `^Co-authored-by:.*\\b(${domains})\\b.*$`,
    ],
    implicit: [
      `\\b(${tools})\\b\\s+(suggestions?|assisted|helped|recommended|review)`,
      `(suggested|assisted|helped|reviewed|recommended)\\s+(by|with|from)\\s+\\b(${tools})\\b`,
      `(with\\s+help\\s+from|with\\s+assistance\\s+from)\\s+\\b(${tools})\\b`,
    ],
    mentionContext: [
      `(fix|add|remove|disable|enable|configure|update|install|setup|document|test)\\b.*\\b(${tools})\\b`,
      `\\b(${tools})\\b\\s+(support|integration|config|configuration|setup|plugin|extension|bug|issue|error|detection|pattern|rule)`,
    ],
    toolName: `\\b(${tools})\\b`,
  };
}

export function createAITagger(
  config: AITagConfig = { patterns: [] }
): (message: string) => AITagResult {
  // Merge default tools with user-provided tools
  const allTools = [...DEFAULT_TOOLS, ...(config.tools || [])];
  const toolsPattern = allTools.join('|');

  // Merge default trailer domains with user-provided domains
  const allDomains = [...DEFAULT_TRAILER_DOMAINS, ...(config.trailerDomains || [])];
  const domainsPattern = allDomains.join('|');

  const p = buildPatterns(toolsPattern, domainsPattern);

  const explicitTagRegex = new RegExp(p.explicitTag, 'im');
  const explicitVerbRegexes = p.explicitVerbs.map((s) => new RegExp(s, 'im'));
  const trailerRegexes = p.trailers.map((s) => new RegExp(s, 'mi'));
  const implicitRegexes = p.implicit.map((s) => new RegExp(s, 'im'));
  const mentionContextRegexes = p.mentionContext.map((s) => new RegExp(s, 'im'));
  const toolNameRegex = new RegExp(p.toolName, 'im');
  const customRegexes = config.patterns.map((s) => new RegExp(s, 'im'));

  return (message: string): AITagResult => {
    const sources: string[] = [];
    let level: AILevel = 'none';

    // 1. Check trailers (always explicit)
    for (let i = 0; i < trailerRegexes.length; i++) {
      if (trailerRegexes[i].test(message)) {
        level = 'explicit';
        sources.push(`trailer:${p.trailers[i]}`);
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
