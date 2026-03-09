/**
 * Tests for workflow-state.ts (Phase H)
 *
 * Verifies state persistence, transition validation, active run tracking.
 * Uses os.tmpdir() for file isolation.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  loadWorkflowState,
  saveWorkflowState,
  getIssueState,
  isValidTransition,
  transitionIssue,
  setActiveRun,
  clearActiveRun,
} from '../workflow-state.js';

import type { WorkflowStateFile } from '../types.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tmpRoot: string;
let stateFilePath: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-wf-state-'));
  stateFilePath = path.join(tmpRoot, 'workflow-state.json');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const opts = () => ({ stateFilePath });

// ---------------------------------------------------------------------------
// Tests: loadWorkflowState / saveWorkflowState
// ---------------------------------------------------------------------------

describe('loadWorkflowState', () => {
  it('should return empty state when file is missing', () => {
    const state = loadWorkflowState(opts());

    expect(state.stateVersion).toBe('1.0.0');
    expect(state.issues).toEqual({});
    expect(state.lastScanAt).toBeNull();
    expect(state.activeRun).toBeNull();
  });

  it('should save and reload state correctly', () => {
    const state = loadWorkflowState(opts());
    transitionIssue(state, 'ISSUE-001', 'discovered', 'test');
    saveWorkflowState(state, opts());

    const reloaded = loadWorkflowState(opts());
    expect(reloaded.issues['ISSUE-001']).toBeDefined();
    expect(reloaded.issues['ISSUE-001'].state).toBe('discovered');
  });
});

// ---------------------------------------------------------------------------
// Tests: transitionIssue
// ---------------------------------------------------------------------------

describe('transitionIssue', () => {
  it('should transition from initial to discovered', () => {
    const state = loadWorkflowState(opts());
    const err = transitionIssue(state, 'ISSUE-001', 'discovered', 'Found in scan');

    expect(err).toBeNull();
    expect(state.issues['ISSUE-001'].state).toBe('discovered');
  });

  it('should transition from discovered to eligible', () => {
    const state = loadWorkflowState(opts());
    transitionIssue(state, 'ISSUE-001', 'discovered', 'Found');
    const err = transitionIssue(state, 'ISSUE-001', 'eligible', 'Passed checks');

    expect(err).toBeNull();
    expect(state.issues['ISSUE-001'].state).toBe('eligible');
  });

  it('should transition from discovered to blocked', () => {
    const state = loadWorkflowState(opts());
    transitionIssue(state, 'ISSUE-001', 'discovered', 'Found');
    const err = transitionIssue(state, 'ISSUE-001', 'blocked', 'Deps unresolved');

    expect(err).toBeNull();
    expect(state.issues['ISSUE-001'].state).toBe('blocked');
  });

  it('should transition from eligible to running', () => {
    const state = loadWorkflowState(opts());
    transitionIssue(state, 'ISSUE-001', 'discovered', 'Found');
    transitionIssue(state, 'ISSUE-001', 'eligible', 'Passed');
    const err = transitionIssue(state, 'ISSUE-001', 'running', 'Started');

    expect(err).toBeNull();
    expect(state.issues['ISSUE-001'].state).toBe('running');
  });

  it('should transition from running to proof_ready', () => {
    const state = loadWorkflowState(opts());
    transitionIssue(state, 'ISSUE-001', 'discovered', 'Found');
    transitionIssue(state, 'ISSUE-001', 'eligible', 'Passed');
    transitionIssue(state, 'ISSUE-001', 'running', 'Started');
    const err = transitionIssue(state, 'ISSUE-001', 'proof_ready', 'Done');

    expect(err).toBeNull();
    expect(state.issues['ISSUE-001'].state).toBe('proof_ready');
  });

  it('should transition from running to failed', () => {
    const state = loadWorkflowState(opts());
    transitionIssue(state, 'ISSUE-001', 'discovered', 'Found');
    transitionIssue(state, 'ISSUE-001', 'eligible', 'Passed');
    transitionIssue(state, 'ISSUE-001', 'running', 'Started');
    const err = transitionIssue(state, 'ISSUE-001', 'failed', 'Pipeline error');

    expect(err).toBeNull();
    expect(state.issues['ISSUE-001'].state).toBe('failed');
  });

  it('should reject invalid transition (discovered → running)', () => {
    const state = loadWorkflowState(opts());
    transitionIssue(state, 'ISSUE-001', 'discovered', 'Found');
    const err = transitionIssue(state, 'ISSUE-001', 'running', 'Skip eligible');

    expect(err).not.toBeNull();
    expect(err).toContain('Invalid transition');
    expect(state.issues['ISSUE-001'].state).toBe('discovered');
  });

  it('should append to history array', () => {
    const state = loadWorkflowState(opts());
    transitionIssue(state, 'ISSUE-001', 'discovered', 'Found');
    transitionIssue(state, 'ISSUE-001', 'eligible', 'Passed');

    expect(state.issues['ISSUE-001'].history).toHaveLength(2);
    expect(state.issues['ISSUE-001'].history[0].from).toBe('initial');
    expect(state.issues['ISSUE-001'].history[0].to).toBe('discovered');
    expect(state.issues['ISSUE-001'].history[1].from).toBe('discovered');
    expect(state.issues['ISSUE-001'].history[1].to).toBe('eligible');
  });
});

// ---------------------------------------------------------------------------
// Tests: isValidTransition
// ---------------------------------------------------------------------------

describe('isValidTransition', () => {
  it('should validate known transitions', () => {
    expect(isValidTransition('initial', 'discovered')).toBe(true);
    expect(isValidTransition('discovered', 'eligible')).toBe(true);
    expect(isValidTransition('eligible', 'running')).toBe(true);
    expect(isValidTransition('running', 'proof_ready')).toBe(true);
    expect(isValidTransition('proof_ready', 'awaiting_ratification')).toBe(true);
    expect(isValidTransition('failed', 'discovered')).toBe(true);
    expect(isValidTransition('blocked', 'discovered')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: setActiveRun / clearActiveRun
// ---------------------------------------------------------------------------

describe('setActiveRun / clearActiveRun', () => {
  it('should record issueId and stage', () => {
    const state = loadWorkflowState(opts());
    setActiveRun(state, 'ISSUE-001', 'envelope');

    expect(state.activeRun).not.toBeNull();
    expect(state.activeRun!.issueId).toBe('ISSUE-001');
    expect(state.activeRun!.pipelineStage).toBe('envelope');
    expect(state.activeRun!.startedAt).toBeTruthy();
  });

  it('should clear activeRun to null', () => {
    const state = loadWorkflowState(opts());
    setActiveRun(state, 'ISSUE-001', 'verify');
    clearActiveRun(state);

    expect(state.activeRun).toBeNull();
  });
});
