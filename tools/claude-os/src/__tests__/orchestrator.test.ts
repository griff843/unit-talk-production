/**
 * Tests for orchestrator.ts (Phase H)
 *
 * Verifies bounded autopilot cycle: frozen gate, issue selection,
 * pipeline execution, state transitions, dry-run mode.
 * Uses temp directories + DI for isolation.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { runAutopilotCycle, checkAutopilotFrozen } from '../orchestrator.js';

import type { IssueFile, CommandRunner } from '../types.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tmpRoot: string;
let issuesDir: string;
let stateFilePath: string;
let autopilotStatePath: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-orchestrator-'));
  issuesDir = path.join(tmpRoot, 'issues');
  stateFilePath = path.join(tmpRoot, 'workflow-state.json');
  autopilotStatePath = path.join(tmpRoot, 'autopilot_state.json');
  fs.mkdirSync(issuesDir, { recursive: true });

  // Write unfrozen autopilot state
  fs.writeFileSync(autopilotStatePath, JSON.stringify({ frozen: false }));
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
    issueId: 'ISSUE-ORCH-001',
    projectId: 'unit-talk',
    taskType: 'docs',
    title: 'Orchestrator test issue',
    objective: 'Test orchestrator pipeline',
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

/** Fake runner that simulates basic git commands for pipeline execution */
function makeFakeRunner(): CommandRunner {
  return command => {
    if (command === 'git rev-parse HEAD') {
      return {
        command,
        exitCode: 0,
        stdout: 'abc123\n',
        stderr: '',
        durationMs: 5,
        timedOut: false,
      };
    }
    if (command === 'git rev-parse --abbrev-ref HEAD') {
      return { command, exitCode: 0, stdout: 'main\n', stderr: '', durationMs: 5, timedOut: false };
    }
    if (command === 'git status --porcelain') {
      return { command, exitCode: 0, stdout: '', stderr: '', durationMs: 5, timedOut: false };
    }
    // Default: success with empty output (for verification commands, git diff, etc.)
    return { command, exitCode: 0, stdout: '', stderr: '', durationMs: 5, timedOut: false };
  };
}

// ---------------------------------------------------------------------------
// Tests: checkAutopilotFrozen
// ---------------------------------------------------------------------------

describe('checkAutopilotFrozen', () => {
  it('should return false when not frozen', () => {
    expect(checkAutopilotFrozen({ autopilotStatePath })).toBe(false);
  });

  it('should return true when frozen', () => {
    fs.writeFileSync(autopilotStatePath, JSON.stringify({ frozen: true }));
    expect(checkAutopilotFrozen({ autopilotStatePath })).toBe(true);
  });

  it('should return false when file is missing', () => {
    expect(checkAutopilotFrozen({ autopilotStatePath: path.join(tmpRoot, 'missing.json') })).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: runAutopilotCycle
// ---------------------------------------------------------------------------

describe('runAutopilotCycle', () => {
  it('should return NO_ELIGIBLE when no eligible issues exist', () => {
    // Empty issues directory
    const result = runAutopilotCycle({
      queueOptions: { issuesDir },
      workflowStateOptions: { stateFilePath },
    });

    expect(result.status).toBe('NO_ELIGIBLE');
    expect(result.issueId).toBeNull();
  });

  it('should return COMPLETED in dry-run mode with eligible issue', () => {
    writeIssue(issuesDir, 'ISSUE-001.json', makeIssue({ issueId: 'ISSUE-001' }));

    const result = runAutopilotCycle({
      queueOptions: { issuesDir },
      workflowStateOptions: { stateFilePath },
      dryRun: true,
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.issueId).toBe('ISSUE-001');
    expect(result.pipelineResults).toHaveLength(0);
    expect(result.reason).toContain('Dry-run');
  });

  it('should set and clear activeRun during dry-run cycle', () => {
    writeIssue(issuesDir, 'ISSUE-001.json', makeIssue({ issueId: 'ISSUE-001' }));

    runAutopilotCycle({
      queueOptions: { issuesDir },
      workflowStateOptions: { stateFilePath },
      dryRun: true,
    });

    // After dry-run, state should be saved with no active run
    const stateRaw = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
    expect(stateRaw.activeRun).toBeNull();
    // Issue should be in eligible state (rolled back from running)
    expect(stateRaw.issues['ISSUE-001'].state).toBe('eligible');
  });

  it('should record all pipeline stage results on failure', () => {
    writeIssue(issuesDir, 'ISSUE-001.json', makeIssue({ issueId: 'ISSUE-001' }));

    // Use a runner that will fail git commands needed by implement_start
    const failRunner: CommandRunner = command => ({
      command,
      exitCode: 128,
      stdout: '',
      stderr: 'fatal: error',
      durationMs: 5,
      timedOut: false,
    });

    const result = runAutopilotCycle({
      queueOptions: { issuesDir },
      workflowStateOptions: { stateFilePath },
      commandRunner: failRunner,
    });

    // Pipeline should have attempted stages and recorded results
    expect(result.pipelineResults.length).toBeGreaterThan(0);
    // At least the first stage result should exist
    expect(result.pipelineResults[0].stage).toBeDefined();
  });

  it('should transition issue to failed on pipeline error', () => {
    writeIssue(issuesDir, 'ISSUE-001.json', makeIssue({ issueId: 'ISSUE-001' }));

    const failRunner: CommandRunner = command => ({
      command,
      exitCode: 128,
      stdout: '',
      stderr: 'fatal: error',
      durationMs: 5,
      timedOut: false,
    });

    const result = runAutopilotCycle({
      queueOptions: { issuesDir },
      workflowStateOptions: { stateFilePath },
      commandRunner: failRunner,
    });

    expect(result.status).toBe('FAILED');

    // Verify state file reflects failure
    const stateRaw = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
    expect(stateRaw.issues['ISSUE-001'].state).toBe('failed');
  });
});
