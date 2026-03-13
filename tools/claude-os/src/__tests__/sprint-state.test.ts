/**
 * Tests for sprint state management and authority lock enforcement.
 *
 * Covers:
 *   1. Active sprint state is created correctly
 *   2. Receipts update missing/found state correctly
 *   3. Protected authority locks block conflicting sprint starts
 *   4. Completed sprints archive correctly
 *   5. Review/resume reads state correctly
 *   6. Stage advancement is monotonic (no regression)
 *   7. computeRequiredReceipts maps surfaces to correct receipt classes
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  loadAuthorityLocks,
  saveAuthorityLocks,
  checkConflict,
  lockSurfaces,
  unlockSurfaces,
  getSprintLocks,
  getAllActiveLocks,
} from '../authority-lock.js';
import {
  createSprintState,
  loadSprintState,
  saveSprintState,
  updateSprintStage,
  registerReceipt,
  computeMissingReceipts,
  computeNextAction,
  computeRequiredReceipts,
  closeSprintState,
  loadArchivedSprint,
  addBlocker,
  removeBlocker,
} from '../sprint-state.js';

import type { ActiveSprintState, AuthoritySurface, SprintStateOptions } from '../types.js';

// ---------------------------------------------------------------------------
// Test Fixture Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let stateOptions: SprintStateOptions;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-sprint-state-test-'));
  stateOptions = {
    activeSprintPath: path.join(tmpDir, 'active-sprint.json'),
    authorityLocksPath: path.join(tmpDir, 'authority-locks.json'),
    historyDir: path.join(tmpDir, 'sprint-history'),
  };
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeSprintState(overrides?: Partial<ActiveSprintState>): ActiveSprintState {
  const base = createSprintState({
    sprint_id: 'SPRINT-TEST-001',
    title: 'Test sprint',
    authority_surfaces: [],
    primary_owner: 'claude_code',
  });
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// 1. Active sprint state creation
// ---------------------------------------------------------------------------

describe('createSprintState', () => {
  it('creates an active sprint with required fields', () => {
    const state = createSprintState({
      sprint_id: 'SPRINT-ALPHA-001',
      title: 'Alpha Sprint',
      authority_surfaces: [],
      primary_owner: 'claude_code',
    });

    expect(state.state_version).toBe('1.0.0');
    expect(state.sprint_id).toBe('SPRINT-ALPHA-001');
    expect(state.title).toBe('Alpha Sprint');
    expect(state.status).toBe('active');
    expect(state.stage).toBe('planning');
    expect(state.primary_owner).toBe('claude_code');
    expect(state.found_receipts).toEqual([]);
    expect(state.blockers).toEqual([]);
    expect(state.closed_at).toBeNull();
  });

  it('sets required_receipts to standard receipts for non-protected sprint', () => {
    const state = createSprintState({
      sprint_id: 'SPRINT-DOCS-001',
      title: 'Docs sprint',
      authority_surfaces: [],
      primary_owner: 'claude_code',
    });

    expect(state.required_receipts).toEqual(expect.arrayContaining(['repo', 'build', 'test']));
    expect(state.required_receipts).not.toContain('runtime');
  });

  it('sets required_receipts to protected receipts for authority surface sprint', () => {
    const state = createSprintState({
      sprint_id: 'SPRINT-SCORING-001',
      title: 'Scoring authority sprint',
      authority_surfaces: ['scoring_authority'],
      primary_owner: 'claude_code',
    });

    expect(state.required_receipts).toEqual(
      expect.arrayContaining(['repo', 'build', 'test', 'status', 'runtime'])
    );
  });

  it('includes db receipt for settlement_authority surface', () => {
    const required = computeRequiredReceipts(['settlement_authority']);
    expect(required).toContain('db');
    expect(required).toContain('status');
  });

  it('includes distribution receipt for discord_publish_authority surface', () => {
    const required = computeRequiredReceipts(['discord_publish_authority']);
    expect(required).toContain('distribution');
    expect(required).toContain('runtime');
  });

  it('missing_receipts equals required_receipts on creation', () => {
    const state = createSprintState({
      sprint_id: 'SPRINT-BETA-001',
      title: 'Beta Sprint',
      authority_surfaces: [],
      primary_owner: 'claude_code',
    });

    expect(state.missing_receipts).toEqual(state.required_receipts);
  });
});

// ---------------------------------------------------------------------------
// 2. Receipt registration updates missing/found correctly
// ---------------------------------------------------------------------------

describe('registerReceipt', () => {
  it('moves a receipt from missing to found', () => {
    const state = makeSprintState();
    expect(state.missing_receipts).toContain('repo');

    registerReceipt(state, {
      receipt_class: 'repo',
      artifact_path: 'out/sprints/SPRINT-TEST-001/2026-03-13/proofs/proof_git_status.txt',
      description: 'Git status output',
    });

    expect(state.found_receipts).toHaveLength(1);
    expect(state.found_receipts[0].receipt_class).toBe('repo');
    expect(state.missing_receipts).not.toContain('repo');
  });

  it('is idempotent — registering same class+path twice does not duplicate', () => {
    const state = makeSprintState();

    registerReceipt(state, {
      receipt_class: 'repo',
      artifact_path: 'out/proof.txt',
      description: 'First registration',
    });
    registerReceipt(state, {
      receipt_class: 'repo',
      artifact_path: 'out/proof.txt',
      description: 'Duplicate registration',
    });

    expect(state.found_receipts).toHaveLength(1);
  });

  it('allows same class at different paths (two artifacts of same class)', () => {
    const state = makeSprintState();

    registerReceipt(state, {
      receipt_class: 'repo',
      artifact_path: 'out/proof-status.txt',
      description: 'Git status',
    });
    registerReceipt(state, {
      receipt_class: 'repo',
      artifact_path: 'out/proof-diff.txt',
      description: 'Git diff',
    });

    expect(state.found_receipts).toHaveLength(2);
  });

  it('updates next_action after all receipts are registered', () => {
    const state = createSprintState({
      sprint_id: 'SPRINT-TEST-001',
      title: 'Test',
      authority_surfaces: [],
      primary_owner: 'claude_code',
    });
    // Advance to verifying stage
    updateSprintStage(state, 'implementing');
    updateSprintStage(state, 'verifying');

    for (const rc of state.required_receipts) {
      registerReceipt(state, {
        receipt_class: rc,
        artifact_path: `out/proof-${rc}.txt`,
        description: `${rc} proof`,
      });
    }

    expect(state.missing_receipts).toHaveLength(0);
    expect(state.next_action).toContain('advance to bundling');
  });

  it('sets captured_at timestamp on registration', () => {
    const state = makeSprintState();
    registerReceipt(state, {
      receipt_class: 'build',
      artifact_path: 'out/proof.txt',
      description: 'Typecheck output',
    });

    const receipt = state.found_receipts[0];
    expect(receipt.captured_at).toBeTruthy();
    expect(() => new Date(receipt.captured_at)).not.toThrow();
  });
});

describe('computeMissingReceipts', () => {
  it('returns empty array when all required receipts are found', () => {
    const state = makeSprintState();
    for (const rc of state.required_receipts) {
      registerReceipt(state, {
        receipt_class: rc,
        artifact_path: `out/${rc}.txt`,
        description: `${rc}`,
      });
    }
    expect(computeMissingReceipts(state)).toHaveLength(0);
  });

  it('returns only the receipts not yet found', () => {
    const state = makeSprintState();
    registerReceipt(state, {
      receipt_class: 'repo',
      artifact_path: 'out/repo.txt',
      description: 'repo',
    });
    const missing = computeMissingReceipts(state);
    expect(missing).not.toContain('repo');
    expect(missing).toContain('build');
    expect(missing).toContain('test');
  });
});

// ---------------------------------------------------------------------------
// 3. Authority locks block conflicting sprint starts
// ---------------------------------------------------------------------------

describe('authority lock conflict detection', () => {
  it('allows sprint to lock a free surface', () => {
    const registry = loadAuthorityLocks(stateOptions);
    const conflict = checkConflict(registry, 'SPRINT-A-001', ['scoring_authority']);
    expect(conflict.allowed).toBe(true);
    expect(conflict.conflicting_surfaces).toHaveLength(0);
  });

  it('blocks a second sprint from locking a surface held by the first sprint', () => {
    const registry = loadAuthorityLocks(stateOptions);

    // Sprint A acquires lock
    const lockError = lockSurfaces(registry, 'SPRINT-A-001', 'claude_code', ['scoring_authority']);
    expect(lockError).toBeNull();

    // Sprint B attempts to acquire same surface
    const conflict = checkConflict(registry, 'SPRINT-B-001', ['scoring_authority']);
    expect(conflict.allowed).toBe(false);
    expect(conflict.conflicting_surfaces).toContain('scoring_authority');
    expect(conflict.blocker_message).toBeTruthy();
    expect(conflict.blocker_message).toContain('SPRINT-A-001');
  });

  it('allows same sprint to re-acquire its own lock (idempotent)', () => {
    const registry = loadAuthorityLocks(stateOptions);

    lockSurfaces(registry, 'SPRINT-A-001', 'claude_code', ['scoring_authority']);
    const conflict = checkConflict(registry, 'SPRINT-A-001', ['scoring_authority']);
    expect(conflict.allowed).toBe(true);
  });

  it('blocks partial conflict: returns all conflicting surfaces', () => {
    const registry = loadAuthorityLocks(stateOptions);

    lockSurfaces(registry, 'SPRINT-A-001', 'claude_code', ['scoring_authority']);

    // Sprint B wants both scoring_authority (held) and promotion_authority (free)
    const conflict = checkConflict(registry, 'SPRINT-B-001', [
      'scoring_authority',
      'promotion_authority',
    ]);
    expect(conflict.allowed).toBe(false);
    expect(conflict.conflicting_surfaces).toContain('scoring_authority');
    expect(conflict.free_surfaces).toContain('promotion_authority');
  });

  it('lockSurfaces is atomic — acquires no locks if conflict detected', () => {
    const registry = loadAuthorityLocks(stateOptions);

    lockSurfaces(registry, 'SPRINT-A-001', 'claude_code', ['scoring_authority']);

    // Attempt to acquire both scoring (held) and settlement (free) — should fail entirely
    const lockError = lockSurfaces(registry, 'SPRINT-B-001', 'claude_code', [
      'scoring_authority',
      'settlement_authority',
    ]);

    expect(lockError).toBeTruthy();
    // settlement_authority should NOT be locked since atomic lock failed
    expect(registry.locks['settlement_authority']).toBeUndefined();
  });

  it('unlockSurfaces releases locks held by the specified sprint', () => {
    const registry = loadAuthorityLocks(stateOptions);

    lockSurfaces(registry, 'SPRINT-A-001', 'claude_code', ['scoring_authority']);
    const released = unlockSurfaces(registry, 'SPRINT-A-001');

    expect(released).toContain('scoring_authority');
    expect(registry.locks['scoring_authority']).toBeUndefined();
  });

  it('unlockSurfaces does not release locks held by other sprints', () => {
    const registry = loadAuthorityLocks(stateOptions);

    lockSurfaces(registry, 'SPRINT-A-001', 'claude_code', ['scoring_authority']);
    lockSurfaces(registry, 'SPRINT-B-001', 'claude_code', ['promotion_authority']);

    unlockSurfaces(registry, 'SPRINT-A-001');

    // Sprint B's lock should remain
    expect(registry.locks['promotion_authority']).toBeDefined();
    expect(registry.locks['promotion_authority']?.sprint_id).toBe('SPRINT-B-001');
  });

  it('getSprintLocks returns only surfaces locked by the given sprint', () => {
    const registry = loadAuthorityLocks(stateOptions);

    lockSurfaces(registry, 'SPRINT-A-001', 'claude_code', [
      'scoring_authority',
      'promotion_authority',
    ]);
    lockSurfaces(registry, 'SPRINT-B-001', 'claude_code', ['settlement_authority']);

    const aLocks = getSprintLocks(registry, 'SPRINT-A-001');
    expect(aLocks).toContain('scoring_authority');
    expect(aLocks).toContain('promotion_authority');
    expect(aLocks).not.toContain('settlement_authority');
  });

  it('getAllActiveLocks returns all locked surfaces', () => {
    const registry = loadAuthorityLocks(stateOptions);

    lockSurfaces(registry, 'SPRINT-A-001', 'claude_code', ['scoring_authority']);
    lockSurfaces(registry, 'SPRINT-B-001', 'claude_code', ['settlement_authority']);

    const all = getAllActiveLocks(registry);
    expect(all).toHaveLength(2);
    const surfaces = all.map(e => e.surface);
    expect(surfaces).toContain('scoring_authority');
    expect(surfaces).toContain('settlement_authority');
  });

  it('persists and reloads authority locks correctly', () => {
    const registry = loadAuthorityLocks(stateOptions);
    lockSurfaces(registry, 'SPRINT-A-001', 'claude_code', ['routing_status_engine']);
    saveAuthorityLocks(registry, stateOptions);

    const reloaded = loadAuthorityLocks(stateOptions);
    expect(reloaded.locks['routing_status_engine']).toBeDefined();
    expect(reloaded.locks['routing_status_engine']?.sprint_id).toBe('SPRINT-A-001');
  });
});

// ---------------------------------------------------------------------------
// 4. Completed sprints archive correctly
// ---------------------------------------------------------------------------

describe('closeSprintState', () => {
  it('closes and archives a sprint with all receipts present', () => {
    const state = makeSprintState();

    // Register all required receipts
    for (const rc of state.required_receipts) {
      registerReceipt(state, {
        receipt_class: rc,
        artifact_path: `out/${rc}.txt`,
        description: `${rc}`,
      });
    }

    saveSprintState(state, stateOptions);
    const error = closeSprintState(state, stateOptions);

    expect(error).toBeNull();
    expect(state.status).toBe('complete');
    expect(state.stage).toBe('closed');
    expect(state.closed_at).toBeTruthy();

    // Archive should exist
    const archived = loadArchivedSprint('SPRINT-TEST-001', stateOptions);
    expect(archived).not.toBeNull();
    expect(archived?.status).toBe('complete');
    expect(archived?.sprint_id).toBe('SPRINT-TEST-001');
  });

  it('blocks close when required receipts are missing (fail-closed)', () => {
    const state = makeSprintState();
    // Do NOT register any receipts
    saveSprintState(state, stateOptions);

    const error = closeSprintState(state, stateOptions);
    expect(error).toBeTruthy();
    expect(error).toContain('missing required receipts');
    expect(state.status).toBe('active'); // status unchanged on error
  });

  it('allows forced abort despite missing receipts', () => {
    const state = makeSprintState();
    saveSprintState(state, stateOptions);

    const error = closeSprintState(state, { ...stateOptions, force: true });
    expect(error).toBeNull();
    expect(state.status).toBe('aborted');
    expect(state.stage).toBe('closed');
  });

  it('clears active-sprint.json after close', () => {
    const state = makeSprintState();
    for (const rc of state.required_receipts) {
      registerReceipt(state, {
        receipt_class: rc,
        artifact_path: `out/${rc}.txt`,
        description: `${rc}`,
      });
    }
    saveSprintState(state, stateOptions);
    closeSprintState(state, stateOptions);

    // After close, active sprint should be null
    const reloaded = loadSprintState(stateOptions);
    expect(reloaded).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Review/resume reads state correctly
// ---------------------------------------------------------------------------

describe('loadSprintState (resume/review)', () => {
  it('returns null when no active sprint exists', () => {
    const loaded = loadSprintState(stateOptions);
    expect(loaded).toBeNull();
  });

  it('persists and reloads sprint state correctly', () => {
    const state = createSprintState({
      sprint_id: 'SPRINT-RESUME-001',
      title: 'Resumable Sprint',
      authority_surfaces: ['routing_status_engine'],
      primary_owner: 'claude_code',
      support_owners: ['codex'],
    });

    updateSprintStage(state, 'implementing');
    registerReceipt(state, {
      receipt_class: 'repo',
      artifact_path: 'out/proof_git_status.txt',
      description: 'Git status',
    });

    saveSprintState(state, stateOptions);

    const reloaded = loadSprintState(stateOptions);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.sprint_id).toBe('SPRINT-RESUME-001');
    expect(reloaded?.stage).toBe('implementing');
    expect(reloaded?.found_receipts).toHaveLength(1);
    expect(reloaded?.found_receipts[0].receipt_class).toBe('repo');
    expect(reloaded?.missing_receipts).not.toContain('repo');
    expect(reloaded?.authority_surfaces).toContain('routing_status_engine');
    expect(reloaded?.support_owners).toContain('codex');
  });

  it('reloads blockers correctly', () => {
    const state = makeSprintState();
    addBlocker(state, 'TypeScript errors in api package', 'blocking');
    saveSprintState(state, stateOptions);

    const reloaded = loadSprintState(stateOptions);
    expect(reloaded?.blockers).toHaveLength(1);
    expect(reloaded?.blockers[0].description).toBe('TypeScript errors in api package');
    expect(reloaded?.blockers[0].severity).toBe('blocking');
  });
});

// ---------------------------------------------------------------------------
// 6. Stage advancement is monotonic
// ---------------------------------------------------------------------------

describe('updateSprintStage', () => {
  it('advances stage forward correctly', () => {
    const state = makeSprintState();
    expect(state.stage).toBe('planning');

    const err1 = updateSprintStage(state, 'implementing');
    expect(err1).toBeNull();
    expect(state.stage).toBe('implementing');

    const err2 = updateSprintStage(state, 'verifying');
    expect(err2).toBeNull();
    expect(state.stage).toBe('verifying');
  });

  it('rejects regression to a previous stage', () => {
    const state = makeSprintState();
    updateSprintStage(state, 'implementing');
    updateSprintStage(state, 'verifying');

    const err = updateSprintStage(state, 'implementing');
    expect(err).toBeTruthy();
    expect(err?.toLowerCase()).toContain('cannot regress');
    expect(state.stage).toBe('verifying'); // stage unchanged
  });

  it('rejects skipping stages', () => {
    const state = makeSprintState();
    const err = updateSprintStage(state, 'verifying'); // skip implementing
    expect(err).toBeTruthy();
    expect(err).toContain('skip');
  });

  it('updates next_action after stage advance', () => {
    const state = makeSprintState();
    updateSprintStage(state, 'implementing');
    expect(state.next_action).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 7. Blocker management
// ---------------------------------------------------------------------------

describe('blockers', () => {
  it('addBlocker adds a blocker and updates next_action', () => {
    const state = makeSprintState();
    addBlocker(state, 'Build is failing', 'blocking');

    expect(state.blockers).toHaveLength(1);
    expect(state.next_action).toContain('Resolve');
    expect(state.next_action).toContain('Build is failing');
  });

  it('removeBlocker removes by description', () => {
    const state = makeSprintState();
    addBlocker(state, 'Build is failing', 'blocking');
    removeBlocker(state, 'Build is failing');

    expect(state.blockers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. computeNextAction covers all stages
// ---------------------------------------------------------------------------

describe('computeNextAction', () => {
  it('recommends starting implementation from planning stage', () => {
    const state = makeSprintState();
    expect(computeNextAction(state)).toContain('implementing');
  });

  it('recommends capturing repo receipt in implementing stage', () => {
    const state = makeSprintState();
    updateSprintStage(state, 'implementing');
    expect(computeNextAction(state)).toContain('repo receipt');
  });

  it('recommends advancing to bundling after all verifying receipts found', () => {
    const state = makeSprintState();
    updateSprintStage(state, 'implementing');
    updateSprintStage(state, 'verifying');

    for (const rc of state.required_receipts) {
      registerReceipt(state, {
        receipt_class: rc,
        artifact_path: `out/${rc}.txt`,
        description: rc,
      });
    }

    expect(computeNextAction(state)).toContain('bundling');
  });

  it('returns closed message for closed stage', () => {
    const state = makeSprintState();
    state.stage = 'closed';
    expect(computeNextAction(state)).toContain('closed');
  });
});

// ---------------------------------------------------------------------------
// 8. SHA256 hash storage in registerReceipt (Sprint 4)
// ---------------------------------------------------------------------------

describe('registerReceipt — sha256_hash storage', () => {
  it('stores sha256_hash when artifact file exists', () => {
    const state = makeSprintState();
    const content = 'proof content for hash test';
    const artifactPath = path.join(tmpDir, 'out', 'proof_test.txt');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, content);

    // path.resolve(root, absolutePath) === absolutePath, so using an absolute path
    // as artifact_path causes resolveRepoPath to return it unchanged
    const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

    registerReceipt(state, {
      receipt_class: 'test',
      artifact_path: artifactPath,
      description: 'test proof',
    });

    const found = state.found_receipts[0];
    expect(found).toBeDefined();
    expect(found.sha256_hash).toBe(expectedHash);
  });

  it('sets sha256_hash to undefined when artifact file does not exist', () => {
    const state = makeSprintState();
    registerReceipt(state, {
      receipt_class: 'build',
      artifact_path: 'out/nonexistent-file-that-does-not-exist.txt',
      description: 'missing artifact',
    });

    const found = state.found_receipts[0];
    expect(found).toBeDefined();
    expect(found.sha256_hash).toBeUndefined();
  });

  it('registerReceipt idempotency still works with hash field', () => {
    const state = makeSprintState();
    registerReceipt(state, {
      receipt_class: 'repo',
      artifact_path: 'out/proof_git.txt',
      description: 'first',
    });
    registerReceipt(state, {
      receipt_class: 'repo',
      artifact_path: 'out/proof_git.txt',
      description: 'duplicate',
    });

    // Should still only have one receipt despite two calls
    expect(state.found_receipts.filter(r => r.receipt_class === 'repo')).toHaveLength(1);
    expect(state.found_receipts[0].description).toBe('first');
  });
});
