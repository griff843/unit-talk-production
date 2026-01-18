/**
 * Professional Pipeline Types
 *
 * Core interfaces and types for the modular professional betting pipeline.
 * Each professional feature implements the ProfessionalFeature interface.
 */

import { GradingFeatureSet } from '../../types/GradingFeatureSet';

/**
 * Complete context provided to each professional feature.
 * Includes canonical IDs, CLV data, grading features, and market data.
 */
export interface ProfessionalContext {
  // Core Identifiers (from Phase 2 canonical entities)
  propId: string;
  canonicalGameId: string;
  canonicalPlayerId: string;
  tenantId: string;

  // Prop Details
  league: string;
  statType: string;
  line: number;
  overOdds: number;
  underOdds: number;
  playerName: string;
  team: string;
  opponent: string;
  gameDate: Date;

  // Grading Features (from SyndicateGradingEngine)
  features: GradingFeatureSet;

  // Devigging Results
  deviggingResult: {
    trueOverProbability: number;
    trueUnderProbability: number;
    fairLine?: number;
    vigPercentage: number;
  };

  // CLV Data (from Phase 2 CLV tracking)
  clvData?: {
    trackingId: string;
    submittedLine: number;
    submittedOdds: number;
    currentLine?: number;
    currentOdds?: number;
    clvBps?: number; // Closing Line Value in basis points
  };

  // Market Data Caches (shared across features)
  marketData?: {
    lineMovementHistory?: Map<string, any[]>;
    bettingPercentages?: Map<string, any>;
    bookLines?: Map<string, any[]>;
    injuries?: Map<string, any[]>;
    relatedProps?: Map<string, any[]>;
  };

  // Timing Context
  hoursToGame: number;
  submittedAt: Date;
}

/**
 * Result returned by each professional feature
 */
export interface ProfessionalFeatureResult<TData = any> {
  /**
   * Normalized score contribution (0.0 - 1.0)
   * This will be multiplied by the feature's weight
   */
  score: number;

  /**
   * Feature-specific insights/data for debugging and analytics
   */
  data: TData;

  /**
   * Optional confidence level (0.0 - 1.0)
   */
  confidence?: number;

  /**
   * Optional metadata (e.g., calculation time, cache hits)
   */
  metadata?: Record<string, any>;
}

/**
 * Common interface for all professional betting features.
 * Each feature is a standalone module that can be tested and orchestrated independently.
 */
export interface ProfessionalFeature<TResult = any> {
  /**
   * Unique identifier for this feature (e.g., 'steam-detection')
   */
  readonly id: string;

  /**
   * Human-readable name (e.g., 'Steam Detection')
   */
  readonly name: string;

  /**
   * Default scoring weight (0.0 - 1.0)
   */
  readonly defaultWeight: number;

  /**
   * Calculate feature insights for a given prop.
   * @param context - All data needed to evaluate this feature
   * @returns Feature-specific insights and score
   */
  calculate(context: ProfessionalContext): Promise<ProfessionalFeatureResult<TResult>>;

  /**
   * Validate that all required data is available in context.
   * @param context - Professional context to validate
   * @returns true if feature can be calculated, false otherwise
   */
  canCalculate(context: ProfessionalContext): boolean;
}

/**
 * Configuration for ProfessionalPipeline
 */
export interface ProfessionalPipelineConfig {
  /**
   * Custom feature weights (overrides defaults)
   */
  weights?: Record<string, number>;

  /**
   * Enable/disable specific features
   */
  enabledFeatures?: string[];

  /**
   * Parallel execution (default: false for predictable behavior)
   */
  parallel?: boolean;

  /**
   * Graceful degradation on feature errors (default: true)
   */
  gracefulDegradation?: boolean;
}

/**
 * Aggregated result from ProfessionalPipeline execution
 */
export interface ProfessionalPipelineResult {
  /**
   * Weighted composite score across all features (0.0 - 1.0)
   */
  compositeScore: number;

  /**
   * Individual results from each feature
   */
  featureResults: Map<string, ProfessionalFeatureResult>;

  /**
   * Unified insights structure (matches current format)
   */
  insights: ProfessionalInsights;

  /**
   * Execution metadata
   */
  metadata?: {
    totalDurationMs: number;
    featuresExecuted: number;
    featuresSkipped: number;
    featuresFailed: number;
  };
}

/**
 * Unified professional insights structure
 * (Matches current SyndicateGradingEngine format for backward compatibility)
 */
export interface ProfessionalInsights {
  steamAnalysis?: {
    hasSteam: boolean;
    steamDirection?: 'over' | 'under';
    lineMovement?: number;
    volumeSpike?: boolean;
  };

  predictedClosingLine?: {
    predictedLine: number;
    confidence: number;
    expectedEdge?: number;
  };

  optimalBettingTime?: {
    hoursToGame: number;
    isOptimal: boolean;
    timeEdge?: number;
  };

  lineShoppingResult?: {
    bestLine: number;
    bestBook: string;
    edgeVsSubmitted?: number;
  };

  bettingPercentages?: {
    overPercentage: number;
    underPercentage: number;
    sharpMoney?: 'over' | 'under';
    publicMoney?: 'over' | 'under';
  };

  marketTimingAdvantage?: {
    timeDecayFactor: number;
    earlyEdge?: number;
  };

  injuryTimingAdvantage?: {
    recentInjuries: boolean;
    timingEdge?: number;
  };

  crossMarketArbitrage?: {
    hasArbitrage: boolean;
    relatedProps?: any[];
    arbitrageEdge?: number;
  };
}

/**
 * Feature weights (matches current SyndicateGradingEngine defaults)
 */
export const DEFAULT_FEATURE_WEIGHTS: Record<string, number> = {
  'steam-detection': 0.025, // 2.5%
  'closing-line-prediction': 0.020, // 2.0%
  'optimal-timing': 0.015, // 1.5%
  'line-shopping': 0.015, // 1.5%
  'public-vs-sharp': 0.020, // 2.0%
  'market-timing': 0.010, // 1.0%
  'injury-timing': 0.010, // 1.0%
  'cross-market': 0.005, // 0.5%
};
