/**
 * Claude OS — Command Runner
 *
 * Safe shell command execution with structured results.
 * Never throws. Never silently swallows failures.
 */

import { spawnSync } from 'node:child_process';

import { getWorkspaceRoot } from './fs-utils.js';

import type { CommandRunResult, CommandRunOptions } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const MAX_BUFFER_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a shell command and return structured results.
 * Never throws — exit code, stdout, stderr are always captured.
 */
export function runCommand(command: string, options?: CommandRunOptions): CommandRunResult {
  const cwd = options?.cwd ?? getWorkspaceRoot();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();

  try {
    const result = spawnSync(command, [], {
      shell: true,
      cwd,
      timeout: timeoutMs,
      encoding: 'utf-8',
      maxBuffer: MAX_BUFFER_BYTES,
      env: process.env,
    });

    const durationMs = Date.now() - start;
    const timedOut = result.signal === 'SIGTERM' || result.signal === 'SIGKILL';

    return {
      command,
      exitCode: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      durationMs,
      timedOut,
    };
  } catch (err) {
    // maxBuffer exceeded or other spawn error
    const durationMs = Date.now() - start;
    return {
      command,
      exitCode: null,
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
      durationMs,
      timedOut: false,
    };
  }
}
