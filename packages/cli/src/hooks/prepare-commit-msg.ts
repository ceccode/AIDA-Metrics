// The prepare-commit-msg hook installed by `aida install-hooks` (#61).
//
// Deliberately self-contained POSIX shell: it runs on every commit, so it
// must not depend on `aida` being installed, on node startup time, or on
// network. Every failure path exits 0 — a provenance hook must never block
// a commit.

export const HOOK_MARKER = '# >>> aida-metrics mode stamp >>>';
export const HOOK_END_MARKER = '# <<< aida-metrics mode stamp <<<';

// Auto-detection is a convenience for known agent environments, not a
// guarantee. AIDA_MODE always wins; when nothing is known we write nothing,
// because an absent trailer honestly means "unknown" while a guessed one
// would be a fabricated declaration.
export const HOOK_SCRIPT = `#!/bin/sh
${HOOK_MARKER}
# Stamps 'AI-Mode: <mode>' so commit provenance is declared, not inferred.
# Docs: https://github.com/ceccode/AIDA-Metrics/issues/61
# Remove with: aida install-hooks --uninstall

aida_stamp_mode() {
  msg_file="$1"
  [ -f "$msg_file" ] || return 0

  # Already declared (amend, rebase, template, or an agent that stamps its
  # own): never write a second trailer.
  if grep -qiE '^AI-Mode:[[:space:]]*(none|autocomplete|assisted|agent)[[:space:]]*$' "$msg_file"; then
    return 0
  fi

  mode="$AIDA_MODE"

  # Best-effort detection of known agent environments
  if [ -z "$mode" ]; then
    if [ -n "$CLAUDECODE" ] || [ -n "$CLAUDE_CODE_ENTRYPOINT" ]; then
      mode="agent"
    elif [ -n "$CURSOR_TRACE_ID" ]; then
      mode="assisted"
    fi
  fi

  # Repo-wide default, opt-in via .aida.json { "defaultMode": "..." }
  if [ -z "$mode" ] && [ -f .aida.json ]; then
    mode=$(sed -n 's/.*"defaultMode"[[:space:]]*:[[:space:]]*"\\([a-z]*\\)".*/\\1/p' .aida.json | head -n 1)
  fi

  case "$mode" in
    none|autocomplete|assisted|agent) ;;
    *) return 0 ;;  # unknown stays unknown: write nothing
  esac

  # Comment lines are stripped by git; append before them so the trailer
  # survives into the final message.
  printf '\\nAI-Mode: %s\\n' "$mode" >> "$msg_file"
}

aida_stamp_mode "$1" 2>/dev/null || true
${HOOK_END_MARKER}
`;
