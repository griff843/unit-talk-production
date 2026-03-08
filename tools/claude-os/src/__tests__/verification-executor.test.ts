/**
 * Tests for verification-executor.ts
 *
 * Verifies the orchestrator that ties all Phase C modules together.
 * Uses fake CommandRunner for isolation — no real commands executed.
 */

import { describe, it, expect } from 'vitest';

import { executeVerification } from '../verification-executor.js';

import type { SprintExecutionPlan, CommandRunner, VerificationRequirement } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakePassRunner: CommandRunner = command => ({
  command,
  exitCode: 0,
  stdout: 'ok',
  stderr: '',
  durationMs: 100,
  timedOut: false,
});

const fakeFailRunner: CommandRunner = command => ({
  command,
  exitCode: 1,
  stdout: '',
  stderr: 'error',
  durationMs: 200,
  timedOut: false,
});

function makeRequirement(
  overrides: Partial<VerificationRequirement> = {}
): VerificationRequirement {
  return {
    recipeId: 'typecheck',
    purpose: 'Type check',
    required: true,
    commandPlaceholder: 'npm run type-check',
    commandResolved: true,
    outputFile: 'proofs/proof_typecheck.txt',
    failureSeverity: 'blocking',
    notes: '',
    ...overrides,
  };
}

function makePlan(reqs: VerificationRequirement[]): SprintExecutionPlan {
  return {
    status: 'ready',
    request: {
      sprintId: 'SPRINT-EXEC-TEST',
      sprintType: 'docs',
      summary: 'Test execution',
    },
    governanceSummary: { lawsLoaded: 0, contractsLoaded: 0, recipesLoaded: 0, loadErrors: [] },
    contextPackSummary: {
      alwaysLoadedCount: 0,
      sprintSpecificCount: 0,
      optionalCount: 0,
      failedCount: 0,
      isComplete: true,
    },
    verificationRequirements: reqs,
    proofRequirements: [],
    artifactPlan: {
      sprintId: 'SPRINT-EXEC-TEST',
      date: '2026-03-08',
      canonicalRoot: 'out/sprints/SPRINT-EXEC-TEST/2026-03-08',
      requiredDirectories: ['proofs', 'diffs', 'notes'],
      requiredFiles: [],
      notes: [],
    },
    driftSignals: [],
    failClosedBlockers: [],
    deferredRequirements: [],
    nextStepRecommendations: [],
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verification-executor', () => {
  it('should execute resolved commands via fake runner and classify correctly', () => {
    const plan = makePlan([makeRequirement()]);
    const result = executeVerification(plan, { commandRunner: fakePassRunner, dryRun: true });

    expect(result.sprintId).toBe('SPRINT-EXEC-TEST');
    expect(result.steps).toHaveLength(1);
    // dry-run with resolved command → SKIPPED (would execute)
    expect(result.steps[0].status).toBe('SKIPPED');
  });

  it('should mark unresolved required recipes as BLOCKED', () => {
    const plan = makePlan([
      makeRequirement({ recipeId: 'lint', commandResolved: false, required: true }),
    ]);
    const result = executeVerification(plan, { commandRunner: fakePassRunner, dryRun: true });

    expect(result.steps[0].status).toBe('BLOCKED');
  });

  it('should mark unresolved optional recipes as SKIPPED', () => {
    const plan = makePlan([
      makeRequirement({
        recipeId: 'lint',
        commandResolved: false,
        required: false,
        failureSeverity: 'informational',
      }),
    ]);
    const result = executeVerification(plan, { commandRunner: fakePassRunner, dryRun: true });

    expect(result.steps[0].status).toBe('SKIPPED');
  });

  it('should derive FAIL when fake runner returns non-zero', () => {
    const plan = makePlan([makeRequirement()]);
    // Not dry-run — actually calls the fake runner
    const result = executeVerification(plan, { commandRunner: fakeFailRunner });

    expect(result.overallStatus).toBe('FAIL');
    expect(result.steps[0].status).toBe('FAIL');
  });

  it('should produce correct summary counts', () => {
    const plan = makePlan([
      makeRequirement({ recipeId: 'typecheck' }),
      makeRequirement({ recipeId: 'lint', commandResolved: false, required: true }),
      makeRequirement({
        recipeId: 'optional_check',
        commandResolved: false,
        required: false,
        failureSeverity: 'informational',
      }),
    ]);
    const result = executeVerification(plan, { commandRunner: fakePassRunner });

    expect(result.summary.total).toBe(3);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.blocked).toBe(1);
    expect(result.summary.skipped).toBe(1);
  });

  it('should skip execution in dry-run mode', () => {
    let commandsExecuted = 0;
    const countingRunner: CommandRunner = command => {
      commandsExecuted++;
      return { command, exitCode: 0, stdout: '', stderr: '', durationMs: 0, timedOut: false };
    };

    const plan = makePlan([makeRequirement()]);
    executeVerification(plan, { commandRunner: countingRunner, dryRun: true });

    expect(commandsExecuted).toBe(0);
  });

  it('should include runtime proof gate in result', () => {
    const plan = makePlan([makeRequirement()]);
    const result = executeVerification(plan, { commandRunner: fakePassRunner, dryRun: true });

    expect(result.runtimeProofGate).toBeDefined();
    expect(result.runtimeProofGate.required).toBe(false);
    expect(result.runtimeProofGate.satisfied).toBe(true);
  });
});
