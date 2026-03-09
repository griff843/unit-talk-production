/**
 * Tests for failure-classifier.ts (CLAUDE-OS-REDESIGN-001)
 *
 * Verifies failure classification across all categories:
 * application, infrastructure, toolchain, environment, governance, transient.
 * Pure function tests — no file I/O.
 */

import { describe, it, expect } from 'vitest';

import { classifyFailure } from '../failure-classifier.js';

import type { CommandRunResult, VerificationRequirement } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequirement(overrides?: Partial<VerificationRequirement>): VerificationRequirement {
  return {
    recipeId: 'test_recipe',
    purpose: 'Test purpose',
    required: true,
    commandPlaceholder: 'pnpm run test',
    commandResolved: true,
    outputFile: 'proofs/proof_test.txt',
    failureSeverity: 'blocking',
    notes: '',
    ...overrides,
  };
}

function makeCommandResult(overrides?: Partial<CommandRunResult>): CommandRunResult {
  return {
    command: 'pnpm run test',
    exitCode: 1,
    stdout: '',
    stderr: '',
    durationMs: 1000,
    timedOut: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('classifyFailure', () => {
  // --- Toolchain ---
  it('should classify unresolved commands as toolchain', () => {
    const result = classifyFailure(makeRequirement({ commandResolved: false }), null);

    expect(result.category).toBe('toolchain');
    expect(result.confidence).toBe(1.0);
    expect(result.retryable).toBe(false);
  });

  // --- Environment ---
  it('should classify null command result as environment', () => {
    const result = classifyFailure(makeRequirement(), null);

    expect(result.category).toBe('environment');
    expect(result.retryable).toBe(false);
  });

  // --- Transient (timeout) ---
  it('should classify timeouts as transient', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({ timedOut: true, durationMs: 300000 })
    );

    expect(result.category).toBe('transient');
    expect(result.retryable).toBe(true);
  });

  // --- Governance ---
  it('should classify lifecycle gate violations as governance', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        stderr: 'LIFECYCLE GATE VIOLATION: direct write to unified_picks',
      })
    );

    expect(result.category).toBe('governance');
    expect(result.retryable).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('should classify gate failures as governance', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        stdout: 'Violations found: 3\nGATE FAILED',
      })
    );

    expect(result.category).toBe('governance');
    expect(result.retryable).toBe(false);
  });

  // --- Infrastructure ---
  it('should classify ECONNREFUSED as infrastructure', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        stderr: 'Error: connect ECONNREFUSED 127.0.0.1:5432',
      })
    );

    expect(result.category).toBe('infrastructure');
    expect(result.retryable).toBe(true);
  });

  it('should classify connection refused as infrastructure', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        stderr: 'connection refused to database server',
      })
    );

    expect(result.category).toBe('infrastructure');
    expect(result.retryable).toBe(true);
  });

  it('should classify 503 errors as infrastructure', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        stderr: 'HTTP 503 Service Unavailable',
      })
    );

    expect(result.category).toBe('infrastructure');
    expect(result.retryable).toBe(true);
  });

  // --- Environment ---
  it('should classify MODULE_NOT_FOUND as environment', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        stderr: 'Error [ERR_MODULE_NOT_FOUND]: Cannot find module /app/dist/index.js',
      })
    );

    expect(result.category).toBe('environment');
    expect(result.retryable).toBe(false);
  });

  it('should classify permission errors as environment', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        stderr: 'EACCES: permission denied, open /etc/config',
      })
    );

    expect(result.category).toBe('environment');
    expect(result.retryable).toBe(false);
  });

  it('should classify git lock as environment', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        stderr: 'fatal: Unable to create .git/index.lock: File exists',
      })
    );

    expect(result.category).toBe('environment');
    expect(result.retryable).toBe(false);
  });

  // --- Toolchain (in output) ---
  it('should classify TODO commands in output as toolchain', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        stderr: 'TODO: requires live Discord bot — manual verification',
      })
    );

    expect(result.category).toBe('toolchain');
    expect(result.retryable).toBe(false);
  });

  // --- Application (default) ---
  it('should classify generic failures as application', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        exitCode: 1,
        stderr: 'FAIL src/lib/lifecycle.test.ts\n  Expected: true, Received: false',
      })
    );

    expect(result.category).toBe('application');
    expect(result.retryable).toBe(false);
  });

  it('should classify clean exit code 1 with no patterns as application', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        exitCode: 1,
        stdout: 'Tests: 1 failed, 5 passed',
        stderr: '',
      })
    );

    expect(result.category).toBe('application');
  });

  // --- Transient patterns ---
  it('should classify SIGKILL as transient', () => {
    const result = classifyFailure(
      makeRequirement(),
      makeCommandResult({
        stderr: 'Process was killed by SIGKILL',
      })
    );

    expect(result.category).toBe('transient');
    expect(result.retryable).toBe(true);
  });

  // --- Result structure ---
  it('should always include evidence and suggestedAction', () => {
    const result = classifyFailure(makeRequirement(), makeCommandResult());

    expect(result.evidence).toBeDefined();
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.suggestedAction).toBeDefined();
    expect(result.suggestedAction.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
