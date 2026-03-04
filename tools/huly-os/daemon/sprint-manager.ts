// HULY-OS v1: Deterministic sprint state machine
// Detects [SPRINT] issues, tracks state, links PRs, validates proofs.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { REPO_ROOT } from './config.js';

import type { HulyAdapter } from './adapters/huly-adapter.js';
import type { GitHubPR, HulyIssue, HulyStatusId, WorkflowRun } from './adapters/types.js';
import type { DaemonConfig } from './config.js';

// ── Sprint States ───────────────────────────────────────────────────────

export type SprintState = 'Planning' | 'In Progress' | 'Blocked' | 'Ready for Closeout' | 'Closed';

/** Deterministic state transition table */
const VALID_TRANSITIONS: Record<SprintState, SprintState[]> = {
  Planning: ['In Progress', 'Blocked', 'Closed'],
  'In Progress': ['Blocked', 'Ready for Closeout', 'Closed'],
  Blocked: ['In Progress', 'Closed'],
  'Ready for Closeout': ['In Progress', 'Blocked', 'Closed'],
  Closed: [], // terminal
};

// ── Sprint Detection ────────────────────────────────────────────────────

const SPRINT_TITLE_RE = /^\[SPRINT\]\s*(.+)$/;
const SPRINT_ID_RE = /SPRINT-[\w-]+-\d+/;

export interface SprintInfo {
  issue: HulyIssue;
  sprintId: string;
  currentState: SprintState;
  branch: string;
  linkedPRs: GitHubPR[];
  ciRuns: WorkflowRun[];
  proofPath: string | null;
  proofExists: boolean;
}

/** Map a Huly issue status to our sprint state */
function issueStatusToSprintState(status: string): SprintState {
  switch (status) {
    case 'Todo':
    case 'Backlog':
      return 'Planning';
    case 'In Progress':
      return 'In Progress';
    case 'Done':
      return 'Closed';
    case 'Cancelled':
      return 'Closed';
    default:
      return 'Planning';
  }
}

/** Map sprint state to Huly status ID */
function sprintStateToStatusId(state: SprintState): HulyStatusId {
  switch (state) {
    case 'Planning':
      return 'tracker:status:Todo';
    case 'In Progress':
      return 'tracker:status:InProgress';
    case 'Blocked':
      return 'tracker:status:InProgress'; // no native blocked status
    case 'Ready for Closeout':
      return 'tracker:status:InProgress'; // still in progress until closed
    case 'Closed':
      return 'tracker:status:Done';
  }
}

/** Extract sprint ID from issue title */
function extractSprintId(title: string): string | null {
  const match = title.match(SPRINT_ID_RE);
  return match ? match[0] : null;
}

/** Convert sprint ID to branch name */
export function sprintIdToBranch(sprintId: string): string {
  return `sprint/${sprintId.replace(/^SPRINT-/, '').toLowerCase()}`;
}

/** Convert branch name to sprint ID */
export function branchToSprintId(branch: string): string | null {
  const m = branch.match(/^sprint\/(.+)$/);
  return m ? `SPRINT-${m[1].toUpperCase()}` : null;
}

// ── Sprint Manager ──────────────────────────────────────────────────────

export interface SprintManagerResult {
  sprints: SprintInfo[];
  transitions: SprintTransition[];
  incidents: IncidentReport[];
}

export interface SprintTransition {
  sprintId: string;
  from: SprintState;
  to: SprintState;
  reason: string;
}

export interface IncidentReport {
  sprintId: string;
  issueTitle: string;
  reason: string;
  ciRunUrl?: string;
}

/**
 * Evaluate all sprint issues and determine state transitions.
 * This is pure logic — does NOT write to Huly. The caller decides whether to apply.
 */
export function evaluateSprints(
  hulyIssues: HulyIssue[],
  openPRs: GitHubPR[],
  mergedPRs: GitHubPR[],
  workflowRuns: WorkflowRun[]
): SprintManagerResult {
  const allPRs = [...openPRs, ...mergedPRs];
  const sprints: SprintInfo[] = [];
  const transitions: SprintTransition[] = [];
  const incidents: IncidentReport[] = [];

  // Find all [SPRINT] issues
  for (const issue of hulyIssues) {
    if (!SPRINT_TITLE_RE.test(issue.title)) continue;

    const sprintId = extractSprintId(issue.title);
    if (!sprintId) continue;

    const branch = sprintIdToBranch(sprintId);
    const currentState = issueStatusToSprintState(issue.status);

    // Find linked PRs (by branch name or UT-ref)
    const linkedPRs = allPRs.filter(
      pr =>
        pr.headBranch === branch ||
        pr.headBranch.includes(sprintId.toLowerCase()) ||
        pr.linkedIssueRefs.some(ref => issue.title.includes(ref))
    );

    // Find CI runs for this sprint's branch
    const ciRuns = workflowRuns.filter(run => run.headBranch === branch);

    // Determine proof path
    const dateStr = new Date().toISOString().slice(0, 10);
    const proofPath = `out/sprints/${sprintId}/${dateStr}`;
    const proofFullPath = resolve(REPO_ROOT, proofPath);
    const proofExists = existsSync(proofFullPath);

    const info: SprintInfo = {
      issue,
      sprintId,
      currentState,
      branch,
      linkedPRs,
      ciRuns,
      proofPath,
      proofExists,
    };
    sprints.push(info);

    // Determine desired state transition
    const desiredState = computeDesiredState(info);

    if (desiredState !== currentState && VALID_TRANSITIONS[currentState].includes(desiredState)) {
      transitions.push({
        sprintId,
        from: currentState,
        to: desiredState,
        reason: transitionReason(info, desiredState),
      });
    }

    // Check for CI failures → incidents
    const failedRuns = ciRuns.filter(r => r.conclusion === 'failure');
    for (const run of failedRuns) {
      incidents.push({
        sprintId,
        issueTitle: `[INCIDENT] CI failure on ${branch}: ${run.name}`,
        reason: `Workflow "${run.name}" failed on branch ${branch} (sha: ${run.headSha})`,
        ciRunUrl: run.url,
      });
    }
  }

  return { sprints, transitions, incidents };
}

/** Compute the desired sprint state based on signals */
function computeDesiredState(info: SprintInfo): SprintState {
  const { currentState, linkedPRs, ciRuns, proofExists } = info;

  // CI failure → Blocked
  const hasRecentFailure = ciRuns.some(r => r.conclusion === 'failure');
  if (hasRecentFailure && currentState !== 'Closed') {
    return 'Blocked';
  }

  // All PRs merged + proof exists → Ready for Closeout
  const allMerged = linkedPRs.length > 0 && linkedPRs.every(pr => pr.merged);
  if (allMerged && proofExists && currentState !== 'Closed') {
    return 'Ready for Closeout';
  }

  // Has open PRs → In Progress
  const hasOpenPRs = linkedPRs.some(pr => pr.state === 'open');
  if (hasOpenPRs && currentState === 'Planning') {
    return 'In Progress';
  }

  return currentState;
}

function transitionReason(info: SprintInfo, desired: SprintState): string {
  switch (desired) {
    case 'Blocked':
      return `CI failure detected on branch ${info.branch}`;
    case 'In Progress':
      return `Open PR(s) found on branch ${info.branch}`;
    case 'Ready for Closeout':
      return `All PRs merged and proof bundle exists at ${info.proofPath}`;
    case 'Closed':
      return 'Sprint completed and verified';
    default:
      return `State transition to ${desired}`;
  }
}

// ── Apply transitions ───────────────────────────────────────────────────

/**
 * Apply evaluated transitions to Huly.
 * Also creates [INCIDENT] issues for CI failures.
 */
export async function applySprintTransitions(
  huly: HulyAdapter,
  config: DaemonConfig,
  result: SprintManagerResult
): Promise<{ applied: number; incidentsCreated: number }> {
  let applied = 0;
  let incidentsCreated = 0;

  for (const transition of result.transitions) {
    const sprint = result.sprints.find(s => s.sprintId === transition.sprintId);
    if (!sprint) continue;

    try {
      const statusId = sprintStateToStatusId(transition.to);
      await huly.updateIssueStatus(sprint.issue.id, statusId, sprint.issue.project);

      // Add comment documenting the transition
      await huly.addComment(
        sprint.issue.id,
        `**Sprint state:** ${transition.from} → ${transition.to}\n\nReason: ${transition.reason}`
      );

      applied++;
    } catch (err) {
      console.warn(
        `Failed to apply transition for ${transition.sprintId}: ${(err as Error).message}`
      );
    }
  }

  // Create [INCIDENT] issues (idempotent by title)
  for (const incident of result.incidents) {
    try {
      const { created } = await huly.upsertIssueByTitle(
        config.HULY_PROJECT,
        incident.issueTitle,
        `${incident.reason}\n\n${incident.ciRunUrl ? `CI Run: ${incident.ciRunUrl}` : ''}`,
        { priority: 1 }
      );
      if (created) incidentsCreated++;
    } catch (err) {
      console.warn(`Failed to create incident: ${(err as Error).message}`);
    }
  }

  return { applied, incidentsCreated };
}
