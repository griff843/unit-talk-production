/**
 * Claude OS — Verdict Engine
 *
 * Pure, deterministic verdict logic for proof bundle evaluation.
 * No I/O. No file system access. All inputs/outputs are plain data.
 */

import type {
  BundleVerdictStatus,
  BundleVerdict,
  BundleCompletenessCheck,
  VerdictEvidenceEntry,
  VerdictLimitation,
  VerdictBlocker,
  ProofRequirement,
  VerificationExecutionResult,
  VerificationStepStatus,
  RuntimeProofGateResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Map proof categories to likely verification recipe IDs.
 * Used to join proof requirements with verification step results.
 */
const CATEGORY_TO_RECIPE_MAP: Record<string, string[]> = {
  typecheck: ['typecheck'],
  tests: ['unit_tests', 'integration_tests'],
  build: ['build'],
  lifecycle_gate: ['lifecycle_gate'],
  runtime_evidence: ['runtime_smoke'],
  discord_evidence: ['discord_canary'],
  schema_evidence: ['schema_guard'],
  lint: ['lint'],
  drift_audit: ['drift_audit'],
  visual_evidence: ['ui_visual_check', 'browser_smoke'],
};

// ---------------------------------------------------------------------------
// Evidence Checklist
// ---------------------------------------------------------------------------

/**
 * Build the evidence checklist from proof requirements and file scan results.
 *
 * Joins verification step status by matching proof category to recipe ID.
 */
export function buildEvidenceChecklist(
  proofRequirements: ProofRequirement[],
  fileStatusMap: Map<string, { present: boolean; nonEmpty: boolean }>,
  verificationResult: VerificationExecutionResult
): VerdictEvidenceEntry[] {
  return proofRequirements.map(req => {
    const fileStatus = fileStatusMap.get(req.artifact);

    // Try to find a matching verification step
    const verificationStatus = findVerificationStatus(req.category, verificationResult);

    return {
      category: req.category,
      artifact: req.artifact,
      required: req.required,
      present: fileStatus?.present ?? false,
      nonEmpty: fileStatus?.nonEmpty ?? false,
      verificationStatus,
    };
  });
}

// ---------------------------------------------------------------------------
// Verdict Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate the verdict for a proof bundle.
 *
 * Verdict rules (priority order):
 * 1. FAIL — required evidence missing/empty or blocking verification failed
 * 2. BLOCKED — runtime proof gate unsatisfied or blocking step BLOCKED
 * 3. PASS_WITH_LIMITATIONS — all required present but optional missing or non-blocking issues
 * 4. PASS — everything is clean
 */
export function evaluateVerdict(
  evidenceChecklist: VerdictEvidenceEntry[],
  completeness: BundleCompletenessCheck,
  verificationResult: VerificationExecutionResult,
  _proofRequirements: ProofRequirement[],
  runtimeProofGate: RuntimeProofGateResult
): BundleVerdict {
  const blockers = deriveBlockers(
    evidenceChecklist,
    completeness,
    verificationResult,
    runtimeProofGate
  );
  const limitations = deriveLimitations(evidenceChecklist, completeness, verificationResult);
  const status = determineStatus(completeness, verificationResult, runtimeProofGate, blockers);
  const recommendations = generateRecommendations(status, limitations, blockers);
  const { confidence, confidenceRationale } = calculateConfidence(
    evidenceChecklist,
    completeness,
    verificationResult
  );
  const rationale = buildRationale(completeness, verificationResult, runtimeProofGate, status);

  return {
    status,
    rationale,
    evidenceChecklist,
    limitations,
    blockers,
    recommendations,
    confidence,
    confidenceRationale,
  };
}

// ---------------------------------------------------------------------------
// Status Determination
// ---------------------------------------------------------------------------

function determineStatus(
  completeness: BundleCompletenessCheck,
  verificationResult: VerificationExecutionResult,
  runtimeProofGate: RuntimeProofGateResult,
  blockers: VerdictBlocker[]
): BundleVerdictStatus {
  // FAIL: required evidence missing or empty
  if (completeness.missingRequired.length > 0 || completeness.emptyRequired.length > 0) {
    return 'FAIL';
  }

  // FAIL: overall verification failed
  if (verificationResult.overallStatus === 'FAIL') {
    return 'FAIL';
  }

  // FAIL: any blocking verification step explicitly FAIL
  const hasBlockingFail = verificationResult.steps.some(s => s.status === 'FAIL');
  if (hasBlockingFail) {
    return 'FAIL';
  }

  // BLOCKED: runtime proof gate unsatisfied
  if (runtimeProofGate.required && !runtimeProofGate.satisfied) {
    return 'BLOCKED';
  }

  // BLOCKED: overall verification blocked
  if (verificationResult.overallStatus === 'BLOCKED') {
    return 'BLOCKED';
  }

  // BLOCKED: any remaining blockers
  if (blockers.length > 0) {
    return 'BLOCKED';
  }

  // PASS_WITH_LIMITATIONS: optional evidence missing or non-blocking issues
  const hasOptionalMissing = completeness.totalOptional > completeness.presentOptional;
  const hasSkippedSteps = verificationResult.steps.some(s => s.status === 'SKIPPED');
  if (hasOptionalMissing || hasSkippedSteps) {
    return 'PASS_WITH_LIMITATIONS';
  }

  return 'PASS';
}

// ---------------------------------------------------------------------------
// Blockers
// ---------------------------------------------------------------------------

function deriveBlockers(
  _evidenceChecklist: VerdictEvidenceEntry[],
  completeness: BundleCompletenessCheck,
  verificationResult: VerificationExecutionResult,
  runtimeProofGate: RuntimeProofGateResult
): VerdictBlocker[] {
  const blockers: VerdictBlocker[] = [];

  // Missing required evidence
  for (const missing of completeness.missingRequired) {
    blockers.push({
      description: `Required evidence file missing: ${missing}`,
      type: 'missing_evidence',
      resolution: `Run verification to generate ${missing}, or capture evidence manually`,
    });
  }

  // Empty required evidence
  for (const empty of completeness.emptyRequired) {
    blockers.push({
      description: `Required evidence file is empty: ${empty}`,
      type: 'missing_evidence',
      resolution: `Re-run verification to populate ${empty}`,
    });
  }

  // Blocked verification steps
  for (const step of verificationResult.steps) {
    if (step.status === 'BLOCKED') {
      blockers.push({
        description: `Verification step '${step.recipeId}' is BLOCKED: ${step.reason}`,
        type: 'verification_failure',
        resolution: `Resolve the blocking condition for ${step.recipeId}`,
      });
    }
  }

  // Runtime proof gate unsatisfied
  if (runtimeProofGate.required && !runtimeProofGate.satisfied) {
    blockers.push({
      description: `Runtime proof gate unsatisfied: ${runtimeProofGate.reason}`,
      type: 'infrastructure',
      resolution: 'Provide runtime evidence (API response, DB state, or log output)',
    });
  }

  return blockers;
}

// ---------------------------------------------------------------------------
// Limitations
// ---------------------------------------------------------------------------

function deriveLimitations(
  evidenceChecklist: VerdictEvidenceEntry[],
  completeness: BundleCompletenessCheck,
  verificationResult: VerificationExecutionResult
): VerdictLimitation[] {
  const limitations: VerdictLimitation[] = [];

  // Optional evidence missing
  const optionalMissing = evidenceChecklist.filter(e => !e.required && !e.present);
  for (const entry of optionalMissing) {
    limitations.push({
      description: `Optional evidence not present: ${entry.artifact}`,
      severity: 'low',
      impact: `${entry.category} not independently verified`,
    });
  }

  // Skipped verification steps
  for (const step of verificationResult.steps) {
    if (step.status === 'SKIPPED') {
      limitations.push({
        description: `Verification step '${step.recipeId}' was skipped: ${step.reason}`,
        severity: 'medium',
        impact: `${step.recipeId} not verified in this sprint`,
      });
    }
  }

  return limitations;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

function generateRecommendations(
  status: BundleVerdictStatus,
  limitations: VerdictLimitation[],
  blockers: VerdictBlocker[]
): string[] {
  switch (status) {
    case 'PASS':
      return ['Ratify — PR is ready for human review.'];

    case 'PASS_WITH_LIMITATIONS': {
      const items = limitations.map(l => l.description).join('; ');
      return [`Ratify with conditions — follow-up sprint required for: ${items}.`];
    }

    case 'BLOCKED': {
      const items = blockers.map(b => b.description).join('; ');
      return [`Halt — blocker must be resolved before ratification: ${items}.`];
    }

    case 'FAIL': {
      return ['Return to implementation — failures must be fixed before re-verification.'];
    }
  }
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

function calculateConfidence(
  evidenceChecklist: VerdictEvidenceEntry[],
  completeness: BundleCompletenessCheck,
  verificationResult: VerificationExecutionResult
): { confidence: 'high' | 'medium' | 'low'; confidenceRationale: string } {
  // Low: any non-blocking failures
  const hasFailedSteps = verificationResult.steps.some(s => s.status === 'FAIL');
  if (hasFailedSteps) {
    return {
      confidence: 'low',
      confidenceRationale: 'One or more verification steps failed',
    };
  }

  // Medium: some evidence lacks verification status or optional missing
  const hasUnverifiedEvidence = evidenceChecklist.some(
    e => e.required && e.present && e.verificationStatus === null
  );
  const hasOptionalMissing = completeness.totalOptional > completeness.presentOptional;
  if (hasUnverifiedEvidence || hasOptionalMissing) {
    const reasons: string[] = [];
    if (hasUnverifiedEvidence) reasons.push('some evidence lacks automated verification status');
    if (hasOptionalMissing) reasons.push('optional evidence missing');
    return {
      confidence: 'medium',
      confidenceRationale: reasons.join('; '),
    };
  }

  // High: all evidence has verification status and passes
  return {
    confidence: 'high',
    confidenceRationale: 'All evidence is captured with clear pass indicators',
  };
}

// ---------------------------------------------------------------------------
// Rationale
// ---------------------------------------------------------------------------

function buildRationale(
  completeness: BundleCompletenessCheck,
  verificationResult: VerificationExecutionResult,
  runtimeProofGate: RuntimeProofGateResult,
  status: BundleVerdictStatus
): string {
  const parts: string[] = [];

  // Completeness summary
  parts.push(
    `${completeness.presentRequired}/${completeness.totalRequired} required artifacts present`
  );

  if (completeness.missingRequired.length > 0) {
    parts.push(`Missing: ${completeness.missingRequired.join(', ')}`);
  }

  if (completeness.emptyRequired.length > 0) {
    parts.push(`Empty: ${completeness.emptyRequired.join(', ')}`);
  }

  // Verification summary
  const { summary } = verificationResult;
  parts.push(
    `Verification: ${summary.passed} passed, ${summary.failed} failed, ${summary.blocked} blocked, ${summary.skipped} skipped`
  );

  // Runtime proof gate
  if (runtimeProofGate.required) {
    parts.push(`Runtime proof gate: ${runtimeProofGate.satisfied ? 'satisfied' : 'NOT satisfied'}`);
  }

  // Status indicator
  if (status === 'PASS') {
    parts.push('All requirements met');
  }

  return parts.join('. ') + '.';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the verification step status that corresponds to a proof category.
 */
function findVerificationStatus(
  category: string,
  verificationResult: VerificationExecutionResult
): VerificationStepStatus | null {
  const recipeIds = CATEGORY_TO_RECIPE_MAP[category];
  if (!recipeIds) return null;

  for (const recipeId of recipeIds) {
    const step = verificationResult.steps.find(s => s.recipeId === recipeId);
    if (step) return step.status;
  }

  return null;
}
