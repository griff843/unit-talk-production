/**
 * Edge Engine Scoring Module
 * Sprint: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098
 *
 * Exports both PRE (selection) and POST (validation) scoring functions.
 *
 * Usage:
 * - For promotion/posting decisions: use PRE score (computeEdgeScorePre)
 * - For CLV validation/analysis: use POST score (computeEdgeScorePost)
 */

// PRE Score (Selection/Decision) - NO closing data
export {
  MODEL_VERSION_PRE,
  computeEdgeScorePre,
  computeEdgeScorePreBatch,
  verifyPreDeterminism,
  assertNoFutureData,
  validatePreInput,
  TIER_THRESHOLDS_PRE,
  MARKET_WEIGHTS_PRE,
  type EdgePreInput,
  type EdgePreOutput,
} from './edgeEnginePre';

// POST Score (Validation) - includes closing data
export {
  MODEL_VERSION,
  MODEL_VERSION_POST,
  computeEdgeV1,
  computeEdgeV1Batch,
  computeEdgeScorePost,
  computeEdgeScorePostBatch,
  verifyDeterminism,
  verifyPostDeterminism,
  TIER_THRESHOLDS,
  TIER_THRESHOLDS_POST,
  MARKET_WEIGHTS,
  RISK_THRESHOLDS,
  americanToImplied,
  americanToDecimal,
  type EdgeV1Input,
  type EdgeEngineV1Output,
  type EdgePostInput,
  type EdgePostOutput,
} from './edgeEngineV1';

// Combined scoring function for convenience
export { computeEdgeScores, type CombinedEdgeScores } from './computeEdgeScores';

// Promotion scoring (MUST use PRE score only)
export {
  computePromotionBand,
  meetsPromotionCriteriaPre,
  computePromotionBandBatch,
  PROMOTION_THRESHOLDS,
  type PromotionBand,
  type PromotionDecision,
} from './promotionScoring';
