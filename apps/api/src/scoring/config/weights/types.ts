/**
 * Centralized scoring weights types for all sports
 * Ensures type safety and eliminates magic numbers
 */

export interface CoreScoringWeights {
  // Core Components (22 points total)
  expectedValue: number; // Primary factor - expected value calculation
  lineMovement: number; // Line movement analysis
  matchupRating: number; // Team/player matchup rating
  playerForm: number; // Recent player performance
  injuryImpact: number; // Injury status impact
  weatherImpact: number; // Weather conditions impact

  // Advanced Market Intelligence (40 points total)
  marketIntelligence: number; // Market sentiment analysis
  sharpMoney: number; // Sharp money detection
  volumeProfile: number; // Betting volume patterns
  closingLineValue: number; // CLV prediction

  // Professional Capper Features (8 points total)
  steamDetection: number; // Real-time steam move detection
  closingLinePrediction: number; // Predictive line closure modeling
  optimalTiming: number; // Hour-to-game edge calculation
  lineShoppingEdge: number; // Multi-book best line identification
  publicVsSharpSplit: number; // Contrarian opportunity detection
  marketTimingAdvantage: number; // Time-decay edge modeling
  injuryTimingEdge: number; // News break vs line adjustment timing
  crossMarketDiscrepancy: number; // Related prop arbitrage detection

  // Player & Game Context (5 points total)
  playerFatigue: number; // Rest/fatigue impact
  venueAdvantage: number; // Home/away performance
  refereeImpact: number; // Official tendencies
  paceImpact: number; // Game pace effects
  motivationalFactors: number; // Situational motivation

  // Risk & Correlation (3 points total)
  correlationRisk: number; // Portfolio correlation
  volatility: number; // Outcome volatility
  portfolioImpact: number; // Overall portfolio impact

  // ML Model Ensemble (4 points total)
  neuralNetwork: number; // Neural network prediction
  gradientBoosting: number; // Gradient boosting model
  randomForest: number; // Random forest model
  ensemble: number; // Ensemble consensus
}

export interface EnhancedScoringWeights {
  // Enhanced Capper Features (from professional insights)
  handednessSplits: number; // Handedness analysis (MLB focus)
  recentTrendAnalysis: number; // Recent trend analysis
  headToHeadHistory: number; // H2H performance
  rosterStabilityScore: number; // Team chemistry
  bullpenQualityScore: number; // Bullpen assessment (MLB)
  advancedSplitAnalysis: number; // Situational splits

  // Time-based weights for trends
  last3Weight: number; // Recent 3 games weight
  last7Weight: number; // Last week weight
  last15Weight: number; // Two weeks weight
  last30Weight: number; // Month weight
  enhancedWeight: number; // Enhanced analysis contribution
}

export interface SportSpecificWeights extends CoreScoringWeights, EnhancedScoringWeights {
  sport: string;
  version: string;
  description: string;
  lastUpdated: string;

  // Sport-specific modifiers
  sportSpecificFactors?: Record<string, number>;
}

export interface TierThresholds {
  S_TIER: { minScore: number; minEdge: number; maxRisk: number; minPositionSize: number };
  A_TIER: { minScore: number; minEdge: number; maxRisk: number; minPositionSize: number };
  B_TIER: { minScore: number; maxRisk: number; minPositionSize: number };
  C_TIER: { minScore: number; maxRisk: number; minPositionSize: number };
  D_TIER: { description: string };
}

export interface RiskManagementConfig {
  maxPositionSize: number; // 5% max bet
  kellyMultiplier: number; // 25% Kelly fraction cap
  maxDrawdown: number; // 20% max drawdown
  maxCorrelation: number; // 70% correlation limit
  minSharpeRatio: number; // Minimum Sharpe ratio
  maxExposurePerSport: number; // Max exposure per sport
  maxExposurePerPlayer: number; // Max exposure per player
  maxDailyRisk: number; // Max daily risk
  stopLossThreshold: number; // Stop loss threshold
  maxVaR: number; // Maximum Value at Risk
  maxCVaR: number; // Maximum Conditional VaR
}

export interface ScoringConfig {
  weights: SportSpecificWeights;
  tiers: TierThresholds;
  risk: RiskManagementConfig;
}

// ─── Explicit key lists for proper field enumeration ─────────────────────────

/** All 30 scoring weight keys from CoreScoringWeights */
export const CORE_WEIGHT_KEYS: (keyof CoreScoringWeights)[] = [
  // Core (6)
  'expectedValue',
  'lineMovement',
  'matchupRating',
  'playerForm',
  'injuryImpact',
  'weatherImpact',
  // Market (4)
  'marketIntelligence',
  'sharpMoney',
  'volumeProfile',
  'closingLineValue',
  // Capper (8)
  'steamDetection',
  'closingLinePrediction',
  'optimalTiming',
  'lineShoppingEdge',
  'publicVsSharpSplit',
  'marketTimingAdvantage',
  'injuryTimingEdge',
  'crossMarketDiscrepancy',
  // Context (5)
  'playerFatigue',
  'venueAdvantage',
  'refereeImpact',
  'paceImpact',
  'motivationalFactors',
  // Risk (3)
  'correlationRisk',
  'volatility',
  'portfolioImpact',
  // ML (4)
  'neuralNetwork',
  'gradientBoosting',
  'randomForest',
  'ensemble',
];

/** Enhanced feature keys (scoring weights, NOT time-based recency weights) */
export const ENHANCED_FEATURE_KEYS: (keyof EnhancedScoringWeights)[] = [
  'handednessSplits',
  'recentTrendAnalysis',
  'headToHeadHistory',
  'rosterStabilityScore',
  'bullpenQualityScore',
  'advancedSplitAnalysis',
];

/** Time-based recency weights — separate from scoring weights */
export const TIME_WEIGHT_KEYS: (keyof EnhancedScoringWeights)[] = [
  'last3Weight',
  'last7Weight',
  'last15Weight',
  'last30Weight',
  'enhancedWeight',
];

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Legacy validation — BROKEN: `as` casts are compile-time only, so both
 * Object.values() calls enumerate ALL numeric fields, double-counting.
 * Preserved for backward compatibility when SCORING_ENGINE_V2=false.
 */
export function validateWeights(weights: CoreScoringWeights & EnhancedScoringWeights): boolean {
  const coreTotal = Object.values(weights as CoreScoringWeights)
    .filter(v => typeof v === 'number')
    .reduce((sum, weight) => sum + weight, 0);

  const enhancedTotal = Object.values(weights as EnhancedScoringWeights)
    .filter(v => typeof v === 'number')
    .reduce((sum, weight) => sum + weight, 0);

  const total = coreTotal + enhancedTotal;

  // Allow some tolerance for floating point arithmetic
  return Math.abs(total - 1.0) < 0.001;
}

/**
 * V2 validation — uses explicit key lists to avoid double-counting.
 * Checks that all scoring weights are non-negative and total > 0.
 * Does NOT require sum = 1.0 because computeScoreV2 normalizes by total weight.
 */
export interface WeightValidationResult {
  valid: boolean;
  coreTotal: number;
  enhancedTotal: number;
  total: number;
  issues: string[];
}

export function validateWeightsV2(weights: SportSpecificWeights): WeightValidationResult {
  const issues: string[] = [];
  let coreTotal = 0;
  let enhancedTotal = 0;

  for (const key of CORE_WEIGHT_KEYS) {
    const v = weights[key];
    if (typeof v !== 'number' || isNaN(v)) {
      issues.push(`Missing or non-number core weight: ${key}`);
      continue;
    }
    if (v < 0) {
      issues.push(`Negative core weight: ${key} = ${v}`);
    }
    coreTotal += v;
  }

  for (const key of ENHANCED_FEATURE_KEYS) {
    const v = weights[key];
    if (typeof v !== 'number' || isNaN(v)) {
      issues.push(`Missing or non-number enhanced weight: ${key}`);
      continue;
    }
    if (v < 0) {
      issues.push(`Negative enhanced weight: ${key} = ${v}`);
    }
    enhancedTotal += v;
  }

  const total = coreTotal + enhancedTotal;

  if (total <= 0) {
    issues.push(`Total scoring weight is ${total}, must be > 0`);
  }

  return { valid: issues.length === 0, coreTotal, enhancedTotal, total, issues };
}
