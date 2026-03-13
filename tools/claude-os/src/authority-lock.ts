/**
 * Claude OS — Authority Lock Manager
 *
 * Enforces single-writer discipline on protected authority surfaces
 * as defined in governance/ai-orchestration/LLM_AUTHORITY_MAP.md §10.
 *
 * Authority Freeze Rule:
 *   If a sprint is active against a protected surface,
 *   no second sprint may begin touching that surface
 *   until the first sprint closes or is explicitly aborted.
 *
 * Lock state:
 *   governance/claude-os/state/authority-locks.json
 *
 * This module is fail-closed:
 *   - any lock acquisition on an already-locked surface returns an error
 *   - any write failure returns an explicit error, never silently swallows
 */

import { resolveRepoPath, ensureDir, safeReadJson, safeWriteJson } from './fs-utils.js';

import type {
  AuthoritySurface,
  AuthorityLockEntry,
  AuthorityLockRegistry,
  AuthorityConflictCheckResult,
  SprintStateOptions,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCKS_FILE = 'governance/claude-os/state/authority-locks.json';
const REGISTRY_VERSION = '1.0.0' as const;

// ---------------------------------------------------------------------------
// Path Resolution
// ---------------------------------------------------------------------------

function resolveLocksPath(options?: SprintStateOptions): string {
  return options?.authorityLocksPath ?? resolveRepoPath(LOCKS_FILE);
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

/** Load the authority lock registry from disk. Returns an empty registry if missing. */
export function loadAuthorityLocks(options?: SprintStateOptions): AuthorityLockRegistry {
  const filePath = resolveLocksPath(options);
  const result = safeReadJson<AuthorityLockRegistry>(filePath);

  if (result.success && result.content) {
    return result.content;
  }

  return emptyRegistry();
}

/** Save the authority lock registry to disk. Returns error string on failure, null on success. */
export function saveAuthorityLocks(
  registry: AuthorityLockRegistry,
  options?: SprintStateOptions
): string | null {
  const filePath = resolveLocksPath(options);

  // Ensure parent directory exists
  const stateDir = resolveRepoPath('governance/claude-os/state');
  const dirResult = ensureDir(stateDir);
  if (!dirResult.success) {
    return dirResult.error ?? 'Failed to create state directory';
  }

  registry.updated_at = new Date().toISOString();
  const writeResult = safeWriteJson(filePath, registry);
  if (!writeResult.success) {
    return writeResult.error ?? 'Failed to write authority lock registry';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Conflict Detection
// ---------------------------------------------------------------------------

/**
 * Check whether a new sprint may acquire locks on the given authority surfaces.
 *
 * Returns:
 *   allowed: true  → all surfaces are free, sprint may proceed
 *   allowed: false → one or more surfaces are locked by another sprint
 *
 * Note: a sprint may re-acquire its own locks without conflict (idempotent).
 */
export function checkConflict(
  registry: AuthorityLockRegistry,
  sprintId: string,
  surfaces: AuthoritySurface[]
): AuthorityConflictCheckResult {
  const free: AuthoritySurface[] = [];
  const conflicting: AuthoritySurface[] = [];

  for (const surface of surfaces) {
    const existingLock = registry.locks[surface];
    if (!existingLock) {
      free.push(surface);
    } else if (existingLock.sprint_id === sprintId) {
      // Same sprint re-acquiring its own lock — idempotent, not a conflict
      free.push(surface);
    } else {
      conflicting.push(surface);
    }
  }

  if (conflicting.length === 0) {
    return { allowed: true, free_surfaces: free, conflicting_surfaces: [], blocker_message: null };
  }

  const conflictDetails = conflicting
    .map(s => {
      const lock = registry.locks[s];
      return `${s} (held by ${lock?.sprint_id ?? 'unknown'})`;
    })
    .join(', ');

  return {
    allowed: false,
    free_surfaces: free,
    conflicting_surfaces: conflicting,
    blocker_message:
      `Authority surface conflict: sprint ${sprintId} cannot acquire locks on ` +
      `${conflictDetails}. ` +
      `The Authority Freeze Rule (LLM_AUTHORITY_MAP §10) requires the holding sprint ` +
      `to close or abort before a new sprint may touch the same surface.`,
  };
}

// ---------------------------------------------------------------------------
// Lock Acquisition / Release
// ---------------------------------------------------------------------------

/**
 * Acquire authority locks for a sprint on the given surfaces.
 *
 * Fail-closed:
 *   - If any surface is locked by a different sprint, returns an error and
 *     acquires NO locks (atomic all-or-nothing).
 *   - Returns null on success.
 */
export function lockSurfaces(
  registry: AuthorityLockRegistry,
  sprintId: string,
  primaryOwner: string,
  surfaces: AuthoritySurface[]
): string | null {
  if (surfaces.length === 0) return null;

  const conflict = checkConflict(registry, sprintId, surfaces);
  if (!conflict.allowed) {
    return conflict.blocker_message ?? 'Authority surface conflict detected';
  }

  const now = new Date().toISOString();
  for (const surface of surfaces) {
    const existingLock = registry.locks[surface];
    if (!existingLock || existingLock.sprint_id !== sprintId) {
      const entry: AuthorityLockEntry = {
        sprint_id: sprintId,
        primary_owner: primaryOwner,
        locked_at: now,
      };
      registry.locks[surface] = entry;
    }
    // If same sprint already holds lock, leave it unchanged (idempotent)
  }

  registry.updated_at = now;
  return null;
}

/**
 * Release authority locks held by a sprint.
 * Only releases locks where sprint_id matches — never releases another sprint's locks.
 * Returns the list of surfaces that were released.
 */
export function unlockSurfaces(
  registry: AuthorityLockRegistry,
  sprintId: string
): AuthoritySurface[] {
  const released: AuthoritySurface[] = [];

  for (const surface of Object.keys(registry.locks) as AuthoritySurface[]) {
    const lock = registry.locks[surface];
    if (lock && lock.sprint_id === sprintId) {
      delete registry.locks[surface];
      released.push(surface);
    }
  }

  if (released.length > 0) {
    registry.updated_at = new Date().toISOString();
  }

  return released;
}

/**
 * Get all surfaces currently locked by a specific sprint.
 */
export function getSprintLocks(
  registry: AuthorityLockRegistry,
  sprintId: string
): AuthoritySurface[] {
  return (Object.keys(registry.locks) as AuthoritySurface[]).filter(
    s => registry.locks[s]?.sprint_id === sprintId
  );
}

/**
 * Get all active locks across all sprints.
 */
export function getAllActiveLocks(
  registry: AuthorityLockRegistry
): Array<{ surface: AuthoritySurface; lock: AuthorityLockEntry }> {
  return (Object.keys(registry.locks) as AuthoritySurface[])
    .filter(s => registry.locks[s] !== undefined)
    .map(s => ({ surface: s, lock: registry.locks[s] as AuthorityLockEntry }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyRegistry(): AuthorityLockRegistry {
  return {
    registry_version: REGISTRY_VERSION,
    locks: {},
    updated_at: new Date().toISOString(),
  };
}
