/**
 * Tests for runtime-proof-gate.ts
 *
 * Verifies runtime proof gate evaluation logic.
 */

import { describe, it, expect } from 'vitest';

import { evaluateRuntimeProofGate } from '../runtime-proof-gate.js';

import type { SprintExecutionPlan, VerificationStepResult, ProofRequirement } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(
  overrides: {
    runtimeProofRequired?: boolean;
    proofRequirements?: ProofRequirement[];
  } = {}
): SprintExecutionPlan {
  return {
    status: 'ready',
    request: {
      sprintId: 'SPRINT-TEST-001',
      sprintType: 'docs',
      summary: 'Test',
      runtimeProofRequired: overrides.runtimeProofRequired,
    },
    governanceSummary: { lawsLoaded: 0, contractsLoaded: 0, recipesLoaded: 0, loadErrors: [] },
    contextPackSummary: {
      alwaysLoadedCount: 0,
      sprintSpecificCount: 0,
      optionalCount: 0,
      failedCount: 0,
      isComplete: true,
    },
    verificationRequirements: [],
    proofRequirements: overrides.proofRequirements ?? [],
    artifactPlan: {
      sprintId: 'SPRINT-TEST-001',
      date: '2026-03-08',
      canonicalRoot: 'out/sprints/test',
      requiredDirectories: [],
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

function makeStep(
  recipeId: string,
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED'
): VerificationStepResult {
  return {
    recipeId,
    status,
    reason: `Test: ${status}`,
    commandResult: null,
    outputFile: null,
    durationMs: 100,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runtime-proof-gate', () => {
  it('should not require runtime proof for docs sprints (no runtime_evidence)', () => {
    const plan = makePlan();
    const steps = [makeStep('typecheck', 'PASS')];

    const result = evaluateRuntimeProofGate(plan, steps);

    expect(result.required).toBe(false);
    expect(result.satisfied).toBe(true);
  });

  it('should require runtime proof when runtimeProofRequired is true', () => {
    const plan = makePlan({ runtimeProofRequired: true });
    const steps = [makeStep('typecheck', 'PASS')];

    const result = evaluateRuntimeProofGate(plan, steps);

    expect(result.required).toBe(true);
    expect(result.satisfied).toBe(false);
    expect(result.missingEvidence.length).toBeGreaterThan(0);
  });

  it('should require runtime proof when proof requirements include runtime_evidence', () => {
    const plan = makePlan({
      proofRequirements: [
        {
          category: 'runtime_evidence',
          artifact: 'smoke test',
          description: 'Runtime proof',
          required: true,
        },
      ],
    });
    const steps = [makeStep('typecheck', 'PASS')];

    const result = evaluateRuntimeProofGate(plan, steps);

    expect(result.required).toBe(true);
    expect(result.satisfied).toBe(false);
  });

  it('should be satisfied when runtime_smoke step passes', () => {
    const plan = makePlan({ runtimeProofRequired: true });
    const steps = [makeStep('typecheck', 'PASS'), makeStep('runtime_smoke', 'PASS')];

    const result = evaluateRuntimeProofGate(plan, steps);

    expect(result.required).toBe(true);
    expect(result.satisfied).toBe(true);
    expect(result.missingEvidence).toHaveLength(0);
  });

  it('should be unsatisfied when runtime_smoke step fails', () => {
    const plan = makePlan({ runtimeProofRequired: true });
    const steps = [makeStep('typecheck', 'PASS'), makeStep('runtime_smoke', 'FAIL')];

    const result = evaluateRuntimeProofGate(plan, steps);

    expect(result.required).toBe(true);
    expect(result.satisfied).toBe(false);
    expect(result.missingEvidence).toContain('runtime_smoke');
  });

  it('should list missing evidence recipe IDs', () => {
    const plan = makePlan({ runtimeProofRequired: true });
    const steps = [
      makeStep('typecheck', 'PASS'),
      makeStep('runtime_smoke', 'BLOCKED'),
      makeStep('discord_canary', 'SKIPPED'),
    ];

    const result = evaluateRuntimeProofGate(plan, steps);

    expect(result.missingEvidence).toContain('runtime_smoke');
    expect(result.missingEvidence).toContain('discord_canary');
  });

  it('should respect runtimeProofRequired=false override', () => {
    // Even if proof requirements suggest runtime, explicit false overrides
    const plan = makePlan({ runtimeProofRequired: false });
    const steps = [makeStep('typecheck', 'PASS')];

    const result = evaluateRuntimeProofGate(plan, steps);

    expect(result.required).toBe(false);
    expect(result.satisfied).toBe(true);
  });
});
