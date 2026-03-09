/**
 * Claude OS — Workflow State Manager
 *
 * Manages persistent workflow state for the autopilot orchestrator.
 * Tracks issue processing states and enforces valid transitions.
 *
 * State file: governance/claude-os/state/workflow-state.json
 */

import { resolveRepoPath, ensureDir, safeReadJson, safeWriteJson } from './fs-utils.js';

import type {
  WorkflowState,
  WorkflowTransition,
  WorkflowStateEntry,
  WorkflowStateFile,
  ActiveRunInfo,
  PipelineStage,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKFLOW_STATE_DIR = 'governance/claude-os/state';
const WORKFLOW_STATE_FILE = 'governance/claude-os/state/workflow-state.json';
const STATE_VERSION = '1.0.0';

/**
 * Valid transitions from each state.
 * 'initial' represents an issue not yet tracked.
 */
const VALID_TRANSITIONS: Record<WorkflowState | 'initial', WorkflowState[]> = {
  initial: ['discovered'],
  discovered: ['eligible', 'blocked'],
  eligible: ['running'],
  blocked: ['discovered'],
  running: ['proof_ready', 'failed'],
  proof_ready: ['awaiting_ratification'],
  awaiting_ratification: [],
  failed: ['discovered'],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WorkflowStateOptions {
  /** Override state file path (for testing) */
  stateFilePath?: string;
}

/** Load workflow state from disk. Returns empty state if file missing. */
export function loadWorkflowState(options?: WorkflowStateOptions): WorkflowStateFile {
  const filePath = options?.stateFilePath ?? resolveRepoPath(WORKFLOW_STATE_FILE);
  const result = safeReadJson<WorkflowStateFile>(filePath);

  if (result.success && result.content) {
    return result.content;
  }

  return {
    stateVersion: STATE_VERSION,
    issues: {},
    lastScanAt: null,
    activeRun: null,
  };
}

/** Save workflow state to disk. */
export function saveWorkflowState(
  state: WorkflowStateFile,
  options?: WorkflowStateOptions
): { success: boolean; error: string | null } {
  const filePath = options?.stateFilePath ?? resolveRepoPath(WORKFLOW_STATE_FILE);
  const dirPath = options?.stateFilePath
    ? filePath.replace(/[/\\][^/\\]+$/, '')
    : resolveRepoPath(WORKFLOW_STATE_DIR);

  ensureDir(dirPath);
  return safeWriteJson(filePath, state);
}

/** Get the workflow state entry for an issue. Returns null if not tracked. */
export function getIssueState(
  state: WorkflowStateFile,
  issueId: string
): WorkflowStateEntry | null {
  return state.issues[issueId] ?? null;
}

/** Check whether a transition is valid. */
export function isValidTransition(from: WorkflowState | 'initial', to: WorkflowState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed !== undefined && allowed.includes(to);
}

/**
 * Transition an issue to a new state.
 * Creates the entry if not yet tracked (from = 'initial').
 * Returns error string if transition is invalid, null on success.
 */
export function transitionIssue(
  state: WorkflowStateFile,
  issueId: string,
  to: WorkflowState,
  reason: string
): string | null {
  const existing = state.issues[issueId];
  const from: WorkflowState | 'initial' = existing?.state ?? 'initial';

  if (!isValidTransition(from, to)) {
    return `Invalid transition: ${from} → ${to} for issue ${issueId}`;
  }

  const now = new Date().toISOString();
  const transition: WorkflowTransition = { from, to, at: now, reason };

  if (existing) {
    existing.state = to;
    existing.updatedAt = now;
    existing.reason = reason;
    existing.history.push(transition);
  } else {
    state.issues[issueId] = {
      issueId,
      state: to,
      updatedAt: now,
      reason,
      history: [transition],
    };
  }

  return null;
}

/** Set the active run info. */
export function setActiveRun(
  state: WorkflowStateFile,
  issueId: string,
  stage: PipelineStage
): void {
  state.activeRun = {
    issueId,
    startedAt: new Date().toISOString(),
    pipelineStage: stage,
  };
}

/** Clear the active run info. */
export function clearActiveRun(state: WorkflowStateFile): void {
  state.activeRun = null;
}
