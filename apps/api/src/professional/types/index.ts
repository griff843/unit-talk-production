/**
 * Professional Features Types
 * Phase 5: Syndicate-Level ML Betting System
 *
 * These types define the 8 professional features that separate
 * syndicate-level systems from amateur betting platforms.
 */

import type { ScoringFeatureSet } from '../../types/ScoringFeatureSet';

// ========================================
// Core Professional Feature Types
// ========================================

export interface ProfessionalFeatureSet extends ScoringFeatureSet {
  // Professional feature scores (0-100)
  steamDetectionScore: number;
  closingLinePrediction: number;
  optimalTimingScore: number;
  lineShoppingEdge: number;
  publicVsSharpSplit: number;
  marketTimingAdvantage: number;
  injuryTimingEdge: number;
  crossMarketDiscrepancy: number;

  // Professional metadata
  professionalGrade: 'SYNDICATE' | 'SHARP' | 'RECREATIONAL';
  confidence: number;
  expectedCLV: number;
  riskAdjustedEdge: number;
}

// ========================================
// 1. Steam Detection Engine 🔥
// ========================================

export interface SteamDetectionResult {
  steamDetected: boolean;
  steamScore: number; // 0-100
  lineMovement: number; // Points moved
  volumeCorrelation: number; // 0-1
  timeToMove: number; // Minutes
  sharpMoneyIndicators: {
    reverseLineMovement: boolean;
    volumeSpike: boolean;
    bookmakerReaction: boolean;
    crossBookConsensus: boolean;
  };
  steamHistory: SteamEvent[];
  recommendedAction: 'BET_IMMEDIATELY' | 'MONITOR' | 'AVOID';
}

export interface SteamEvent {
  timestamp: string;
  lineChange: number;
  volume: number;
  bookmaker: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// ========================================
// 2. Closing Line Prediction 📈
// ========================================

export interface ClosingLinePredictionResult {
  predictedClosingLine: number;
  currentLine: number;
  expectedMovement: number; // Points expected to move
  confidence: number; // 0-1
  timeRemaining: number; // Hours until game
  historicalAccuracy: number; // Model accuracy
  factors: {
    injuryNews: number;
    weatherForecast: number;
    marketDynamics: number;
    sharpAction: number;
    publicMoney: number;
  };
  optimalEntryWindow: {
    startTime: string;
    endTime: string;
    reasoning: string;
  };
}

// ========================================
// 3. Optimal Timing Engine ⏰
// ========================================

export interface OptimalTimingResult {
  optimalTimingScore: number; // 0-100
  hoursToGame: number;
  edgeDecayRate: number; // Edge loss per hour
  currentEdge: number;
  projectedEdge: number;
  timingRecommendation: {
    action: 'BET_NOW' | 'WAIT' | 'MONITOR' | 'AVOID';
    reasoning: string;
    targetTime?: string;
    maxEdgeWindow: {
      start: string;
      end: string;
      expectedEdge: number;
    };
  };
  historicalPatterns: {
    avgEdgeAtHour: Record<number, number>;
    optimalBetTime: number; // Hours before game
    successRate: number;
  };
}

// ========================================
// 4. Line Shopping Edge 🛒
// ========================================

export interface LineShoppingResult {
  bestLine: number;
  bestBook: string;
  currentBook: string;
  currentLine: number;
  edgeImprovement: number; // Additional edge from line shopping
  availableLines: BookLine[];
  arbitrageOpportunity?: ArbitrageOpportunity;
  recommendedBook: string;
  timing: {
    lineAvailability: number; // Likelihood line stays available
    executionSpeed: 'FAST' | 'MEDIUM' | 'SLOW';
    limitRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export interface BookLine {
  bookmaker: string;
  line: number;
  odds: number;
  limit: number;
  availability: number; // 0-1
  lastUpdated: string;
  reliability: number; // 0-1
}

export interface ArbitrageOpportunity {
  guaranteed: boolean;
  profit: number; // Percentage profit
  books: {
    book1: string;
    line1: number;
    book2: string;
    line2: number;
  };
  minStake: number;
  maxStake: number;
  timeWindow: number; // Seconds until opportunity expires
}

// ========================================
// 5. Public vs Sharp Split Analysis 👥
// ========================================

export interface PublicSharpSplitResult {
  publicBettingPercentage: number; // 0-100
  sharpBettingPercentage: number; // 0-100
  contrarianOpportunity: boolean;
  contrarianScore: number; // 0-100
  historicalFadeSuccess: number; // Success rate of fading public
  sharpMoneyIndicators: {
    reverseLineMovement: boolean;
    lowPublicHighSharp: boolean;
    professionalBettorActivity: boolean;
    syndicateSignals: boolean;
  };
  recommendation: {
    action: 'FADE_PUBLIC' | 'FOLLOW_SHARP' | 'NEUTRAL' | 'AVOID';
    confidence: number;
    reasoning: string;
  };
}

// ========================================
// 6. Market Timing Advantage 📊
// ========================================

export interface MarketTimingResult {
  marketEfficiency: number; // 0-1 (1 = perfectly efficient)
  timingAdvantage: number; // 0-100
  edgeDecay: {
    currentEdge: number;
    hourlyDecay: number;
    halfLife: number; // Hours until edge is halved
  };
  optimalEntry: {
    timing: string;
    expectedEdge: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  marketPredictions: {
    nextHour: number;
    next4Hours: number;
    closingEdge: number;
  };
}

// ========================================
// 7. Injury Timing Edge 🏥
// ========================================

export interface InjuryTimingResult {
  injuryTimingScore: number; // 0-100
  newsBreakEdge: number; // Edge from being early on injury news
  lineAdjustmentSpeed: number; // How fast books adjust
  newsSources: NewsSource[];
  injuryImpact: {
    playerImpact: number; // 0-100
    teamImpact: number; // 0-100
    marketReaction: number; // Expected line movement
  };
  timingWindow: {
    newsBreakTime: string;
    lineAdjustmentTime: string;
    opportunityWindow: number; // Seconds of edge
    edgeValue: number;
  };
}

export interface NewsSource {
  source: string;
  reliability: number; // 0-1
  speed: number; // Minutes before general public
  injuryType: string;
  impact: 'MINOR' | 'MODERATE' | 'MAJOR' | 'SEASON_ENDING';
  lastUpdate: string;
}

// ========================================
// 8. Cross Market Discrepancy Detection 🔄
// ========================================

export interface CrossMarketDiscrepancyResult {
  discrepancyScore: number; // 0-100
  arbitrageOpportunities: CrossMarketArbitrage[];
  correlationInconsistencies: CorrelationInconsistency[];
  recommendedStrategy: {
    primaryBet: BetRecommendation;
    hedgeBets: BetRecommendation[];
    totalEdge: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export interface CrossMarketArbitrage {
  market1: string;
  market2: string;
  correlation: number; // Expected correlation
  actualCorrelation: number; // Observed correlation
  discrepancy: number; // Difference
  opportunitySize: number; // Potential profit
  confidence: number; // 0-1
  strategy: string;
}

export interface CorrelationInconsistency {
  prop1: string;
  prop2: string;
  expectedCorrelation: number;
  impliedCorrelation: number;
  discrepancySize: number;
  tradingOpportunity: boolean;
}

export interface BetRecommendation {
  market: string;
  side: 'OVER' | 'UNDER';
  line: number;
  odds: number;
  stake: number;
  expectedValue: number;
  book: string;
}

// ========================================
// Professional Feature Configuration
// ========================================

export interface ProfessionalFeatureConfig {
  steamDetection: {
    enabled: boolean;
    minLineMovement: number; // Minimum points to consider steam
    timeWindow: number; // Minutes to analyze
    volumeThreshold: number; // Minimum volume increase
    confidence: number; // 0-1
  };

  closingLinePrediction: {
    enabled: boolean;
    modelVersion: string;
    lookAheadHours: number;
    confidence: number;
    historicalDepth: number; // Days of historical data
  };

  optimalTiming: {
    enabled: boolean;
    maxHoursBeforeGame: number;
    edgeDecayModel: 'LINEAR' | 'EXPONENTIAL' | 'LOGARITHMIC';
    confidence: number;
  };

  lineShopping: {
    enabled: boolean;
    books: string[];
    maxLatency: number; // Max acceptable latency in ms
    reliability: number; // Min book reliability score
  };

  publicSharpSplit: {
    enabled: boolean;
    contrarianThreshold: number; // Min public % for contrarian play
    confidence: number;
    historicalDepth: number;
  };

  marketTiming: {
    enabled: boolean;
    efficiencyModel: string;
    confidence: number;
  };

  injuryTiming: {
    enabled: boolean;
    newsSources: string[];
    maxNewsAge: number; // Minutes
    reliability: number;
  };

  crossMarketDiscrepancy: {
    enabled: boolean;
    correlationThreshold: number;
    arbitrageThreshold: number; // Min profit %
    maxRisk: number;
  };
}

// ========================================
// Professional Feature Results
// ========================================

export interface ProfessionalFeaturesResult {
  // Individual feature results
  steamDetection: SteamDetectionResult;
  closingLinePrediction: ClosingLinePredictionResult;
  optimalTiming: OptimalTimingResult;
  lineShopping: LineShoppingResult;
  publicSharpSplit: PublicSharpSplitResult;
  marketTiming: MarketTimingResult;
  injuryTiming: InjuryTimingResult;
  crossMarketDiscrepancy: CrossMarketDiscrepancyResult;

  // Aggregate scoring
  overallProfessionalScore: number; // 0-100
  confidence: number; // 0-1
  recommendedAction: 'BET' | 'MONITOR' | 'AVOID';

  // Risk assessment
  riskAdjustedEdge: number;
  expectedCLV: number;
  kellyFraction: number;
  maxPosition: number;

  // Metadata
  processingTime: number; // ms
  version: string;
  timestamp: string;
  config: ProfessionalFeatureConfig;
}

// ========================================
// Professional Feature Engine Interface
// ========================================

export interface ProfessionalFeatureEngine {
  // Core processing
  analyzeProp(prop: ScoringFeatureSet, config?: Partial<ProfessionalFeatureConfig>): Promise<ProfessionalFeaturesResult>;
  batchAnalyze(props: ScoringFeatureSet[], config?: Partial<ProfessionalFeatureConfig>): Promise<ProfessionalFeaturesResult[]>;

  // Individual feature engines
  detectSteam(prop: ScoringFeatureSet): Promise<SteamDetectionResult>;
  predictClosingLine(prop: ScoringFeatureSet): Promise<ClosingLinePredictionResult>;
  calculateOptimalTiming(prop: ScoringFeatureSet): Promise<OptimalTimingResult>;
  findLineShoppingEdge(prop: ScoringFeatureSet): Promise<LineShoppingResult>;
  analyzePublicSharpSplit(prop: ScoringFeatureSet): Promise<PublicSharpSplitResult>;
  calculateMarketTiming(prop: ScoringFeatureSet): Promise<MarketTimingResult>;
  detectInjuryTiming(prop: ScoringFeatureSet): Promise<InjuryTimingResult>;
  findCrossMarketDiscrepancy(prop: ScoringFeatureSet): Promise<CrossMarketDiscrepancyResult>;

  // Monitoring and health
  getHealthStatus(): Promise<EngineHealthStatus>;
  getPerformanceMetrics(): Promise<EnginePerformanceMetrics>;
  updateConfig(config: Partial<ProfessionalFeatureConfig>): void;
}

export interface EngineHealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  features: Record<string, FeatureHealthStatus>;
  lastUpdate: string;
  issues: string[];
}

export interface FeatureHealthStatus {
  enabled: boolean;
  operational: boolean;
  latency: number; // ms
  errorRate: number; // 0-1
  lastError?: string;
}

export interface EnginePerformanceMetrics {
  totalProcessed: number;
  avgProcessingTime: number; // ms
  successRate: number; // 0-1
  clvPerformance: number; // Average CLV achieved
  accuracy: Record<string, number>; // Feature-specific accuracy
  throughput: number; // Props per minute
}

// ========================================
// Export all types
// ========================================

export * from './steam-detection';
export * from './closing-line-prediction';
export * from './optimal-timing';
export * from './line-shopping';
export * from './public-sharp-split';
export * from './market-timing';
export * from './injury-timing';
export * from './cross-market-discrepancy';