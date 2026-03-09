/**
 * Claude OS — Git Evidence Capture
 *
 * Captures git state (status, diff, log) as proof artifacts.
 * Uses command-runner for execution. Never throws, never crashes the bundle.
 * If any git command fails, records PASS_WITH_LIMITATIONS.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { runCommand } from './command-runner.js';
import { ensureDir, safeWriteText } from './fs-utils.js';

import type { CommandRunner, GitEvidenceCaptureResult, GitEvidenceFileEntry } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Git commands to execute and their output destinations */
const GIT_EVIDENCE_COMMANDS = [
  {
    command: 'git status',
    outputFile: 'proofs/proof_git_status.txt',
    description: 'Git working tree status',
    format: 'evidence' as const,
  },
  {
    command: 'git diff',
    outputFile: 'diffs/sprint_changes.diff',
    description: 'Sprint code changes',
    format: 'raw' as const,
  },
  {
    command: 'git log -n 20 --oneline',
    outputFile: 'proofs/proof_git_log.txt',
    description: 'Recent commit history',
    format: 'evidence' as const,
  },
] as const;

/** Known git evidence output file paths */
export const GIT_EVIDENCE_PATHS: string[] = GIT_EVIDENCE_COMMANDS.map(c => c.outputFile);

/** Map of output file to human-readable description */
export const GIT_EVIDENCE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  GIT_EVIDENCE_COMMANDS.map(c => [c.outputFile, c.description])
);

/** Map of output file to git command (for proof-index-renderer) */
export const GIT_EVIDENCE_COMMAND_MAP: Record<string, string> = Object.fromEntries(
  GIT_EVIDENCE_COMMANDS.map(c => [c.outputFile, c.command])
);

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GitEvidenceCaptureOptions {
  /** Custom command runner for testing (defaults to real runCommand) */
  commandRunner?: CommandRunner;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Capture git evidence and write to the artifact root.
 *
 * Runs git status, git diff, and git log. Writes output to:
 * - proofs/proof_git_status.txt
 * - diffs/sprint_changes.diff
 * - proofs/proof_git_log.txt
 *
 * Never throws. If a git command fails, the overall status is
 * PASS_WITH_LIMITATIONS (never FAIL/BLOCKED).
 */
export function captureGitEvidence(
  artifactRoot: string,
  options?: GitEvidenceCaptureOptions
): GitEvidenceCaptureResult {
  const runner = options?.commandRunner ?? runCommand;
  const capturedAt = new Date().toISOString();
  const files: GitEvidenceFileEntry[] = [];
  const failures: string[] = [];

  // Ensure directories exist
  ensureDir(path.join(artifactRoot, 'proofs'));
  ensureDir(path.join(artifactRoot, 'diffs'));

  for (const spec of GIT_EVIDENCE_COMMANDS) {
    const entry = captureOneGitCommand(
      runner,
      spec.command,
      spec.outputFile,
      spec.description,
      spec.format,
      artifactRoot,
      capturedAt
    );

    files.push(entry);
    if (!entry.success) {
      failures.push(`${spec.description} (${spec.command}): capture failed`);
    }
  }

  return {
    success: true,
    status: failures.length === 0 ? 'PASS' : 'PASS_WITH_LIMITATIONS',
    files,
    failures,
    capturedAt,
  };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function captureOneGitCommand(
  runner: CommandRunner,
  command: string,
  outputFile: string,
  description: string,
  format: 'evidence' | 'raw',
  artifactRoot: string,
  capturedAt: string
): GitEvidenceFileEntry {
  try {
    const result = runner(command, { timeoutMs: 30_000 });

    const absPath = path.join(artifactRoot, outputFile);
    let content: string;

    if (format === 'raw') {
      content = result.stdout || '(no output)';
    } else {
      content = formatGitEvidenceFile(command, description, result, capturedAt);
    }

    // Write file even on non-zero exit (for diagnostics), but mark as failed
    const commandSucceeded = result.exitCode === 0;

    const writeResult = safeWriteText(absPath, content);
    if (!writeResult.success || !commandSucceeded) {
      return { command, outputFile, success: false, sizeBytes: 0, capturedAt };
    }

    let sizeBytes = 0;
    try {
      sizeBytes = fs.statSync(absPath).size;
    } catch {
      // non-critical
    }

    return { command, outputFile, success: true, sizeBytes, capturedAt };
  } catch {
    return { command, outputFile, success: false, sizeBytes: 0, capturedAt };
  }
}

function formatGitEvidenceFile(
  command: string,
  description: string,
  result: { exitCode: number | null; stdout: string; stderr: string; durationMs: number },
  capturedAt: string
): string {
  const sep = '='.repeat(80);
  const lines = [
    sep,
    'CLAUDE OS GIT EVIDENCE',
    sep,
    `Description: ${description}`,
    `Command:     ${command}`,
    `Exit Code:   ${result.exitCode}`,
    `Duration:    ${result.durationMs}ms`,
    `Captured:    ${capturedAt}`,
    sep,
    '',
    '--- OUTPUT ---',
    result.stdout || '(empty)',
    '',
  ];

  if (result.stderr) {
    lines.push('--- STDERR ---');
    lines.push(result.stderr);
    lines.push('');
  }

  return lines.join('\n');
}
