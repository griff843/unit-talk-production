/**
 * Tests for git-evidence.ts (Phase E)
 *
 * Verifies git evidence capture: command execution, file writing,
 * error handling, and format correctness.
 * Uses os.tmpdir() for file system isolation and fake runners for DI.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { captureGitEvidence } from '../git-evidence.js';

import type { CommandRunner } from '../types.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-git-evidence-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Fake Runners
// ---------------------------------------------------------------------------

const fakePassRunner: CommandRunner = command => ({
  command,
  exitCode: 0,
  stdout: `output of ${command}`,
  stderr: '',
  durationMs: 50,
  timedOut: false,
});

const fakeFailRunner: CommandRunner = command => ({
  command,
  exitCode: 128,
  stdout: '',
  stderr: `fatal: ${command} failed`,
  durationMs: 10,
  timedOut: false,
});

function makeMixedRunner(failCommand: string): CommandRunner {
  return command => {
    if (command === failCommand) {
      return {
        command,
        exitCode: 1,
        stdout: '',
        stderr: 'error',
        durationMs: 10,
        timedOut: false,
      };
    }
    return {
      command,
      exitCode: 0,
      stdout: `output of ${command}`,
      stderr: '',
      durationMs: 50,
      timedOut: false,
    };
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('captureGitEvidence', () => {
  it('should write all three evidence files when commands succeed', () => {
    const result = captureGitEvidence(tmpRoot, { commandRunner: fakePassRunner });

    expect(result.success).toBe(true);
    expect(result.status).toBe('PASS');
    expect(result.files).toHaveLength(3);
    expect(result.failures).toHaveLength(0);

    expect(fs.existsSync(path.join(tmpRoot, 'proofs', 'proof_git_status.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, 'diffs', 'sprint_changes.diff'))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, 'proofs', 'proof_git_log.txt'))).toBe(true);
  });

  it('should return PASS_WITH_LIMITATIONS when one command fails', () => {
    const runner = makeMixedRunner('git diff');
    const result = captureGitEvidence(tmpRoot, { commandRunner: runner });

    expect(result.success).toBe(true);
    expect(result.status).toBe('PASS_WITH_LIMITATIONS');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('git diff');

    // Other two files should still be written
    expect(fs.existsSync(path.join(tmpRoot, 'proofs', 'proof_git_status.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, 'proofs', 'proof_git_log.txt'))).toBe(true);
  });

  it('should return PASS_WITH_LIMITATIONS when all commands fail', () => {
    const result = captureGitEvidence(tmpRoot, { commandRunner: fakeFailRunner });

    expect(result.success).toBe(true);
    expect(result.status).toBe('PASS_WITH_LIMITATIONS');
    expect(result.failures).toHaveLength(3);
  });

  it('should never throw even when runner throws', () => {
    const throwingRunner: CommandRunner = () => {
      throw new Error('Unexpected crash');
    };

    const result = captureGitEvidence(tmpRoot, { commandRunner: throwingRunner });

    expect(result.success).toBe(true);
    expect(result.status).toBe('PASS_WITH_LIMITATIONS');
    expect(result.failures).toHaveLength(3);
  });

  it('should write raw diff content without evidence header for .diff files', () => {
    const result = captureGitEvidence(tmpRoot, { commandRunner: fakePassRunner });

    const diffContent = fs.readFileSync(
      path.join(tmpRoot, 'diffs', 'sprint_changes.diff'),
      'utf-8'
    );

    // Raw format: no evidence header
    expect(diffContent).not.toContain('CLAUDE OS GIT EVIDENCE');
    expect(diffContent).toContain('output of git diff');

    // Verify the diff file entry succeeded
    const diffEntry = result.files.find(f => f.outputFile === 'diffs/sprint_changes.diff');
    expect(diffEntry?.success).toBe(true);
  });

  it('should write formatted evidence header for proof files', () => {
    const result = captureGitEvidence(tmpRoot, { commandRunner: fakePassRunner });

    const statusContent = fs.readFileSync(
      path.join(tmpRoot, 'proofs', 'proof_git_status.txt'),
      'utf-8'
    );

    expect(statusContent).toContain('CLAUDE OS GIT EVIDENCE');
    expect(statusContent).toContain('Command:     git status');
    expect(statusContent).toContain('--- OUTPUT ---');
    expect(statusContent).toContain('output of git status');

    const logContent = fs.readFileSync(path.join(tmpRoot, 'proofs', 'proof_git_log.txt'), 'utf-8');

    expect(logContent).toContain('CLAUDE OS GIT EVIDENCE');
    expect(logContent).toContain('git log -n 20 --oneline');

    // Verify entries succeeded
    const statusEntry = result.files.find(f => f.outputFile === 'proofs/proof_git_status.txt');
    expect(statusEntry?.success).toBe(true);
  });

  it('should create necessary directories from empty tmpdir', () => {
    // tmpRoot has no subdirectories yet
    expect(fs.existsSync(path.join(tmpRoot, 'proofs'))).toBe(false);
    expect(fs.existsSync(path.join(tmpRoot, 'diffs'))).toBe(false);

    captureGitEvidence(tmpRoot, { commandRunner: fakePassRunner });

    expect(fs.existsSync(path.join(tmpRoot, 'proofs'))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, 'diffs'))).toBe(true);
  });

  it('should record correct sizeBytes in file entries', () => {
    const result = captureGitEvidence(tmpRoot, { commandRunner: fakePassRunner });

    for (const entry of result.files) {
      if (entry.success) {
        const absPath = path.join(tmpRoot, entry.outputFile);
        const actualSize = fs.statSync(absPath).size;
        expect(entry.sizeBytes).toBe(actualSize);
        expect(entry.sizeBytes).toBeGreaterThan(0);
      }
    }
  });
});
