/**
 * Tests for implementation-engine.ts (Phase G)
 *
 * Verifies implementation start/check: scope contract writing, snapshot
 * capture, boundary validation, change receipt generation, and diff artifacts.
 * Uses os.tmpdir() for file isolation and fake command runners for DI.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  startImplementation,
  checkImplementation,
  parseGitNameStatus,
  parseGitNumstat,
} from '../implementation-engine.js';
import { loadProfileById } from '../profile-loader.js';

import type {
  CommandRunner,
  TaskEnvelope,
  ProjectProfile,
  ScopeContract,
  PreImplementationSnapshot,
} from '../types.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-impl-engine-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const profileResult = loadProfileById('unit-talk');
const unitTalkProfile: ProjectProfile = profileResult.profile!;

function makeEnvelope(overrides?: Partial<TaskEnvelope>): TaskEnvelope {
  return {
    envelopeVersion: '1.0.0',
    taskId: 'SPRINT-IMPL-TEST-001',
    taskType: 'runtime',
    projectId: 'unit-talk',
    objective: 'Test implementation engine',
    summary: 'Test summary',
    touchedAreas: ['apps/api/src/agents/SettlementAgent/', 'apps/api/src/activities/'],
    truthSourcesRequired: [],
    killConditions: [],
    notes: [],
    deferredRequirements: [],
    ...overrides,
  };
}

/** Fake runner that simulates clean git state */
function makeStartRunner(): CommandRunner {
  return command => {
    if (command === 'git rev-parse HEAD') {
      return {
        command,
        exitCode: 0,
        stdout: 'abc123def456\n',
        stderr: '',
        durationMs: 10,
        timedOut: false,
      };
    }
    if (command === 'git rev-parse --abbrev-ref HEAD') {
      return {
        command,
        exitCode: 0,
        stdout: 'main\n',
        stderr: '',
        durationMs: 10,
        timedOut: false,
      };
    }
    if (command === 'git status --porcelain') {
      return {
        command,
        exitCode: 0,
        stdout: '?? untracked-file.txt\n',
        stderr: '',
        durationMs: 10,
        timedOut: false,
      };
    }
    return { command, exitCode: 0, stdout: '', stderr: '', durationMs: 10, timedOut: false };
  };
}

/** Fake runner that simulates git diff with in-scope files */
function makeCheckRunner(nameStatus: string, numstat: string, diff: string): CommandRunner {
  return command => {
    if (command === 'git diff --name-status') {
      return {
        command,
        exitCode: 0,
        stdout: nameStatus,
        stderr: '',
        durationMs: 10,
        timedOut: false,
      };
    }
    if (command === 'git diff --numstat') {
      return { command, exitCode: 0, stdout: numstat, stderr: '', durationMs: 10, timedOut: false };
    }
    if (command === 'git diff') {
      return { command, exitCode: 0, stdout: diff, stderr: '', durationMs: 10, timedOut: false };
    }
    if (command === 'git rev-parse HEAD') {
      return {
        command,
        exitCode: 0,
        stdout: 'def789abc012\n',
        stderr: '',
        durationMs: 10,
        timedOut: false,
      };
    }
    return { command, exitCode: 0, stdout: '', stderr: '', durationMs: 10, timedOut: false };
  };
}

/** Write pre-existing start artifacts so check can load them */
function writeStartArtifacts(artifactRoot: string, envelope: TaskEnvelope) {
  const result = startImplementation(envelope, unitTalkProfile, artifactRoot, {
    commandRunner: makeStartRunner(),
  });
  expect(result.success).toBe(true);
}

// ---------------------------------------------------------------------------
// Tests: startImplementation
// ---------------------------------------------------------------------------

describe('startImplementation', () => {
  it('should write scope-contract.json to artifact root', () => {
    const result = startImplementation(makeEnvelope(), unitTalkProfile, tmpRoot, {
      commandRunner: makeStartRunner(),
    });

    expect(result.success).toBe(true);
    expect(result.scopeContractPath).not.toBeNull();
    expect(fs.existsSync(path.join(tmpRoot, 'scope-contract.json'))).toBe(true);

    const content = JSON.parse(fs.readFileSync(path.join(tmpRoot, 'scope-contract.json'), 'utf-8'));
    expect(content.contractVersion).toBe('1.0.0');
    expect(content.taskId).toBe('SPRINT-IMPL-TEST-001');
  });

  it('should write pre-snapshot.json to artifact root', () => {
    const result = startImplementation(makeEnvelope(), unitTalkProfile, tmpRoot, {
      commandRunner: makeStartRunner(),
    });

    expect(result.success).toBe(true);
    expect(result.snapshotPath).not.toBeNull();
    expect(fs.existsSync(path.join(tmpRoot, 'pre-snapshot.json'))).toBe(true);
  });

  it('should capture git HEAD from command runner', () => {
    const result = startImplementation(makeEnvelope(), unitTalkProfile, tmpRoot, {
      commandRunner: makeStartRunner(),
    });

    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot!.gitHead).toBe('abc123def456');
  });

  it('should capture git branch from command runner', () => {
    const result = startImplementation(makeEnvelope(), unitTalkProfile, tmpRoot, {
      commandRunner: makeStartRunner(),
    });

    expect(result.snapshot!.gitBranch).toBe('main');
  });

  it('should record untracked files from git status', () => {
    const result = startImplementation(makeEnvelope(), unitTalkProfile, tmpRoot, {
      commandRunner: makeStartRunner(),
    });

    expect(result.snapshot!.untrackedFiles).toContain('untracked-file.txt');
    expect(result.snapshot!.workingTreeClean).toBe(false);
  });

  it('should return error when git rev-parse fails', () => {
    const failRunner: CommandRunner = command => ({
      command,
      exitCode: 128,
      stdout: '',
      stderr: 'fatal: not a git repository',
      durationMs: 10,
      timedOut: false,
    });

    const result = startImplementation(makeEnvelope(), unitTalkProfile, tmpRoot, {
      commandRunner: failRunner,
    });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('git HEAD');
  });
});

// ---------------------------------------------------------------------------
// Tests: checkImplementation
// ---------------------------------------------------------------------------

describe('checkImplementation', () => {
  it('should load saved scope-contract.json', () => {
    writeStartArtifacts(tmpRoot, makeEnvelope());

    const nameStatus = 'M\tapps/api/src/agents/SettlementAgent/index.ts\n';
    const numstat = '10\t5\tapps/api/src/agents/SettlementAgent/index.ts\n';
    const diff = 'diff --git a/apps/api/src/agents/SettlementAgent/index.ts\n+added line\n';

    const result = checkImplementation(tmpRoot, {
      commandRunner: makeCheckRunner(nameStatus, numstat, diff),
    });

    expect(result.changeReceipt).not.toBeNull();
    expect(result.changeReceipt!.taskId).toBe('SPRINT-IMPL-TEST-001');
  });

  it('should fail-closed when scope-contract.json missing', () => {
    // Don't write start artifacts — go straight to check
    const result = checkImplementation(tmpRoot, {
      commandRunner: makeCheckRunner('', '', ''),
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('BLOCKED');
    expect(result.errors[0]).toContain('Scope contract not found');
  });

  it('should fail-closed when pre-snapshot.json missing', () => {
    // Write only scope contract, not snapshot
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'scope-contract.json'),
      JSON.stringify({
        contractVersion: '1.0.0',
        taskId: 'T',
        allowedPaths: [],
        forbiddenPaths: [],
        boundaryMode: 'strict',
        notes: [],
        generatedAt: '',
      })
    );

    const result = checkImplementation(tmpRoot, {
      commandRunner: makeCheckRunner('', '', ''),
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('BLOCKED');
    expect(result.errors[0]).toContain('Pre-snapshot not found');
  });

  it('should return PASS when all changed files are in scope', () => {
    writeStartArtifacts(tmpRoot, makeEnvelope());

    const nameStatus =
      'M\tapps/api/src/agents/SettlementAgent/index.ts\nM\tapps/api/src/activities/backfill.ts\n';
    const numstat =
      '10\t5\tapps/api/src/agents/SettlementAgent/index.ts\n3\t1\tapps/api/src/activities/backfill.ts\n';
    const diff = 'some diff content';

    const result = checkImplementation(tmpRoot, {
      commandRunner: makeCheckRunner(nameStatus, numstat, diff),
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('PASS');
    expect(result.boundaryValidation!.status).toBe('PASS');
    expect(result.boundaryValidation!.violations).toHaveLength(0);
    expect(result.boundaryValidation!.allowedFiles).toHaveLength(2);
  });

  it('should return FAIL for file outside allowed scope', () => {
    writeStartArtifacts(tmpRoot, makeEnvelope());

    const nameStatus = 'M\tapps/dashboard/src/components/Chart.tsx\n';
    const numstat = '5\t2\tapps/dashboard/src/components/Chart.tsx\n';
    const diff = 'some diff';

    const result = checkImplementation(tmpRoot, {
      commandRunner: makeCheckRunner(nameStatus, numstat, diff),
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.boundaryValidation!.status).toBe('FAIL');
    expect(result.boundaryValidation!.violations).toHaveLength(1);
    expect(result.boundaryValidation!.violations[0].violationType).toBe('outside_allowed');
  });

  it('should return FAIL for file in forbidden scope', () => {
    writeStartArtifacts(tmpRoot, makeEnvelope());

    const nameStatus = 'M\tCLAUDE_EXECUTION_CONTRACT.md\n';
    const numstat = '1\t0\tCLAUDE_EXECUTION_CONTRACT.md\n';
    const diff = 'some diff';

    const result = checkImplementation(tmpRoot, {
      commandRunner: makeCheckRunner(nameStatus, numstat, diff),
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.boundaryValidation!.violations[0].violationType).toBe('in_forbidden');
  });

  it('should write change-receipt.json with correct totals', () => {
    writeStartArtifacts(tmpRoot, makeEnvelope());

    const nameStatus =
      'M\tapps/api/src/agents/SettlementAgent/index.ts\nA\tapps/api/src/activities/new-file.ts\n';
    const numstat =
      '10\t5\tapps/api/src/agents/SettlementAgent/index.ts\n25\t0\tapps/api/src/activities/new-file.ts\n';
    const diff = 'some diff';

    const result = checkImplementation(tmpRoot, {
      commandRunner: makeCheckRunner(nameStatus, numstat, diff),
    });

    expect(result.changeReceiptPath).not.toBeNull();
    expect(fs.existsSync(path.join(tmpRoot, 'change-receipt.json'))).toBe(true);

    expect(result.changeReceipt!.totalFilesChanged).toBe(2);
    expect(result.changeReceipt!.totalLinesAdded).toBe(35);
    expect(result.changeReceipt!.totalLinesRemoved).toBe(5);
    expect(result.changeReceipt!.files[0].changeType).toBe('modified');
    expect(result.changeReceipt!.files[1].changeType).toBe('added');
  });

  it('should write sprint_changes.diff to diffs/ directory', () => {
    writeStartArtifacts(tmpRoot, makeEnvelope());

    const diff = 'diff --git a/file.ts\n+new line\n-old line\n';
    const result = checkImplementation(tmpRoot, {
      commandRunner: makeCheckRunner(
        'M\tapps/api/src/agents/SettlementAgent/x.ts\n',
        '1\t1\tapps/api/src/agents/SettlementAgent/x.ts\n',
        diff
      ),
    });

    expect(result.diffArtifactPath).not.toBeNull();
    const diffContent = fs.readFileSync(
      path.join(tmpRoot, 'diffs', 'sprint_changes.diff'),
      'utf-8'
    );
    expect(diffContent).toContain('diff --git');
  });

  it('should handle empty diff (no changes) as PASS', () => {
    writeStartArtifacts(tmpRoot, makeEnvelope());

    const result = checkImplementation(tmpRoot, {
      commandRunner: makeCheckRunner('', '', ''),
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('PASS');
    expect(result.boundaryValidation!.totalFilesChecked).toBe(0);
    expect(result.changeReceipt!.totalFilesChanged).toBe(0);
  });

  it('should be idempotent (re-running produces same result)', () => {
    writeStartArtifacts(tmpRoot, makeEnvelope());

    const nameStatus = 'M\tapps/api/src/agents/SettlementAgent/index.ts\n';
    const numstat = '10\t5\tapps/api/src/agents/SettlementAgent/index.ts\n';
    const diff = 'some diff';
    const runner = makeCheckRunner(nameStatus, numstat, diff);

    const result1 = checkImplementation(tmpRoot, { commandRunner: runner });
    const result2 = checkImplementation(tmpRoot, { commandRunner: runner });

    expect(result1.status).toBe(result2.status);
    expect(result1.changeReceipt!.totalFilesChanged).toBe(result2.changeReceipt!.totalFilesChanged);
    expect(result1.changeReceipt!.totalLinesAdded).toBe(result2.changeReceipt!.totalLinesAdded);
  });
});

// ---------------------------------------------------------------------------
// Tests: Parsers
// ---------------------------------------------------------------------------

describe('parseGitNameStatus', () => {
  it('should correctly parse A/M/D/R status letters', () => {
    const output = [
      'A\tnew-file.ts',
      'M\tmodified-file.ts',
      'D\tdeleted-file.ts',
      'R100\told-name.ts\tnew-name.ts',
    ].join('\n');

    const entries = parseGitNameStatus(output);
    expect(entries).toHaveLength(4);
    expect(entries[0]).toEqual({ path: 'new-file.ts', status: 'A' });
    expect(entries[1]).toEqual({ path: 'modified-file.ts', status: 'M' });
    expect(entries[2]).toEqual({ path: 'deleted-file.ts', status: 'D' });
    // Rename uses new path
    expect(entries[3]).toEqual({ path: 'new-name.ts', status: 'R100' });
  });
});

describe('parseGitNumstat', () => {
  it('should correctly parse line count output', () => {
    const output = ['10\t5\tfile-a.ts', '0\t3\tfile-b.ts', '-\t-\tbinary-file.png'].join('\n');

    const entries = parseGitNumstat(output);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ path: 'file-a.ts', added: 10, removed: 5 });
    expect(entries[1]).toEqual({ path: 'file-b.ts', added: 0, removed: 3 });
    expect(entries[2]).toEqual({ path: 'binary-file.png', added: 0, removed: 0 });
  });
});
