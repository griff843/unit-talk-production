/**
 * Claude OS — Verification Classifier
 *
 * Pure classification logic for verification step outcomes.
 * No I/O — all inputs and outputs are plain data.
 */

import type {
  VerificationRequirement,
  CommandRunResult,
  VerificationStepStatus,
  VerificationStepResult,
  VerificationOverallStatus,
  RuntimeProofGateResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Step Classification
// ---------------------------------------------------------------------------

/**
 * Classify the outcome of a single verification step.
 *
 * Evaluation order:
 * 1. Unresolved + required → BLOCKED
 * 2. Unresolved + optional → SKIPPED
 * 3. Null command result  → BLOCKED (internal error)
 * 4. Timed out            → FAIL
 * 5. Exit code 0          → PASS
 * 6. Non-zero exit code   → FAIL
 */
export function classifyStep(
  requirement: VerificationRequirement,
  commandResult: CommandRunResult | null
): { status: VerificationStepStatus; reason: string } {
  // Unresolved command — no execution possible
  if (!requirement.commandResolved) {
    if (requirement.required) {
      return { status: 'BLOCKED', reason: 'Required recipe has unresolved command' };
    }
    return { status: 'SKIPPED', reason: 'Optional recipe has unresolved command' };
  }

  // Resolved but no result — internal error
  if (commandResult === null) {
    return { status: 'BLOCKED', reason: 'No command result — internal error' };
  }

  // Timeout
  if (commandResult.timedOut) {
    return { status: 'FAIL', reason: `Timed out after ${commandResult.durationMs}ms` };
  }

  // Exit code
  if (commandResult.exitCode === 0) {
    return { status: 'PASS', reason: 'Exit code 0' };
  }

  return { status: 'FAIL', reason: `Exit code ${commandResult.exitCode}` };
}

// ---------------------------------------------------------------------------
// Overall Status Derivation
// ---------------------------------------------------------------------------

/**
 * Derive the overall verification status from individual step results
 * and the runtime proof gate.
 *
 * Rules:
 * - Any step FAIL → FAIL
 * - Any BLOCKED step with failureSeverity 'blocking' → BLOCKED
 * - RuntimeProofGate required but not satisfied → BLOCKED
 * - Otherwise → PASS
 */
export function deriveOverallStatus(
  steps: VerificationStepResult[],
  requirements: VerificationRequirement[],
  runtimeProofGate: RuntimeProofGateResult
): VerificationOverallStatus {
  // Check for any FAIL
  const hasFail = steps.some(s => s.status === 'FAIL');
  if (hasFail) return 'FAIL';

  // Check for blocking BLOCKED steps
  const hasBlockingBlocked = steps.some(s => {
    if (s.status !== 'BLOCKED') return false;
    const req = requirements.find(r => r.recipeId === s.recipeId);
    return req?.failureSeverity === 'blocking';
  });
  if (hasBlockingBlocked) return 'BLOCKED';

  // Check runtime proof gate
  if (runtimeProofGate.required && !runtimeProofGate.satisfied) {
    return 'BLOCKED';
  }

  return 'PASS';
}
