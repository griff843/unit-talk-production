/**
 * @unit-talk/intelligence
 *
 * Scoring, edge computation, and analytical intelligence for Unit Talk Platform.
 *
 * SPRINT-REPO-TRUTH-LOCK-002: Populated with probability layer (pure computation).
 * SPRINT-REPO-ARCHITECTURE-NORMALIZATION-001: Shell created for Blueprint v2 alignment.
 *
 * Modules:
 * - probability/devigConsensus: Devig methods, book weighting, consensus computation
 * - probability/probabilityLayer: P_final computation, uncertainty, CLV forecast
 * - probability/calibrationCompute: Brier score, ECE, reliability buckets
 */

// ── Probability: Devig Consensus ──────────────────────────────────────────────

export {
  // Types
  type DevigMethod,
  type BookProfile,
  type LiquidityTier,
  type DataQuality,
  type BookOffer,
  type DevigedBook,
  type BookWeightBreakdown,
  type ConsensusResult,
  type ConsensusResultOk,
  type ConsensusResultFail,
  type ConsensusFailReason,
  type EdgeResult,
  // Functions
  americanToImplied,
  calculateOverround,
  proportionalDevig,
  shinDevig,
  powerDevig,
  applyDevig,
  calculateBookWeight,
  computeConsensus,
  calculateEdge,
  calculateCLVProb,
  // Constants
  PROBABILITY_MODEL_VERSION,
  MIN_BOOKS_FOR_CONSENSUS,
  LIQUIDITY_WEIGHTS,
  SHARP_WEIGHTS,
  DATA_QUALITY_WEIGHTS,
  roundTo,
} from './probability/devigConsensus';

// ── Probability: Probability Layer ────────────────────────────────────────────

export {
  // Types
  type ProbabilityInput,
  type ProbabilityOutput,
  type ProbabilityOutputOk,
  type ProbabilityOutputFail,
  type ProbabilityFailReason,
  type UncertaintyFactors,
  type ExplanationPayload,
  type SyndicateLayerParams,
  type PFinalResult,
  // Functions
  computeProbabilityLayer,
  computeUncertainty,
  computePFinal,
  computeCLVForecast,
  computeConfidenceFactor,
  computeDynamicCap,
  // Constants
  UNCERTAINTY_THRESHOLDS,
} from './probability/probabilityLayer';

// ── Probability: Calibration Compute ──────────────────────────────────────────

export {
  // Types
  type PredictionOutcome,
  type ReliabilityBucket,
  type CalibrationMetrics,
  // Functions
  computeBrierScore,
  computeLogLoss,
  computeReliabilityBuckets,
  computeECE,
  computeMCE,
  computeCalibrationMetrics,
  // Constants
  DEFAULT_BUCKET_WIDTH,
} from './probability/calibrationCompute';
