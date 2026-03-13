/**
 * VERIFICATION & SIMULATION CONTROL PLANE — Shadow Guardrails Public API
 * Sprint: SPRINT-VERIFICATION-SHADOW-DIVERGENCE-GUARDRAILS
 *
 * Import from here, not from internal sub-modules.
 */

// Types
export type {
  DivergenceLevel,
  ShadowVerdict,
  ScoreDivergence,
  StructuralDivergence,
  ClassifiedDivergences,
  ShadowVerdictResult,
  ShadowRunnerConfig,
  ShadowRunnerResult,
} from './types';

// Score comparator
export { ShadowScoreComparator } from './shadow-comparator';

// Divergence classifier
export { DivergenceClassifier } from './divergence-classifier';

// Verdict engine
export { ShadowVerdictEngine } from './shadow-verdict';

// Proof writer
export { ShadowGuardrailsProofWriter } from './shadow-proof-writer';

// Runner (top-level orchestrator)
export { ShadowRunner } from './shadow-runner';
