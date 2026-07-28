export type AILevel = 'explicit' | 'implicit' | 'mention' | 'none';

// Four-state attribution (#34, #39). Message heuristics can only ever
// produce 'ai' or 'unknown': the absence of an AI signal is not evidence of
// human authorship. 'human' requires an explicit declaration (manifest,
// #10). 'automated' is provenance-known automation — merge commits, release
// bots — detected at collect time or declared via the manifest; it counts
// toward coverage but joins no cohort.
export type Attribution = 'ai' | 'human' | 'automated' | 'unknown';

// Autonomy axis (#25): what level of AI participated. The durable dimension
// in an AI-first world, where "was AI involved" trends toward "yes".
export type AIMode = 'none' | 'autocomplete' | 'assisted' | 'agent' | 'unknown';

// How we know the mode: 'declared' = explicit statement (manifest mode
// field, future commit-time hooks); 'inferred' = derived from tool identity
// via MODE_BY_TOOL — real signal, our conclusion; 'none' = no signal at all.
export type ModeEvidence = 'declared' | 'inferred' | 'none';

// Tool identity → coarse autonomy mode. Deliberately rough: a trailer names
// the tool, not the session mode. First match wins; multi-word names before
// their prefixes ('claude code' before 'claude').
export const MODE_BY_TOOL: Array<[pattern: RegExp, mode: AIMode]> = [
  [/\bclaude\s+code\b/i, 'agent'],
  // Co-Authored-By: Claude <noreply@anthropic.com> is Claude Code's own
  // commit convention → agent
  [/\bclaude\b/i, 'agent'],
  [/\bcopilot\b/i, 'autocomplete'],
  [/\b(cursor|windsurf|codeium|chatgpt|gemini)\b/i, 'assisted'],
];

export function inferMode(message: string): AIMode {
  for (const [pattern, mode] of MODE_BY_TOOL) {
    if (pattern.test(message)) {
      return mode;
    }
  }
  return 'unknown';
}

export interface AITagResult {
  ai: boolean;
  attribution: Attribution;
  mode: AIMode;
  modeEvidence: ModeEvidence;
  level: AILevel;
  sources: string[];
}

export interface AITagConfig {
  patterns: string[];
  tools?: string[];
  trailerDomains?: string[];
  botBlocklist?: string[];
}

export const DEFAULT_TOOLS = ['copilot', 'cursor', 'windsurf', 'codeium', 'claude', 'chatgpt', 'gemini'];
const DEFAULT_TRAILER_DOMAINS = ['anthropic', 'openai', 'github\\.com'];

// Known non-AI automation bots. Their `Co-authored-by` trailers must not be
// counted as AI contributions even though they match the generic `.*bot.*`
// pattern (or a github.com domain, in dependabot's case).
export const DEFAULT_BOT_BLOCKLIST = [
  'dependabot',
  'renovate',
  'github-actions',
  'greenkeeper',
  'snyk-bot',
  'mergify',
  'imgbot',
  'allcontributors',
];

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

  // Merge default bot blocklist with user-provided entries
  const allBlocked = [...DEFAULT_BOT_BLOCKLIST, ...(config.botBlocklist || [])];
  const blockedLineRegex = allBlocked.length
    ? new RegExp(`^Co-authored-by:.*\\b(${allBlocked.join('|')})\\b`, 'i')
    : null;

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

    // Strip Co-authored-by lines from blocklisted non-AI bots so they can't
    // trigger explicit classification via the generic bot/domain trailers.
    const trailerText = blockedLineRegex
      ? message
          .split('\n')
          .filter((line) => !blockedLineRegex.test(line))
          .join('\n')
      : message;

    // 1. Check trailers (always explicit)
    for (let i = 0; i < trailerRegexes.length; i++) {
      if (trailerRegexes[i].test(trailerText)) {
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
    // Mode inference only makes sense once AI involvement is established
    const mode = ai ? inferMode(message) : 'unknown';
    return {
      ai,
      attribution: ai ? 'ai' : 'unknown',
      mode,
      modeEvidence: mode === 'unknown' ? 'none' : 'inferred',
      level,
      sources,
    };
  };
}
