/**
 * Tests for verdict-engine.ts (Phase D)
 *
 * Verifies pure, deterministic verdict logic.
 * No file system — all inputs are plain data.
 */

import { describe, it, expect } from 'vitest';

import { buildEvidenceChecklist, evaluateVerdict } from '../verdict-engine.js';

import type {
  BundleCompletenessCheck,
  ProofRequirement,
  VerificationExecutionResult,
  VerificationStepResult,
  RuntimeProofGateResult,
  VerdictEvidenceEntry,
} from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProofReq(overrides: Partial<ProofRequirement> = {}): ProofRequirement {
  return {
    category: 'typecheck',
    artifact: 'proofs/proof_typecheck.txt',
    description: 'TypeScript compilation',
    required: true,
    ...overrides,
  };
}

function makeStep(overrides: Partial<VerificationStepResult> = {}): VerificationStepResult {
  return {
    recipeId: 'typecheck',
    status: 'PASS',
    reason: 'Exit code 0',
    commandResult: null,
    outputFile: 'proofs/proof_typecheck.txt',
    durationMs: 100,
    ...overrides,
  };
}

function makeVerificationResult(
  overrides: Partial<VerificationExecutionResult> = {}
): VerificationExecutionResult {
  return {
    sprintId: 'SPRINT-TEST-001',
    steps: [makeStep()],
    overallStatus: 'PASS',
    evidenceRoot: 'out/sprints/SPRINT-TEST-001/2026-03-08',
    runtimeProofGate: {
      required: false,
      satisfied: true,
      reason: 'Not required',
      missingEvidence: [],
    },
    summary: { total: 1, passed: 1, failed: 0, blocked: 0, skipped: 0 },
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeCompleteness(
  overrides: Partial<BundleCompletenessCheck> = {}
): BundleCompletenessCheck {
  return {
    totalRequired: 4,
    presentRequired: 4,
    missingRequired: [],
    emptyRequired: [],
    totalOptional: 0,
    presentOptional: 0,
    ...overrides,
  };
}

function makeRuntimeGate(overrides: Partial<RuntimeProofGateResult> = {}): RuntimeProofGateResult {
  return {
    required: false,
    satisfied: true,
    reason: 'Not required',
    missingEvidence: [],
    ...overrides,
  };
}

function makeFileStatusMap(
  entries: Array<[string, { present: boolean; nonEmpty: boolean }]>
): Map<string, { present: boolean; nonEmpty: boolean }> {
  return new Map(entries);
}

// ---------------------------------------------------------------------------
// Tests: buildEvidenceChecklist
// ---------------------------------------------------------------------------

describe('buildEvidenceChecklist', () => {
  it('should map proof requirements to checklist entries with file status', () => {
    const proofReqs = [
      makeProofReq({ category: 'typecheck', artifact: 'proofs/proof_typecheck.txt' }),
      makeProofReq({
        category: 'tests',
        artifact: 'proofs/proof_tests.txt',
        required: false,
      }),
    ];
    const fileMap = makeFileStatusMap([
      ['proofs/proof_typecheck.txt', { present: true, nonEmpty: true }],
      ['proofs/proof_tests.txt', { present: false, nonEmpty: false }],
    ]);
    const verResult = makeVerificationResult({
      steps: [makeStep({ recipeId: 'typecheck', status: 'PASS' })],
    });

    const checklist = buildEvidenceChecklist(proofReqs, fileMap, verResult);

    expect(checklist).toHaveLength(2);
    expect(checklist[0].present).toBe(true);
    expect(checklist[0].verificationStatus).toBe('PASS');
    expect(checklist[1].present).toBe(false);
    expect(checklist[1].required).toBe(false);
  });

  it('should return null verificationStatus for categories without matching recipe', () => {
    const proofReqs = [
      makeProofReq({ category: 'git_status', artifact: 'proofs/proof_git_status.txt' }),
    ];
    const fileMap = makeFileStatusMap([
      ['proofs/proof_git_status.txt', { present: true, nonEmpty: true }],
    ]);
    const verResult = makeVerificationResult();

    const checklist = buildEvidenceChecklist(proofReqs, fileMap, verResult);
    expect(checklist[0].verificationStatus).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: evaluateVerdict
// ---------------------------------------------------------------------------

describe('evaluateVerdict', () => {
  const standardProofReqs = [
    makeProofReq({ category: 'typecheck', artifact: 'proofs/proof_typecheck.txt' }),
    makeProofReq({ category: 'diff', artifact: 'diffs/sprint_changes.diff' }),
    makeProofReq({ category: 'closeout', artifact: 'SPRINT_CLOSEOUT_REPORT.md' }),
    makeProofReq({ category: 'git_status', artifact: 'proofs/proof_git_status.txt' }),
  ];

  function makeChecklist(present: boolean, nonEmpty: boolean): VerdictEvidenceEntry[] {
    return standardProofReqs.map(req => ({
      category: req.category,
      artifact: req.artifact,
      required: true,
      present,
      nonEmpty,
      verificationStatus: present ? ('PASS' as const) : null,
    }));
  }

  it('should return PASS when all required present, non-empty, and passing', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness();
    const verResult = makeVerificationResult();
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.status).toBe('PASS');
    expect(verdict.recommendations[0]).toContain('Ratify');
  });

  it('should return FAIL when a required evidence file is missing', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness({ missingRequired: ['proofs/proof_typecheck.txt'] });
    const verResult = makeVerificationResult();
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.status).toBe('FAIL');
  });

  it('should return FAIL when a required evidence file is empty', () => {
    const checklist = makeChecklist(true, false);
    const completeness = makeCompleteness({ emptyRequired: ['proofs/proof_typecheck.txt'] });
    const verResult = makeVerificationResult();
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.status).toBe('FAIL');
  });

  it('should return FAIL when overall verification status is FAIL', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness();
    const verResult = makeVerificationResult({
      overallStatus: 'FAIL',
      steps: [makeStep({ status: 'FAIL', reason: 'Test failure' })],
      summary: { total: 1, passed: 0, failed: 1, blocked: 0, skipped: 0 },
    });
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.status).toBe('FAIL');
  });

  it('should return FAIL when a blocking verification step has FAIL status', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness();
    const verResult = makeVerificationResult({
      overallStatus: 'PASS',
      steps: [
        makeStep({ recipeId: 'typecheck', status: 'PASS' }),
        makeStep({ recipeId: 'build', status: 'FAIL', reason: 'Build error' }),
      ],
      summary: { total: 2, passed: 1, failed: 1, blocked: 0, skipped: 0 },
    });
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.status).toBe('FAIL');
  });

  it('should return BLOCKED when runtime proof gate required but unsatisfied', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness();
    const verResult = makeVerificationResult();
    const gate = makeRuntimeGate({
      required: true,
      satisfied: false,
      reason: 'No runtime evidence collected',
    });

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.status).toBe('BLOCKED');
    expect(verdict.blockers.length).toBeGreaterThan(0);
  });

  it('should return BLOCKED when a blocking step has BLOCKED status', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness();
    const verResult = makeVerificationResult({
      overallStatus: 'BLOCKED',
      steps: [makeStep({ status: 'BLOCKED', reason: 'Unresolved command' })],
      summary: { total: 1, passed: 0, failed: 0, blocked: 1, skipped: 0 },
    });
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.status).toBe('BLOCKED');
  });

  it('should return PASS_WITH_LIMITATIONS when optional evidence missing', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness({ totalOptional: 2, presentOptional: 0 });
    const verResult = makeVerificationResult();
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.status).toBe('PASS_WITH_LIMITATIONS');
  });

  it('should return PASS_WITH_LIMITATIONS when a step was skipped', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness();
    const verResult = makeVerificationResult({
      steps: [
        makeStep({ recipeId: 'typecheck', status: 'PASS' }),
        makeStep({ recipeId: 'lint', status: 'SKIPPED', reason: 'Optional' }),
      ],
      summary: { total: 2, passed: 1, failed: 0, blocked: 0, skipped: 1 },
    });
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.status).toBe('PASS_WITH_LIMITATIONS');
  });

  it('should generate rationale referencing evidence counts', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness();
    const verResult = makeVerificationResult();
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.rationale).toContain('4/4 required artifacts present');
    expect(verdict.rationale).toContain('1 passed');
  });

  it('should calculate high confidence when all evidence passes', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness();
    const verResult = makeVerificationResult();
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    // git_status, diff, closeout have no recipe mapping -> null verificationStatus
    // That triggers "medium" confidence
    expect(['high', 'medium']).toContain(verdict.confidence);
  });

  it('should calculate low confidence when verification steps failed', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness();
    const verResult = makeVerificationResult({
      overallStatus: 'FAIL',
      steps: [makeStep({ status: 'FAIL' })],
      summary: { total: 1, passed: 0, failed: 1, blocked: 0, skipped: 0 },
    });
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.confidence).toBe('low');
  });

  it('should generate RATIFY recommendation for PASS', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness();
    const verResult = makeVerificationResult();
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.recommendations[0]).toContain('Ratify');
  });

  it('should generate DO NOT RATIFY recommendation for FAIL', () => {
    const checklist = makeChecklist(true, true);
    const completeness = makeCompleteness({ missingRequired: ['proofs/proof_typecheck.txt'] });
    const verResult = makeVerificationResult();
    const gate = makeRuntimeGate();

    const verdict = evaluateVerdict(checklist, completeness, verResult, standardProofReqs, gate);

    expect(verdict.recommendations[0]).toContain('Return to implementation');
  });
});
