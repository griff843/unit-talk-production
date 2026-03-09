/**
 * Tests for queue-manager.ts (Phase H)
 *
 * Verifies queue scanning, issue loading, and deterministic selection.
 * Uses os.tmpdir() with temp issue files.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { scanIssueQueue, selectNextIssue } from '../queue-manager.js';

import type { IssueFile, WorkflowStateFile } from '../types.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-queue-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIssue(overrides?: Partial<IssueFile>): IssueFile {
  return {
    issueVersion: '1.0.0',
    issueId: 'ISSUE-Q-001',
    projectId: 'unit-talk',
    taskType: 'docs',
    title: 'Queue test issue',
    objective: 'Test queue scanning',
    summary: 'Test summary',
    acceptanceCriteria: ['Criteria 1'],
    touchedAreas: ['docs/'],
    dependencies: [],
    priority: 'normal',
    ...overrides,
  };
}

function writeIssue(dir: string, filename: string, issue: IssueFile): void {
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(issue, null, 2));
}

function emptyWorkflowState(): WorkflowStateFile {
  return {
    stateVersion: '1.0.0',
    issues: {},
    lastScanAt: null,
    activeRun: null,
  };
}

// ---------------------------------------------------------------------------
// Tests: scanIssueQueue
// ---------------------------------------------------------------------------

describe('scanIssueQueue', () => {
  it('should load all .json files from directory', () => {
    writeIssue(tmpRoot, 'ISSUE-001.json', makeIssue({ issueId: 'ISSUE-001' }));
    writeIssue(tmpRoot, 'ISSUE-002.json', makeIssue({ issueId: 'ISSUE-002' }));

    const result = scanIssueQueue({ issuesDir: tmpRoot });

    expect(result.totalFiles).toBe(2);
    expect(result.loaded).toBe(2);
    expect(result.issues).toHaveLength(2);
  });

  it('should return empty result when directory is missing', () => {
    const result = scanIssueQueue({ issuesDir: path.join(tmpRoot, 'nonexistent') });

    expect(result.totalFiles).toBe(0);
    expect(result.loaded).toBe(0);
    expect(result.issues).toHaveLength(0);
  });

  it('should include eligibility and autonomy results per issue', () => {
    writeIssue(tmpRoot, 'ISSUE-001.json', makeIssue({ issueId: 'ISSUE-001' }));

    const result = scanIssueQueue({ issuesDir: tmpRoot });

    expect(result.issues[0].eligibility).toBeDefined();
    expect(result.issues[0].autonomy).toBeDefined();
    expect(result.issues[0].autonomy.decision).toBeDefined();
  });

  it('should record load errors for invalid JSON files', () => {
    fs.writeFileSync(path.join(tmpRoot, 'bad.json'), '{ invalid json }}}');

    const result = scanIssueQueue({ issuesDir: tmpRoot });

    expect(result.totalFiles).toBe(1);
    expect(result.loaded).toBe(0);
    expect(result.loadErrors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: selectNextIssue
// ---------------------------------------------------------------------------

describe('selectNextIssue', () => {
  it('should return highest priority eligible issue', () => {
    writeIssue(tmpRoot, 'ISSUE-001.json', makeIssue({ issueId: 'ISSUE-001', priority: 'low' }));
    writeIssue(tmpRoot, 'ISSUE-002.json', makeIssue({ issueId: 'ISSUE-002', priority: 'high' }));

    const scan = scanIssueQueue({ issuesDir: tmpRoot });
    const selection = selectNextIssue(scan, emptyWorkflowState());

    expect(selection.selected).not.toBeNull();
    expect(selection.selected!.issueId).toBe('ISSUE-002');
  });

  it('should return null when no eligible issues', () => {
    // Runtime type is denied by default autonomy policy
    writeIssue(tmpRoot, 'ISSUE-001.json', makeIssue({ issueId: 'ISSUE-001', taskType: 'runtime' }));

    const scan = scanIssueQueue({ issuesDir: tmpRoot });
    const selection = selectNextIssue(scan, emptyWorkflowState());

    expect(selection.selected).toBeNull();
  });

  it('should skip issues in running state', () => {
    writeIssue(tmpRoot, 'ISSUE-001.json', makeIssue({ issueId: 'ISSUE-001' }));

    const scan = scanIssueQueue({ issuesDir: tmpRoot });
    const state = emptyWorkflowState();
    state.issues['ISSUE-001'] = {
      issueId: 'ISSUE-001',
      state: 'running',
      updatedAt: new Date().toISOString(),
      reason: 'In progress',
      history: [],
    };

    const selection = selectNextIssue(scan, state);
    expect(selection.selected).toBeNull();
  });

  it('should skip issues in awaiting_ratification state', () => {
    writeIssue(tmpRoot, 'ISSUE-001.json', makeIssue({ issueId: 'ISSUE-001' }));

    const scan = scanIssueQueue({ issuesDir: tmpRoot });
    const state = emptyWorkflowState();
    state.issues['ISSUE-001'] = {
      issueId: 'ISSUE-001',
      state: 'awaiting_ratification',
      updatedAt: new Date().toISOString(),
      reason: 'Waiting',
      history: [],
    };

    const selection = selectNextIssue(scan, state);
    expect(selection.selected).toBeNull();
  });

  it('should break priority ties by issueId alphabetical', () => {
    writeIssue(tmpRoot, 'ISSUE-BBB.json', makeIssue({ issueId: 'ISSUE-BBB', priority: 'normal' }));
    writeIssue(tmpRoot, 'ISSUE-AAA.json', makeIssue({ issueId: 'ISSUE-AAA', priority: 'normal' }));

    const scan = scanIssueQueue({ issuesDir: tmpRoot });
    const selection = selectNextIssue(scan, emptyWorkflowState());

    expect(selection.selected).not.toBeNull();
    expect(selection.selected!.issueId).toBe('ISSUE-AAA');
  });

  it('should skip issues denied by autonomy policy', () => {
    writeIssue(tmpRoot, 'ISSUE-001.json', makeIssue({ issueId: 'ISSUE-001', taskType: 'schema' }));
    writeIssue(tmpRoot, 'ISSUE-002.json', makeIssue({ issueId: 'ISSUE-002', taskType: 'docs' }));

    const scan = scanIssueQueue({ issuesDir: tmpRoot });
    const selection = selectNextIssue(scan, emptyWorkflowState());

    expect(selection.selected).not.toBeNull();
    expect(selection.selected!.issueId).toBe('ISSUE-002');
  });
});
