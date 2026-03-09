/**
 * Tests for verification-classifier.ts
 *
 * Verifies pure classification logic for verification step outcomes.
 */

import { describe, it, expect } from 'vitest';

import { classifyStep, deriveOverallStatus } from '../verification-classifier.js';

import type {
  VerificationRequirement,
  CommandRunResult,
  VerificationStepResult,
  RuntimeProofGateResult,
} from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequirement(
  overrides: Partial<VerificationRequirement> = {}
): VerificationRequirement {
  return {
    recipeId: 'test_recipe',
    purpose: 'Test',
    required: true,
    commandPlaceholder: 'echo hello',
    commandResolved: true,
    outputFile: 'proofs/proof_test.txt',
    failureSeverity: 'blocking',
    notes: '',
    ...overrides,
  };
}

function makeCommandResult(overrides: Partial<CommandRunResult> = {}): CommandRunResult {
  return {
    command: 'echo hello',
    exitCode: 0,
    stdout: 'hello',
    stderr: '',
    durationMs: 100,
    timedOut: false,
    ...overrides,
  };
}

function makeStep(overrides: Partial<VerificationStepResult> = {}): VerificationStepResult {
  return {
    recipeId: 'test_recipe',
    status: 'PASS',
    reason: 'Exit code 0',
    commandResult: makeCommandResult(),
    outputFile: 'proofs/proof_test.txt',
    durationMs: 100,
    ...overrides,
  };
}

function makeGateResult(overrides: Partial<RuntimeProofGateResult> = {}): RuntimeProofGateResult {
  return {
    required: false,
    satisfied: true,
    reason: 'Not required',
    missingEvidence: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// classifyStep
// ---------------------------------------------------------------------------

describe('classifyStep', () => {
  it('should return PASS for exit code 0', () => {
    const result = classifyStep(makeRequirement(), makeCommandResult({ exitCode: 0 }));
    expect(result.status).toBe('PASS');
  });

  it('should return FAIL for non-zero exit code', () => {
    const result = classifyStep(makeRequirement(), makeCommandResult({ exitCode: 1 }));
    expect(result.status).toBe('FAIL');
    expect(result.reason).toContain('Exit code 1');
  });

  it('should return FAIL for timeout', () => {
    const result = classifyStep(
      makeRequirement(),
      makeCommandResult({ timedOut: true, durationMs: 5000 })
    );
    expect(result.status).toBe('FAIL');
    expect(result.reason).toContain('Timed out');
  });

  it('should return BLOCKED for unresolved required recipe', () => {
    const result = classifyStep(makeRequirement({ commandResolved: false, required: true }), null);
    expect(result.status).toBe('BLOCKED');
    expect(result.reason).toContain('unresolved');
  });

  it('should return SKIPPED for unresolved optional recipe', () => {
    const result = classifyStep(makeRequirement({ commandResolved: false, required: false }), null);
    expect(result.status).toBe('SKIPPED');
  });

  it('should return BLOCKED for null command result on resolved recipe', () => {
    const result = classifyStep(makeRequirement({ commandResolved: true }), null);
    expect(result.status).toBe('BLOCKED');
    expect(result.reason).toContain('internal error');
  });
});

// ---------------------------------------------------------------------------
// deriveOverallStatus
// ---------------------------------------------------------------------------

describe('deriveOverallStatus', () => {
  it('should return PASS when all steps pass', () => {
    const steps = [makeStep({ status: 'PASS' }), makeStep({ recipeId: 'b', status: 'PASS' })];
    const reqs = [makeRequirement(), makeRequirement({ recipeId: 'b' })];
    expect(deriveOverallStatus(steps, reqs, makeGateResult())).toBe('PASS');
  });

  it('should return FAIL when any step fails', () => {
    const steps = [makeStep({ status: 'PASS' }), makeStep({ recipeId: 'b', status: 'FAIL' })];
    const reqs = [makeRequirement(), makeRequirement({ recipeId: 'b' })];
    expect(deriveOverallStatus(steps, reqs, makeGateResult())).toBe('FAIL');
  });

  it('should return BLOCKED when blocking step is blocked', () => {
    const steps = [makeStep({ status: 'BLOCKED' })];
    const reqs = [makeRequirement({ failureSeverity: 'blocking' })];
    expect(deriveOverallStatus(steps, reqs, makeGateResult())).toBe('BLOCKED');
  });

  it('should return PASS when only optional steps are skipped', () => {
    const steps = [makeStep({ status: 'PASS' }), makeStep({ recipeId: 'opt', status: 'SKIPPED' })];
    const reqs = [
      makeRequirement(),
      makeRequirement({ recipeId: 'opt', required: false, failureSeverity: 'informational' }),
    ];
    expect(deriveOverallStatus(steps, reqs, makeGateResult())).toBe('PASS');
  });

  it('should return BLOCKED when runtime proof gate is unsatisfied', () => {
    const steps = [makeStep({ status: 'PASS' })];
    const reqs = [makeRequirement()];
    const gate = makeGateResult({ required: true, satisfied: false });
    expect(deriveOverallStatus(steps, reqs, gate)).toBe('BLOCKED');
  });
});
