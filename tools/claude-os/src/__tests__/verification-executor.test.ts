/**
 * Tests for verification-executor.ts
 *
 * Verifies the orchestrator that ties all Phase C modules together.
 * Uses fake CommandRunner for isolation — no real commands executed.
 */

import { describe, it, expect } from 'vitest';

import { executeVerification, executeScopedVerification } from '../verification-executor.js';

import type {
  SprintExecutionPlan,
  BlastRadius,
  CommandRunner,
  VerificationRequirement,
} from '../types.js';

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
    riskEscalations: [],
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

// ---------------------------------------------------------------------------
// Scope-Aware Verification (CLAUDE-OS-SCOPE-HARDENING)
// ---------------------------------------------------------------------------

function makeApiBlastRadius(): BlastRadius {
  return {
    affectedWorkspaces: [
      {
        name: 'api',
        filterPattern: 'api',
        touchedPaths: ['apps/api/src/agents/GradingAgent.ts'],
        changeRisk: 'critical',
      },
      {
        name: 'claude-os',
        filterPattern: 'claude-os',
        touchedPaths: ['tools/claude-os/src/scope-resolver.ts'],
        changeRisk: 'medium',
      },
    ],
    globalGatesRequired: true,
    unmappedAreas: [],
    summary: 'Affected: api, claude-os',
  };
}

describe('executeScopedVerification', () => {
  it('classifies global gate failures as global_blocker', () => {
    const plan = makePlan([
      makeRequirement({
        recipeId: 'lifecycle_gate',
        commandPlaceholder: 'pnpm --filter api run lifecycle:single-writer -- --strict',
      }),
    ]);
    const blast = makeApiBlastRadius();
    const result = executeScopedVerification(plan, blast, { commandRunner: fakeFailRunner });

    expect(result.scopedSteps).toHaveLength(1);
    expect(result.scopedSteps[0].scopeClassification).toBe('global_blocker');
    expect(result.scopeSummary.globalBlockers).toBe(1);
    expect(result.scopeSummary.sprintBlocked).toBe(true);
  });

  it('classifies in-scope failures as blocking', () => {
    const plan = makePlan([
      makeRequirement({
        recipeId: 'typecheck',
        commandPlaceholder: 'pnpm --filter api run type-check',
      }),
    ]);
    const blast = makeApiBlastRadius();
    const result = executeScopedVerification(plan, blast, { commandRunner: fakeFailRunner });

    expect(result.scopedSteps[0].scopeClassification).toBe('in_scope_failure');
    expect(result.scopeSummary.inScopeFailures).toBe(1);
    expect(result.scopeSummary.sprintBlocked).toBe(true);
  });

  it('classifies out-of-scope failures as non-blocking', () => {
    const plan = makePlan([
      makeRequirement({
        recipeId: 'build',
        commandPlaceholder: 'pnpm --filter discord-bot run build',
      }),
    ]);
    const blast = makeApiBlastRadius();
    const result = executeScopedVerification(plan, blast, { commandRunner: fakeFailRunner });

    expect(result.scopedSteps[0].scopeClassification).toBe('out_of_scope_failure');
    expect(result.scopeSummary.outOfScopeFailures).toBe(1);
    expect(result.scopeSummary.sprintBlocked).toBe(false);
  });

  it('passing steps do not block regardless of scope', () => {
    const plan = makePlan([
      makeRequirement({
        recipeId: 'typecheck',
        commandPlaceholder: 'pnpm run type-check',
      }),
      makeRequirement({
        recipeId: 'build',
        commandPlaceholder: 'pnpm --filter discord-bot run build',
      }),
    ]);
    const blast = makeApiBlastRadius();
    const result = executeScopedVerification(plan, blast, { commandRunner: fakePassRunner });

    expect(result.scopeSummary.sprintBlocked).toBe(false);
    expect(result.scopeSummary.inScopeFailures).toBe(0);
    expect(result.scopeSummary.outOfScopeFailures).toBe(0);
  });

  it('mixed in-scope and out-of-scope: only in-scope blocks', () => {
    // Discord-bot fails (out of scope), API passes (in scope)
    const mixedRunner: CommandRunner = command => {
      if (command.includes('discord-bot')) {
        return {
          command,
          exitCode: 1,
          stdout: '',
          stderr: 'discord error',
          durationMs: 100,
          timedOut: false,
        };
      }
      return { command, exitCode: 0, stdout: 'ok', stderr: '', durationMs: 50, timedOut: false };
    };

    const plan = makePlan([
      makeRequirement({
        recipeId: 'build',
        commandPlaceholder: 'pnpm --filter api run build',
      }),
      makeRequirement({
        recipeId: 'build',
        commandPlaceholder: 'pnpm --filter discord-bot run build',
      }),
    ]);
    const blast = makeApiBlastRadius();
    const result = executeScopedVerification(plan, blast, { commandRunner: mixedRunner });

    expect(result.scopeSummary.outOfScopeFailures).toBe(1);
    expect(result.scopeSummary.inScopeFailures).toBe(0);
    expect(result.scopeSummary.sprintBlocked).toBe(false);
  });

  it('returns blast radius in result', () => {
    const plan = makePlan([makeRequirement()]);
    const blast = makeApiBlastRadius();
    const result = executeScopedVerification(plan, blast, { commandRunner: fakePassRunner });

    expect(result.blastRadius).toBe(blast);
    expect(result.blastRadius.affectedWorkspaces).toHaveLength(2);
  });

  it('block reason includes both global blockers and in-scope failures', () => {
    const plan = makePlan([
      makeRequirement({
        recipeId: 'lifecycle_gate',
        commandPlaceholder: 'pnpm --filter api run lifecycle:single-writer -- --strict',
      }),
      makeRequirement({
        recipeId: 'typecheck',
        commandPlaceholder: 'pnpm --filter api run type-check',
      }),
    ]);
    const blast = makeApiBlastRadius();
    const result = executeScopedVerification(plan, blast, { commandRunner: fakeFailRunner });

    expect(result.scopeSummary.sprintBlocked).toBe(true);
    expect(result.scopeSummary.blockReason).toContain('global blocker');
    expect(result.scopeSummary.blockReason).toContain('in-scope failure');
  });
});
