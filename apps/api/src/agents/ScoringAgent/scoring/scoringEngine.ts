import { clvTrackingService } from '../../../services/clv/CLVTrackingService';
import { deviggingService } from '../../../services/devigging/DeviggingService';
import { ScoringFeatureSet } from '../../../types/ScoringFeatureSet';
import { getScoringConfig } from '../../../scoring/config/weights';

import { enhancedScoringEngine, EnhancedScoringResult } from './enhancedScoringEngine';
import { FeatureEngineer } from './featureEngineer';
import { MLModelManager } from './mlModelManager';
import { PerformanceAnalyzer } from './performanceAnalyzer';
import { RiskManager } from './riskManager';

export interface ScoringWeights {
  // Core Scoring Components
  expectedValue: number;
  lineMovement: number;
  matchupRating: number;
  playerForm: number;
  injuryImpact: number;
  weatherImpact: number;

  // Advanced Market Intelligence
  marketIntelligence: number;
  sharpMoney: number;
  volumeProfile: number;
  closingLineValue: number;

  // 🆕 NEW: 8 Professional Capper Features
  steamDetection: number;              // Real-time steam move detection
  closingLinePrediction: number;       // Predictive line closure modeling
  optimalTiming: number;               // Hour-to-game edge calculation
  lineShoppingEdge: number;            // Multi-book best line identification
  publicVsSharpSplit: number;          // Contrarian opportunity detection
  marketTimingAdvantage: number;       // Time-decay edge modeling
  injuryTimingEdge: number;            // News break vs line adjustment timing
  crossMarketDiscrepancy: number;      // Related prop arbitrage detection

  // Player & Game Context
  playerFatigue: number;
  venueAdvantage: number;
  refereeImpact: number;
  paceImpact: number;
  motivationalFactors: number;

  // Risk & Correlation
  correlationRisk: number;
  volatility: number;
  portfolioImpact: number;

  // ML Model Ensemble
  neuralNetwork: number;
  gradientBoosting: number;
  randomForest: number;
  ensemble: number;
}

export interface ScoringConfig {
  name: string;
  version: string;
  weights: ScoringWeights;
  enabled: boolean;
  sport?: string;
  marketType?: string;
  minConfidence: number;
  maxRisk: number;
  description: string;
}

export interface ScoringResult {
  propId: string;
  finalScore: number;
  confidence: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  edgeScore: number;

  // Feature Attribution - Fortune 100 Level
  featureContributions: Record<string, number>;
  modelContributions: Record<string, number>;

  // Risk Assessment
  kellyFraction: number;
  positionSize: number;
  riskScore: number;
  correlationRisk: number;

  // Scenario Analysis
  scenarioAnalysis: {
    bullCase: { score: number; probability: number };
    baseCase: { score: number; probability: number };
    bearCase: { score: number; probability: number };
  };

  // 🆕 NEW: Professional Capper Insights
  professionalInsights: {
    steamMoveDetected: boolean;
    predictedClosingLine: number;
    optimalBettingTime: string;
    bestAvailableLine: number;
    bestBook: string;
    publicBettingPercentage: number;
    sharpBettingPercentage: number;
    contrarianOpportunity: boolean;
    injuryTimingAdvantage: number;
    crossMarketArbitrage: number;
  };

  // 🆕 NEW: Enhanced Capper Analysis (based on capper insights analysis)
  enhancedCapperAnalysis?: EnhancedScoringResult;

  // 🆕 NEW: Professional Devigging Results
  deviggingResult?: {
    originalEdge: number;
    deviggedEdge: number;
    totalVig: number;
    fairOdds: number;
    trueValue: boolean; // True if devigged edge > threshold
  };

  // Quality Metrics
  dataQuality: number;
  modelAgreement: number;
  historicalAccuracy: number;

  // Metadata
  timestamp: string;
  modelVersion: string;
  configUsed: string;
}

/**
 * Fortune 100 Syndicate-Level Grading Engine
 * Implements advanced multi-model scoring with dynamic weight optimization,
 * comprehensive risk management, and real-time performance attribution
 */

/**
 * Safe mathematical operations to prevent NaN errors
 */
function safeNumber(value: any, defaultValue: number = 0): number {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) || !isFinite(num) ? defaultValue : num;
}

function safeMultiply(a: any, b: any, defaultA: number = 0, defaultB: number = 1): number {
  const numA = safeNumber(a, defaultA);
  const numB = safeNumber(b, defaultB);
  const result = numA * numB;
  return isNaN(result) || !isFinite(result) ? 0 : result;
}

function safeDivide(numerator: any, denominator: any, defaultValue: number = 0): number {
  const num = safeNumber(numerator, 0);
  const den = safeNumber(denominator, 1);
  if (den === 0) return defaultValue;
  const result = num / den;
  return isNaN(result) || !isFinite(result) ? defaultValue : result;
}

function safeWeight(weights: any, key: string, defaultValue: number = 1): number {
  if (!weights || typeof weights !== 'object') return defaultValue;
  return safeNumber(weights[key], defaultValue);
}

// Note: SyndicateGradingEngine moved to gradingEngine.ts to avoid conflicts
// Import it from gradingEngine.ts instead of defining it here