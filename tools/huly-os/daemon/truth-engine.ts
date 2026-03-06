/**
 * truth-engine.ts
 *
 * Evidence-based status derivation for Huly issues.
 * Pure logic — no side effects, no adapter dependencies.
 *
 * Rules (priority order):
 *   1. Complete tag exists → Done
 *   2. All linked PRs merged, none open → Done
 *   3. Open PR exists → In Progress
 *   4. Last activity > STALE_DAYS ago → Todo (stale)
 *   5. Recent activity within STALE_DAYS → In Progress
 *   6. No evidence at all → Backlog
 */

import { HULY_STATUS } from './adapters/types.js';

import type { HulyStatusId } from './adapters/types.js';

/** How many days of inactivity before an issue is considered stale */
export const STALE_DAYS = 14;

/** Evidence gathered for a single issue */
export interface StatusEvidence {
  /** Issue has a SPRINT-*-COMPLETE or SPRINT-*-CLOSURE git tag */
  hasCompleteTag: boolean;
  /** Tag name (for reporting) */
  completeTagName?: string;
  /** At least one PR merged to main referencing this issue */
  hasMergedPR: boolean;
  /** Merged PR numbers (for reporting) */
  mergedPRNumbers?: number[];
  /** At least one open PR referencing this issue */
  hasOpenPR: boolean;
  /** Open PR numbers (for reporting) */
  openPRNumbers?: number[];
  /** Most recent PR activity (created, merged, or updated) */
  lastRemoteActivity: Date | null;
  /** Current Huly status name */
  currentStatus: string;
}

/** Result of truth derivation */
export interface StatusVerdict {
  /** Derived status name: "Backlog", "Todo", "In Progress", "Done" */
  status: string;
  /** Huly status ID for TX operations */
  statusId: HulyStatusId;
  /** Human-readable reason for this status */
  reason: string;
  /** Whether derived status differs from current */
  needsTransition: boolean;
}

/**
 * Derive the truthful status for an issue based on evidence.
 */
export function deriveStatus(evidence: StatusEvidence): StatusVerdict {
  const { currentStatus } = evidence;

  // Skip manually cancelled issues — human override wins
  if (currentStatus === 'Cancelled') {
    return verdict('Cancelled', HULY_STATUS.Canceled, 'Manually cancelled', currentStatus);
  }

  // Rule 1: Complete tag → Done
  if (evidence.hasCompleteTag) {
    const tag = evidence.completeTagName ?? 'SPRINT-*-COMPLETE';
    return verdict('Done', HULY_STATUS.Done, `Sprint tag: ${tag}`, currentStatus);
  }

  // Rule 2: All PRs merged, none open → Done
  if (evidence.hasMergedPR && !evidence.hasOpenPR) {
    const prs = evidence.mergedPRNumbers?.map(n => `#${n}`).join(', ') ?? 'merged';
    return verdict('Done', HULY_STATUS.Done, `All linked PRs merged (${prs})`, currentStatus);
  }

  // Rule 3: Open PR → In Progress (even overrides Done — work reopened)
  if (evidence.hasOpenPR) {
    const prs = evidence.openPRNumbers?.map(n => `#${n}`).join(', ') ?? 'open';
    return verdict('In Progress', HULY_STATUS.InProgress, `Open PR: ${prs}`, currentStatus);
  }

  // Rule 4: Done is terminal — don't downgrade without contradicting evidence.
  // If someone manually marked an issue Done, respect that.
  if (currentStatus === 'Done') {
    return verdict('Done', HULY_STATUS.Done, 'Previously completed', currentStatus);
  }

  // Rule 5 & 6: Activity-based (only if there was any PR activity)
  if (evidence.lastRemoteActivity) {
    const now = new Date();
    const daysSince = Math.floor(
      (now.getTime() - evidence.lastRemoteActivity.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince > STALE_DAYS) {
      const dateStr = evidence.lastRemoteActivity.toISOString().slice(0, 10);
      return verdict(
        'Todo',
        HULY_STATUS.Todo,
        `Stale: no activity since ${dateStr} (${daysSince}d)`,
        currentStatus
      );
    }

    return verdict(
      'In Progress',
      HULY_STATUS.InProgress,
      `Recent activity: ${evidence.lastRemoteActivity.toISOString().slice(0, 10)}`,
      currentStatus
    );
  }

  // Rule 7: In Progress with no evidence → stale, move to Todo
  if (currentStatus === 'In Progress') {
    return verdict('Todo', HULY_STATUS.Todo, 'No linked PRs or recent activity', currentStatus);
  }

  // Rule 8: No evidence, not in progress → keep as-is (Todo stays Todo, Backlog stays Backlog)
  const currentStatusId = currentStatus === 'Backlog' ? HULY_STATUS.Backlog : HULY_STATUS.Todo;
  return verdict(currentStatus, currentStatusId, 'No linked PRs or tags', currentStatus);
}

/** Build a StatusVerdict, computing needsTransition */
function verdict(
  status: string,
  statusId: HulyStatusId,
  reason: string,
  currentStatus: string
): StatusVerdict {
  return {
    status,
    statusId,
    reason,
    needsTransition: status !== currentStatus,
  };
}

/**
 * Build evidence for an issue from available data.
 *
 * @param issueIdentifier - e.g. "UT-42"
 * @param currentStatus - current Huly status name
 * @param openPRs - all open PRs (pre-fetched)
 * @param mergedPRs - recently merged PRs (pre-fetched)
 * @param completeTags - set of SPRINT-*-COMPLETE tag names
 * @param issueToSprintMap - maps issue identifier to sprint ID (for tag lookup)
 */
export function buildEvidence(
  issueIdentifier: string,
  currentStatus: string,
  openPRs: Array<{
    number: number;
    linkedIssueRefs: string[];
    createdAt: string;
    mergedAt: string | null;
  }>,
  mergedPRs: Array<{
    number: number;
    linkedIssueRefs: string[];
    createdAt: string;
    mergedAt: string | null;
  }>,
  completeTags: Set<string>,
  issueToSprintMap?: Map<string, string>
): StatusEvidence {
  // Find PRs referencing this issue
  const linkedOpen = openPRs.filter(pr => pr.linkedIssueRefs.includes(issueIdentifier));
  const linkedMerged = mergedPRs.filter(pr => pr.linkedIssueRefs.includes(issueIdentifier));

  // Check for complete tag (direct match or via sprint mapping)
  let hasCompleteTag = false;
  let completeTagName: string | undefined;

  // Direct: identifier itself is a sprint tag (e.g. SPRINT-LIFECYCLE-038)
  for (const tag of completeTags) {
    if (tag.includes(issueIdentifier)) {
      hasCompleteTag = true;
      completeTagName = tag;
      break;
    }
  }

  // Via sprint map: issue belongs to a completed sprint
  if (!hasCompleteTag && issueToSprintMap) {
    const sprintId = issueToSprintMap.get(issueIdentifier);
    if (sprintId) {
      for (const tag of completeTags) {
        if (tag.includes(sprintId)) {
          hasCompleteTag = true;
          completeTagName = tag;
          break;
        }
      }
    }
  }

  // Compute last activity date from all linked PRs
  let lastRemoteActivity: Date | null = null;
  const allLinkedPRs = [...linkedOpen, ...linkedMerged];
  for (const pr of allLinkedPRs) {
    const dates = [pr.createdAt, pr.mergedAt].filter(Boolean) as string[];
    for (const d of dates) {
      const dt = new Date(d);
      if (!lastRemoteActivity || dt > lastRemoteActivity) {
        lastRemoteActivity = dt;
      }
    }
  }

  return {
    hasCompleteTag,
    completeTagName,
    hasMergedPR: linkedMerged.length > 0,
    mergedPRNumbers: linkedMerged.map(pr => pr.number),
    hasOpenPR: linkedOpen.length > 0,
    openPRNumbers: linkedOpen.map(pr => pr.number),
    lastRemoteActivity,
    currentStatus,
  };
}
