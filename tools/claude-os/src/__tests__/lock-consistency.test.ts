/**
 * Lock Consistency Tests (Sprint 6 — SPRINT-CLAUDE-OS-LOCK-CONSISTENCY-006)
 *
 * Covers:
 *   1. Lock rollback restores clean registry after saveSprintState failure (S-1 scenario)
 *   2. Rollback does not fail on a never-locked sprint
 *   3. Force-unlock releases all surfaces held by a sprint
 *   4. Force-unlock works without an active sprint (orphaned lock recovery)
 *   5. Force-unlock does not disturb locks held by other sprints
 *   6. Lock release save-error baseline (A-2 scenario — clean path verifies no inconsistency)
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  loadAuthorityLocks,
  saveAuthorityLocks,
  lockSurfaces,
  unlockSurfaces,
  getSprintLocks,
  checkConflict,
} from '../authority-lock.js';
import { loadSprintState } from '../sprint-state.js';

import type { SprintStateOptions } from '../types.js';

// ---------------------------------------------------------------------------
// Test Fixture Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let stateOptions: SprintStateOptions;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-lock-consistency-test-'));
  stateOptions = {
    activeSprintPath: path.join(tmpDir, 'active-sprint.json'),
    authorityLocksPath: path.join(tmpDir, 'authority-locks.json'),
    historyDir: path.join(tmpDir, 'sprint-history'),
  };
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 1. Lock rollback restores clean registry (S-1 scenario)
// ---------------------------------------------------------------------------

describe('lock rollback on sprint start failure', () => {
  it('rollback restores clean registry and allows new sprint to claim surfaces', () => {
    const sprintId = 'SPRINT-TEST-S1-001';
    const surface = 'scoring_authority';

    // Step 1: Acquire lock (simulating commandSprintStart)
    const registry = loadAuthorityLocks(stateOptions);
    const lockError = lockSurfaces(registry, sprintId, 'claude_code', [surface]);
    expect(lockError).toBeNull();
    const saveLockError = saveAuthorityLocks(registry, stateOptions);
    expect(saveLockError).toBeNull();

    // Step 2: Verify lock is held
    const regAfterLock = loadAuthorityLocks(stateOptions);
    expect(getSprintLocks(regAfterLock, sprintId)).toContain(surface);

    // Step 3: Simulate saveSprintState failure — roll back locks
    const rollbackRegistry = loadAuthorityLocks(stateOptions);
    unlockSurfaces(rollbackRegistry, sprintId);
    const rollbackSaveError = saveAuthorityLocks(rollbackRegistry, stateOptions);
    expect(rollbackSaveError).toBeNull();

    // Step 4: Verify registry is clean
    const regAfterRollback = loadAuthorityLocks(stateOptions);
    expect(getSprintLocks(regAfterRollback, sprintId)).toHaveLength(0);

    // Step 5: New sprint should be able to claim the same surface
    const newSprintId = 'SPRINT-TEST-S1-002';
    const conflict = checkConflict(regAfterRollback, newSprintId, [surface]);
    expect(conflict.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Rollback does not fail on never-locked sprint
// ---------------------------------------------------------------------------

describe('rollback on never-locked sprint', () => {
  it('unlockSurfaces on a sprint that never acquired locks returns empty released list', () => {
    const sprintId = 'SPRINT-NEVER-LOCKED-001';

    const registry = loadAuthorityLocks(stateOptions);
    const released = unlockSurfaces(registry, sprintId);
    expect(released).toHaveLength(0);

    // Save is still a no-op error-free operation
    const saveError = saveAuthorityLocks(registry, stateOptions);
    expect(saveError).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Force-unlock releases all surfaces held by a sprint
// ---------------------------------------------------------------------------

describe('force-unlock releases held surfaces', () => {
  it('unlockSurfaces releases all surfaces held by the sprint', () => {
    const sprintId = 'SPRINT-FORCE-UNLOCK-001';
    const surfaces = ['scoring_authority', 'promotion_authority'] as const;

    // Acquire both locks
    const registry = loadAuthorityLocks(stateOptions);
    const lockError = lockSurfaces(registry, sprintId, 'claude_code', [...surfaces]);
    expect(lockError).toBeNull();
    const saveLockError = saveAuthorityLocks(registry, stateOptions);
    expect(saveLockError).toBeNull();

    // Force-unlock
    const regForUnlock = loadAuthorityLocks(stateOptions);
    const released = unlockSurfaces(regForUnlock, sprintId);
    const saveUnlockError = saveAuthorityLocks(regForUnlock, stateOptions);
    expect(saveUnlockError).toBeNull();

    // Both surfaces released
    expect(released).toHaveLength(2);
    expect(released).toContain('scoring_authority');
    expect(released).toContain('promotion_authority');

    // Registry confirms no locks remain for this sprint
    const regAfter = loadAuthorityLocks(stateOptions);
    expect(getSprintLocks(regAfter, sprintId)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Force-unlock works without active sprint (orphaned lock recovery)
// ---------------------------------------------------------------------------

describe('orphaned lock recovery', () => {
  it('force-unlock succeeds even when no active sprint state exists', () => {
    const sprintId = 'SPRINT-ORPHANED-001';
    const surface = 'settlement_authority';

    // Acquire lock and save it — then do NOT write any active sprint state
    const registry = loadAuthorityLocks(stateOptions);
    const lockError = lockSurfaces(registry, sprintId, 'claude_code', [surface]);
    expect(lockError).toBeNull();
    const saveLockError = saveAuthorityLocks(registry, stateOptions);
    expect(saveLockError).toBeNull();

    // Confirm no active sprint exists
    const activeState = loadSprintState(stateOptions);
    expect(activeState).toBeNull();

    // Force-unlock still works
    const regForUnlock = loadAuthorityLocks(stateOptions);
    unlockSurfaces(regForUnlock, sprintId);
    const saveUnlockError = saveAuthorityLocks(regForUnlock, stateOptions);
    expect(saveUnlockError).toBeNull();

    // Lock is gone
    const regAfter = loadAuthorityLocks(stateOptions);
    expect(getSprintLocks(regAfter, sprintId)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Force-unlock does not disturb locks held by other sprints
// ---------------------------------------------------------------------------

describe('cross-sprint lock isolation', () => {
  it('unlocking sprint-A does not affect sprint-B locks', () => {
    const sprintA = 'SPRINT-ISOLATION-A';
    const sprintB = 'SPRINT-ISOLATION-B';
    const surfaceA = 'scoring_authority';
    const surfaceB = 'settlement_authority';

    // SPRINT-A acquires surface-A
    const regA = loadAuthorityLocks(stateOptions);
    lockSurfaces(regA, sprintA, 'claude_code', [surfaceA]);
    saveAuthorityLocks(regA, stateOptions);

    // SPRINT-B acquires surface-B
    const regB = loadAuthorityLocks(stateOptions);
    lockSurfaces(regB, sprintB, 'claude_code', [surfaceB]);
    saveAuthorityLocks(regB, stateOptions);

    // Unlock SPRINT-A only
    const regForUnlock = loadAuthorityLocks(stateOptions);
    const released = unlockSurfaces(regForUnlock, sprintA);
    saveAuthorityLocks(regForUnlock, stateOptions);

    expect(released).toContain(surfaceA);
    expect(released).not.toContain(surfaceB);

    // SPRINT-B's lock is still intact
    const regAfter = loadAuthorityLocks(stateOptions);
    expect(getSprintLocks(regAfter, sprintB)).toContain(surfaceB);
    expect(getSprintLocks(regAfter, sprintA)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Lock release save-error baseline (A-2 scenario)
// ---------------------------------------------------------------------------

describe('lock release consistency (A-2 baseline)', () => {
  it('lock → save → unlock → save produces null errors and clean registry', () => {
    const sprintId = 'SPRINT-A2-BASELINE-001';
    const surface = 'discord_publish_authority';

    // Lock
    const registry = loadAuthorityLocks(stateOptions);
    const lockError = lockSurfaces(registry, sprintId, 'claude_code', [surface]);
    expect(lockError).toBeNull();
    const saveLockError = saveAuthorityLocks(registry, stateOptions);
    expect(saveLockError).toBeNull();

    // Unlock + save (the A-2 path that was previously WARNING-only)
    const regForUnlock = loadAuthorityLocks(stateOptions);
    unlockSurfaces(regForUnlock, sprintId);
    const saveUnlockError = saveAuthorityLocks(regForUnlock, stateOptions);
    expect(saveUnlockError).toBeNull();

    // A new sprint targeting the same surface has no conflict
    const newSprintId = 'SPRINT-A2-BASELINE-002';
    const regFinal = loadAuthorityLocks(stateOptions);
    const conflict = checkConflict(regFinal, newSprintId, [surface]);
    expect(conflict.allowed).toBe(true);
  });
});
