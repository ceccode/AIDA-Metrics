import { Commit, CommitStream, daysBetween } from '@aida-dev/core';
import { HotfixStats, OutcomeCorrelation, RevertStats } from './schema/metrics.js';

// Outcome correlation (#26), scoped to what git can actually answer.
//
// The original ask also wanted incidents (PagerDuty/Jira/Slack) and SAST
// findings — dropped: fetching those would need network access this tool
// deliberately doesn't have (the same reasoning that scoped fetch-prs, #51,
// to its own opt-in command). What's left is git-detectable and exact:
// reverts and hotfix-pattern commits, linked back to the attribution/mode
// of the commit(s) they respond to.

export const DEFAULT_HOTFIX_WINDOW_DAYS = 7;

// Conventional-commit fix prefixes, plus explicit hotfix/patch language.
const HOTFIX_SUBJECT = /^(fix|hotfix|patch)(\(|:|\s|$)/i;

function emptyAttributionCounts() {
  return { ai: 0, human: 0, automated: 0, unknown: 0 };
}
function emptyModeCounts() {
  return { none: 0, autocomplete: 0, assisted: 0, agent: 0, unknown: 0 };
}

function calculateReverts(commitStream: CommitStream): RevertStats {
  const byHash = new Map(commitStream.commits.map((c) => [c.hash, c]));
  let total = 0;
  let resolved = 0;
  const byAttribution = emptyAttributionCounts();
  const byMode = emptyModeCounts();

  for (const commit of commitStream.commits) {
    if (!commit.revertsCommit) continue;
    total++;
    const target = byHash.get(commit.revertsCommit);
    // Not every revert target is in the collected window (e.g. --since, or
    // the target predates collection) — that's expected, not an error.
    if (!target) continue;
    resolved++;
    byAttribution[target.tags.attribution]++;
    byMode[target.tags.mode]++;
  }

  return { total, resolved, byAttribution, byMode };
}

// A hotfix's "cause" is approximated as the most recent commit that touched
// the same file(s) beforehand, within the window. When a hotfix touches
// several files, the closest antecedent across all of them wins — the file
// most recently disturbed is the most likely trigger.
function calculateHotfixes(
  commitStream: CommitStream,
  windowDays: number
): HotfixStats {
  const sorted = [...commitStream.commits].sort(
    (a, b) => new Date(a.authorDate).getTime() - new Date(b.authorDate).getTime()
  );

  const lastTouch = new Map<string, { date: Date; commit: Commit }>();
  let total = 0;
  let linked = 0;
  const byAttribution = emptyAttributionCounts();
  const byMode = emptyModeCounts();

  for (const commit of sorted) {
    if (HOTFIX_SUBJECT.test(commit.message)) {
      total++;
      let antecedent: Commit | null = null;
      let smallestGap = Infinity;

      for (const file of commit.stats.files) {
        const prior = lastTouch.get(file.path);
        if (!prior) continue;
        const gapDays = daysBetween(prior.date, new Date(commit.authorDate));
        if (gapDays <= windowDays && gapDays < smallestGap) {
          smallestGap = gapDays;
          antecedent = prior.commit;
        }
      }

      if (antecedent) {
        linked++;
        byAttribution[antecedent.tags.attribution]++;
        byMode[antecedent.tags.mode]++;
      }
    }

    // Update touch history after checking: a hotfix can't be its own
    // antecedent, but it does become one for a later hotfix (a chain of
    // fixes attributes to the immediately preceding touch, not the origin).
    for (const file of commit.stats.files) {
      if (file.status === 'deleted') {
        lastTouch.delete(file.path);
      } else {
        lastTouch.set(file.path, { date: new Date(commit.authorDate), commit });
      }
    }
  }

  return { windowDays, total, linked, byAttribution, byMode };
}

export function calculateOutcomeCorrelation(
  commitStream: CommitStream,
  options: { hotfixWindowDays?: number } = {}
): OutcomeCorrelation {
  const { hotfixWindowDays = DEFAULT_HOTFIX_WINDOW_DAYS } = options;
  return {
    reverts: calculateReverts(commitStream),
    hotfixes: calculateHotfixes(commitStream, hotfixWindowDays),
  };
}
