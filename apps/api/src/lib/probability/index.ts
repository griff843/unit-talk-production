/**
 * Probability Layer
 * Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001
 * Updated: SPRINT-REPO-TRUTH-LOCK-002 (restored local imports)
 *
 * Exports for probability computation, devig consensus, and calibration.
 * Canonical copies also exist in @unit-talk/intelligence package — keep in sync.
 * offerFetch stays here (has Supabase I/O dependency).
 */

// Re-export from local modules
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
} from './devigConsensus';

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
} from './probabilityLayer';

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
} from './calibrationCompute';

// offerFetch stays in API (has Supabase I/O dependency)
export {
  // Types
  type FetchOffersParams,
  // Functions
  fetchBookOffers,
  fetchBookOffersDirect,
} from './offerFetch';
