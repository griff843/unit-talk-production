/**
 * Claude OS — Runtime Proof Gate
 *
 * Evaluates whether runtime proof requirements are satisfied
 * after verification execution. T3/T4 sprints require runtime
 * evidence; build-time verification alone is insufficient.
 */

import type {
  SprintExecutionPlan,
  VerificationStepResult,
  RuntimeProofGateResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Recipe IDs that constitute runtime evidence */
const RUNTIME_EVIDENCE_RECIPE_IDS = ['runtime_smoke', 'discord_canary', 'browser_smoke'];

/** Output file prefix that indicates runtime proof */
const RUNTIME_PROOF_OUTPUT_PREFIX = 'proofs/proof_runtime_';

// ---------------------------------------------------------------------------
// Gate Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate the runtime proof gate for a completed verification run.
 *
 * Runtime proof is required when:
 * 1. plan.request.runtimeProofRequired is explicitly true, OR
 * 2. The proof requirements include a 'runtime_evidence' category
 *    (indicating T3/T4 tier)
 *
 * Runtime proof is satisfied when at least one runtime-evidence step
 * has status PASS.
 */
export function evaluateRuntimeProofGate(
  plan: SprintExecutionPlan,
  steps: VerificationStepResult[]
): RuntimeProofGateResult {
  // Determine if runtime proof is required
  const explicitlyRequired = plan.request.runtimeProofRequired === true;
  const hasRuntimeProofRequirement = plan.proofRequirements.some(
    p => p.category === 'runtime_evidence'
  );
  const required = explicitlyRequired || hasRuntimeProofRequirement;

  if (!required) {
    return {
      required: false,
      satisfied: true,
      reason: 'Runtime proof not required for this sprint type',
      missingEvidence: [],
    };
  }

  // Find runtime evidence steps
  const runtimeSteps = steps.filter(s => isRuntimeEvidenceStep(s));

  // Check if any runtime step passed
  const satisfied = runtimeSteps.some(s => s.status === 'PASS');

  // Identify missing evidence
  const missingEvidence = runtimeSteps.filter(s => s.status !== 'PASS').map(s => s.recipeId);

  // If no runtime steps were even attempted, list expected recipe IDs
  if (runtimeSteps.length === 0) {
    return {
      required: true,
      satisfied: false,
      reason: 'Runtime proof required but no runtime evidence recipes were executed',
      missingEvidence: [...RUNTIME_EVIDENCE_RECIPE_IDS],
    };
  }

  if (satisfied) {
    return {
      required: true,
      satisfied: true,
      reason: `Runtime proof satisfied — ${runtimeSteps.filter(s => s.status === 'PASS').length} runtime evidence step(s) passed`,
      missingEvidence: [],
    };
  }

  return {
    required: true,
    satisfied: false,
    reason: `Runtime proof required but no runtime evidence steps passed (${runtimeSteps.length} attempted)`,
    missingEvidence,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine if a verification step constitutes runtime evidence.
 */
function isRuntimeEvidenceStep(step: VerificationStepResult): boolean {
  // Match by recipe ID
  if (RUNTIME_EVIDENCE_RECIPE_IDS.includes(step.recipeId)) {
    return true;
  }

  // Match by output file prefix
  if (step.outputFile && step.outputFile.startsWith(RUNTIME_PROOF_OUTPUT_PREFIX)) {
    return true;
  }

  return false;
}
