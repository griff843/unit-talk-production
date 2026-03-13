/**
 * Claude OS — Sprint State Manager
 *
 * Manages persistent, machine-readable sprint state for Claude OS.
 * Sprint state is the single source of truth for:
 *   - which sprint is currently active
 *   - what stage execution has reached
 *   - which proof receipts have been registered
 *   - what receipts are still missing
 *   - current blockers and recommended next action
 *
 * State files:
 *   governance/claude-os/state/active-sprint.json      — current active sprint
 *   governance/claude-os/state/sprint-history/<id>.json — archived sprints
 *
 * Design law:
 *   - fail-closed: any write failure returns an explicit error, never silently swallows
 *   - no speculative mutations: callers supply the full delta, this module persists
 *   - single active sprint: starting a second sprint while one is active is an error
 *     UNLESS the caller has already verified authority surface conflicts are clear
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { resolveRepoPath, ensureDir, safeReadJson, safeWriteJson } from './fs-utils.js';

import type {
  ActiveSprintState,
  AuthoritySurface,
  FoundReceipt,
  ReceiptClass,
  SprintStage,
  SprintStateBlocker,
  SprintStateOptions,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_DIR = 'governance/claude-os/state';
const ACTIVE_SPRINT_FILE = 'governance/claude-os/state/active-sprint.json';
const HISTORY_DIR = 'governance/claude-os/state/sprint-history';
const STATE_VERSION = '1.0.0' as const;

/**
 * Required receipt classes per sprint classification.
 * Protected surfaces require elevated proof (repo + build + test + runtime/db + status).
 * Standard (non-protected) sprints require repo + build + test minimum.
 */
const PROTECTED_SURFACE_REQUIRED_RECEIPTS: ReceiptClass[] = ['repo', 'build', 'test', 'status'];

const STANDARD_REQUIRED_RECEIPTS: ReceiptClass[] = ['repo', 'build', 'test'];

/**
 * Stage advancement order — must be monotonically forward.
 */
const STAGE_ORDER: SprintStage[] = ['planning', 'implementing', 'verifying', 'bundling', 'closed'];

// ---------------------------------------------------------------------------
// Path Helpers
// ---------------------------------------------------------------------------

function resolveActiveSprintPath(options?: SprintStateOptions): string {
  return options?.activeSprintPath ?? resolveRepoPath(ACTIVE_SPRINT_FILE);
}

function resolveHistoryDir(options?: SprintStateOptions): string {
  return options?.historyDir ?? resolveRepoPath(HISTORY_DIR);
}

function resolveHistoryPath(sprintId: string, options?: SprintStateOptions): string {
  return path.join(resolveHistoryDir(options), `${sprintId}.json`);
}

// ---------------------------------------------------------------------------
// Computed Fields
// ---------------------------------------------------------------------------

/** Compute which required receipts have not yet been registered */
export function computeMissingReceipts(state: ActiveSprintState): ReceiptClass[] {
  const foundClasses = new Set(state.found_receipts.map(r => r.receipt_class));
  return state.required_receipts.filter(r => !foundClasses.has(r));
}

/** Compute the recommended next action based on current sprint state */
export function computeNextAction(state: ActiveSprintState): string {
  if (state.blockers.length > 0) {
    const blocking = state.blockers.filter(b => b.severity === 'blocking');
    if (blocking.length > 0) {
      return `Resolve ${blocking.length} blocking issue(s): ${blocking[0].description}`;
    }
    return `Address ${state.blockers.length} warning(s) before advancing`;
  }

  const missing = computeMissingReceipts(state);

  switch (state.stage) {
    case 'planning':
      return 'Begin implementation — advance stage to implementing';
    case 'implementing':
      if (missing.includes('repo'))
        return 'Run implementation and capture git diff proof (repo receipt)';
      return 'Advance to verifying stage — run verification suite';
    case 'verifying':
      if (missing.includes('build')) return 'Capture typecheck/build proof (build receipt)';
      if (missing.includes('test')) return 'Run tests and capture test output (test receipt)';
      if (missing.includes('runtime')) return 'Capture runtime execution proof (runtime receipt)';
      if (missing.includes('db')) return 'Capture database proof (db receipt)';
      if (missing.includes('distribution'))
        return 'Capture distribution proof (distribution receipt)';
      return 'All verification receipts found — advance to bundling stage';
    case 'bundling':
      if (missing.includes('status')) return 'Generate STATUS_DELTA.md artifact (status receipt)';
      return 'All receipts found — close sprint with closeSprintState()';
    case 'closed':
      return 'Sprint is closed — no action required';
    default:
      return 'Unknown stage — inspect sprint state';
  }
}

/** Compute required receipts for a sprint given its authority surfaces */
export function computeRequiredReceipts(
  authoritySurfaces: AuthoritySurface[],
  extraReceipts?: ReceiptClass[]
): ReceiptClass[] {
  const base =
    authoritySurfaces.length > 0
      ? [...PROTECTED_SURFACE_REQUIRED_RECEIPTS]
      : [...STANDARD_REQUIRED_RECEIPTS];

  // Add runtime receipt for surfaces that require it per LLM_AUTHORITY_MAP
  const runtimeSurfaces: AuthoritySurface[] = [
    'scoring_authority',
    'promotion_authority',
    'discord_publish_authority',
    'outbox_state_machine',
    'routing_status_engine',
  ];
  const dbSurfaces: AuthoritySurface[] = ['settlement_authority', 'canonical_schema_contract'];
  const distributionSurfaces: AuthoritySurface[] = ['discord_publish_authority'];

  if (authoritySurfaces.some(s => runtimeSurfaces.includes(s))) {
    if (!base.includes('runtime')) base.push('runtime');
  }
  if (authoritySurfaces.some(s => dbSurfaces.includes(s))) {
    if (!base.includes('db')) base.push('db');
  }
  if (authoritySurfaces.some(s => distributionSurfaces.includes(s))) {
    if (!base.includes('distribution')) base.push('distribution');
  }

  if (extraReceipts) {
    for (const r of extraReceipts) {
      if (!base.includes(r)) base.push(r);
    }
  }

  return base;
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

/** Load active sprint state from disk. Returns null if no active sprint. */
export function loadSprintState(options?: SprintStateOptions): ActiveSprintState | null {
  const filePath = resolveActiveSprintPath(options);
  const result = safeReadJson<ActiveSprintState>(filePath);

  if (!result.success || result.content === null) {
    return null;
  }

  return result.content;
}

/** Save sprint state to disk. Returns error string on failure, null on success. */
export function saveSprintState(
  state: ActiveSprintState,
  options?: SprintStateOptions
): string | null {
  const filePath = resolveActiveSprintPath(options);
  const dirResult = ensureDir(resolveRepoPath(STATE_DIR));
  if (!dirResult.success) {
    return dirResult.error ?? 'Failed to create state directory';
  }

  const writeResult = safeWriteJson(filePath, state);
  if (!writeResult.success) {
    return writeResult.error ?? 'Failed to write sprint state';
  }

  return null;
}

// ---------------------------------------------------------------------------
// State Creation
// ---------------------------------------------------------------------------

/**
 * Create a new active sprint state record.
 * Does NOT write to disk — caller must call saveSprintState.
 * Does NOT check authority locks — caller must call checkConflict first.
 */
export function createSprintState(params: {
  sprint_id: string;
  title: string;
  authority_surfaces: AuthoritySurface[];
  primary_owner: string;
  support_owners?: string[];
  extra_receipts?: ReceiptClass[];
  requested_maturity_delta?: string;
  repo_context_pack_path?: string | null;
}): ActiveSprintState {
  const now = new Date().toISOString();
  const required_receipts = computeRequiredReceipts(
    params.authority_surfaces,
    params.extra_receipts
  );

  const state: ActiveSprintState = {
    state_version: STATE_VERSION,
    sprint_id: params.sprint_id,
    title: params.title,
    status: 'active',
    stage: 'planning',
    authority_surfaces: params.authority_surfaces,
    primary_owner: params.primary_owner,
    support_owners: params.support_owners ?? [],
    repo_context_pack_path: params.repo_context_pack_path ?? null,
    prompt_pack_paths: [],
    status_artifact_path: null,
    required_receipts,
    found_receipts: [],
    missing_receipts: required_receipts,
    blockers: [],
    next_action: 'Begin implementation — advance stage to implementing',
    requested_maturity_delta: params.requested_maturity_delta ?? null,
    created_at: now,
    updated_at: now,
    closed_at: null,
  };

  return state;
}

// ---------------------------------------------------------------------------
// Stage Transitions
// ---------------------------------------------------------------------------

/**
 * Advance the sprint to a new stage.
 * Fail-closed: returns an error string if the transition is not valid.
 * Valid transitions: planning→implementing→verifying→bundling→closed
 */
export function updateSprintStage(state: ActiveSprintState, newStage: SprintStage): string | null {
  const currentIndex = STAGE_ORDER.indexOf(state.stage);
  const newIndex = STAGE_ORDER.indexOf(newStage);

  if (newIndex === -1) {
    return `Unknown stage: ${newStage}`;
  }
  if (currentIndex === -1) {
    return `Unknown current stage: ${state.stage}`;
  }
  if (newIndex <= currentIndex) {
    return `Cannot regress stage from ${state.stage} to ${newStage} — stages must advance monotonically`;
  }
  if (newIndex !== currentIndex + 1) {
    return `Cannot skip stages: ${state.stage} → ${newStage} (must go through ${STAGE_ORDER[currentIndex + 1]})`;
  }

  state.stage = newStage;
  state.updated_at = new Date().toISOString();
  state.missing_receipts = computeMissingReceipts(state);
  state.next_action = computeNextAction(state);

  return null;
}

// ---------------------------------------------------------------------------
// Receipt Registration
// ---------------------------------------------------------------------------

/**
 * Register a proof receipt on the sprint state.
 * Idempotent: registering the same class+path combination twice is a no-op.
 * Computes and stores a SHA256 hash of the artifact at registration time.
 * Updates missing_receipts and next_action after registration.
 */
export function registerReceipt(
  state: ActiveSprintState,
  receipt: Omit<FoundReceipt, 'captured_at' | 'sha256_hash'>
): void {
  // Idempotency: skip if same class+path already registered
  const alreadyExists = state.found_receipts.some(
    r => r.receipt_class === receipt.receipt_class && r.artifact_path === receipt.artifact_path
  );
  if (alreadyExists) return;

  // Compute SHA256 hash inline (avoids circular dep with receipt-validator.ts)
  let sha256_hash: string | undefined;
  try {
    const absPath = resolveRepoPath(receipt.artifact_path);
    const data = fs.readFileSync(absPath);
    sha256_hash = crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    sha256_hash = undefined; // file may not exist yet — non-fatal
  }

  state.found_receipts.push({
    ...receipt,
    captured_at: new Date().toISOString(),
    sha256_hash,
  });

  state.missing_receipts = computeMissingReceipts(state);
  state.next_action = computeNextAction(state);
  state.updated_at = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Blocker Management
// ---------------------------------------------------------------------------

/** Add a blocker to the sprint state */
export function addBlocker(
  state: ActiveSprintState,
  description: string,
  severity: SprintStateBlocker['severity'] = 'blocking'
): void {
  state.blockers.push({ description, severity, created_at: new Date().toISOString() });
  state.next_action = computeNextAction(state);
  state.updated_at = new Date().toISOString();
}

/** Remove a blocker by description match */
export function removeBlocker(state: ActiveSprintState, description: string): void {
  state.blockers = state.blockers.filter(b => b.description !== description);
  state.next_action = computeNextAction(state);
  state.updated_at = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Sprint Close / Archive
// ---------------------------------------------------------------------------

/**
 * Close a sprint and archive its state to sprint-history.
 *
 * Fail-closed: returns an error if required receipts are still missing
 * and force=false (default). Pass force=true to close despite missing receipts
 * (use for abort/emergency close only).
 *
 * On success:
 *   - state.status is set to 'complete' (or 'aborted' if forced with no receipts)
 *   - state.stage is set to 'closed'
 *   - archived to sprint-history/<sprint_id>.json
 *   - active-sprint.json is cleared (set to empty sentinel)
 */
export function closeSprintState(
  state: ActiveSprintState,
  options?: SprintStateOptions & { force?: boolean }
): string | null {
  const missing = computeMissingReceipts(state);

  if (missing.length > 0 && !options?.force) {
    return (
      `Cannot close sprint ${state.sprint_id} — missing required receipts: ` +
      missing.join(', ') +
      '. Use force=true to abort despite missing receipts.'
    );
  }

  const now = new Date().toISOString();
  state.status = missing.length === 0 ? 'complete' : 'aborted';
  state.stage = 'closed';
  state.closed_at = now;
  state.updated_at = now;
  state.missing_receipts = missing;
  state.next_action = 'Sprint is closed — no action required';

  // Write archive copy
  const historyDir = resolveHistoryDir(options);
  const dirResult = ensureDir(historyDir);
  if (!dirResult.success) {
    return dirResult.error ?? 'Failed to create sprint history directory';
  }

  const archivePath = resolveHistoryPath(state.sprint_id, options);
  const archiveResult = safeWriteJson(archivePath, state);
  if (!archiveResult.success) {
    return archiveResult.error ?? 'Failed to write sprint archive';
  }

  // Clear active-sprint.json by writing null sentinel
  const activeSprintPath = resolveActiveSprintPath(options);
  const clearResult = safeWriteJson(activeSprintPath, null);
  if (!clearResult.success) {
    return clearResult.error ?? 'Failed to clear active sprint state';
  }

  return null;
}

// ---------------------------------------------------------------------------
// History Access
// ---------------------------------------------------------------------------

/** Load a specific sprint from the history archive */
export function loadArchivedSprint(
  sprintId: string,
  options?: SprintStateOptions
): ActiveSprintState | null {
  const archivePath = resolveHistoryPath(sprintId, options);
  const result = safeReadJson<ActiveSprintState>(archivePath);

  if (!result.success || result.content === null) {
    return null;
  }

  return result.content;
}
