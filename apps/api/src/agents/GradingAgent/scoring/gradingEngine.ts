/* eslint-disable max-lines, max-lines-per-function, complexity, no-unused-vars, no-return-await, no-console */
import { getScoringConfig, getSportWeights } from '../../../scoring/config/weights';
import { clvTrackingService } from '../../../services/clv/CLVTrackingService';
import { deviggingService } from '../../../services/devigging/DeviggingService';
import { GradingFeatureSet } from '../../../types/GradingFeatureSet';

import { canaryDecide } from './canaryRouter';
import { computeScoreV2 } from './computeScoreV2';
import { logDrift } from './driftLogger';
import { enhancedScoringEngine, EnhancedScoringResult } from './enhancedScoringEngine';
import { FeatureEngineer } from './featureEngineer';
import { MLModelManager } from './mlModelManager';
import { PerformanceAnalyzer } from './performanceAnalyzer';
import { evaluatePromotion, parsePromotionPolicyConfig } from './promotionPolicy';
import { RiskManager } from './riskManager';
// Tranche 2, Stage 1 (2026-01-29): Canonical tier determination
import { type Tier, canonicalTier } from './TierScale';
// Tranche 3, Stage 4 (2026-01-29): Unified V2 scoring pipeline
// Tranche 6 (2026-01-29): Canary routing + drift logging
// Tranche 9 (2026-01-29): V2 Primary mode — first-launch cutover

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
  steamDetection: number; // Real-time steam move detection
  closingLinePrediction: number; // Predictive line closure modeling
  optimalTiming: number; // Hour-to-game edge calculation
  lineShoppingEdge: number; // Multi-book best line identification
  publicVsSharpSplit: number; // Contrarian opportunity detection
  marketTimingAdvantage: number; // Time-decay edge modeling
  injuryTimingEdge: number; // News break vs line adjustment timing
  crossMarketDiscrepancy: number; // Related prop arbitrage detection

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

export interface GradingResult {
  propId: string;
  finalScore: number;
  confidence: number;
  tier: Tier;
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

  // Promotion Policy (Tranche 10 — Posting Governance)
  /** HARD / SOFT / NONE band from evaluatePromotion(). Null when V1 scoring or policy disabled. */
  promotionBand?: string;

  // Projection data (optional)
  projectionEdge?: number;
  projectionConfidence?: number;

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

export class SyndicateGradingEngine {
  private mlModelManager: MLModelManager;
  private featureEngineer: FeatureEngineer;
  private riskManager: RiskManager;
  private performanceAnalyzer: PerformanceAnalyzer;

  private scoringConfigs: Map<string, ScoringConfig> = new Map();
  private activeConfig: string = 'default';
  private _performanceHistory: Map<string, number[]> = new Map();

  // 🆕 NEW: Professional Capper Data Tracking
  private lineMovementHistory: Map<
    string,
    Array<{ timestamp: number; line: number; volume?: number }>
  > = new Map();
  private bettingPercentages: Map<string, { public: number; sharp: number; timestamp: number }> =
    new Map();
  private bookLines: Map<
    string,
    Array<{ book: string; line: number; odds: number; timestamp: number }>
  > = new Map();
  private injuryNews: Map<
    string,
    Array<{ timestamp: number; severity: number; newsBreak: number }>
  > = new Map();
  private crossMarketData: Map<string, Array<{ relatedPropId: string; correlation: number }>> =
    new Map();

  constructor() {
    // Initialize performance tracking
    this.initializePerformanceTracking();
    this.mlModelManager = new MLModelManager();
    this.featureEngineer = new FeatureEngineer();
    this.riskManager = new RiskManager({
      maxPositionSize: 0.05,
      maxCorrelation: 0.7,
      maxDrawdown: 0.2,
      minSharpeRatio: 1.0,
      maxExposurePerSport: 0.3,
      maxExposurePerPlayer: 0.1,
      maxDailyRisk: 0.15,
      kellyMultiplier: 0.25,
      stopLossThreshold: 0.15,
      maxVaR: 0.05,
      maxCVaR: 0.08,
    });
    this.performanceAnalyzer = new PerformanceAnalyzer();

    this.initializeDefaultConfigs();
  }

  /**
   * Initialize Fortune 100 level scoring configurations
   */
  private initializeDefaultConfigs(): void {
    // Default Fortune 100 Configuration + 8 New Professional Features
    const defaultConfig: ScoringConfig = {
      name: 'Fortune 100 Enhanced Pro',
      version: '2025.07.31',
      weights: {
        expectedValue: 0.22, // Slightly reduced to make room for new features
        lineMovement: 0.1,
        matchupRating: 0.13,
        playerForm: 0.09,
        injuryImpact: 0.07,
        weatherImpact: 0.02,
        marketIntelligence: 0.15,
        sharpMoney: 0.1,
        volumeProfile: 0.07,
        closingLineValue: 0.12,

        // 🆕 NEW: 8 Professional Capper Features (12% total weight)
        steamDetection: 0.025, // Real-time steam detection
        closingLinePrediction: 0.02, // Line closure prediction
        optimalTiming: 0.015, // Hour-to-game edge
        lineShoppingEdge: 0.015, // Multi-book advantage
        publicVsSharpSplit: 0.02, // Contrarian opportunities
        marketTimingAdvantage: 0.01, // Time-decay modeling
        injuryTimingEdge: 0.01, // Injury news timing
        crossMarketDiscrepancy: 0.005, // Related prop arbitrage

        playerFatigue: 0.05,
        venueAdvantage: 0.04,
        refereeImpact: 0.03,
        paceImpact: 0.04,
        motivationalFactors: 0.02,
        correlationRisk: 0.09,
        volatility: 0.07,
        portfolioImpact: 0.1,
        neuralNetwork: 0.18,
        gradientBoosting: 0.22,
        randomForest: 0.13,
        ensemble: 0.27,
      } as ScoringWeights,
      enabled: true,
      minConfidence: 75,
      maxRisk: 0.25,
      description: 'Fortune 100 syndicate-level scoring with advanced ML ensemble',
    };

    // Sport-Specific Configurations
    const nbaConfig: ScoringConfig = {
      ...defaultConfig,
      name: 'NBA Specialized',
      sport: 'NBA',
      weights: {
        ...defaultConfig.weights,
        playerFatigue: 0.12, // Higher weight for NBA fatigue
        paceImpact: 0.1, // NBA pace is crucial
        refereeImpact: 0.08, // NBA refs have significant impact
      },
    };

    const nflConfig: ScoringConfig = {
      ...defaultConfig,
      name: 'NFL Specialized',
      sport: 'NFL',
      weights: {
        ...defaultConfig.weights,
        weatherImpact: 0.08, // Weather crucial for NFL
        injuryImpact: 0.15, // Injuries more impactful in NFL
        motivationalFactors: 0.08, // Playoff implications matter more
      },
    };

    this.scoringConfigs.set('default', defaultConfig);
    this.scoringConfigs.set('nba', nbaConfig);
    this.scoringConfigs.set('nfl', nflConfig);
  }

  /**
   * Grade a single prop with Fortune 100 level analysis
   * NOW INCLUDES: Professional devigging and CLV tracking
   */
  async gradeProp(features: GradingFeatureSet): Promise<GradingResult> {
    const startTime = Date.now();

    // Tranche 6 (2026-01-29): Canary-routed V2 with shadow + drift logging
    const canary = canaryDecide(features.sport || 'NBA', features.propId || 'unknown');

    if (canary.mode === 'v2' || canary.mode === 'v2_primary') {
      const v2 = computeScoreV2(features);
      logDrift({
        pickId: features.propId || 'unknown',
        sport: features.sport || 'NBA',
        mode: 'v2',
        v1Score: 0,
        v1Tier: 'unknown',
        v1Ev: 0, // V1 not computed in V2 mode
        v2Result: v2,
      });
      // Tranche 7→10: Evaluate promotion policy for V2 result and persist band
      const promoCfg = parsePromotionPolicyConfig();
      let promotionBand: string | undefined;
      if (promoCfg.policyEnabled) {
        const pd = evaluatePromotion(
          v2,
          features.sport || 'NBA',
          features.propId || 'unknown',
          promoCfg
        );
        promotionBand = pd.band;
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({ type: 'promotion_decision', pick_id: features.propId, ...pd })
        );
      }
      return {
        propId: features.propId,
        finalScore: v2.score,
        confidence: v2.score / 100,
        tier: v2.tier,
        edgeScore: v2.ev,
        promotionBand,
        featureContributions: Object.fromEntries(
          Object.entries(v2.breakdown).map(([k, b]) => [k, b.contribution])
        ),
        modelContributions: {},
        kellyFraction: 0,
        positionSize: 0,
        riskScore: 0,
        correlationRisk: features.correlationRisk || 0,
        scenarioAnalysis: {
          bullCase: { score: Math.min(100, v2.score * 1.2), probability: 0.25 },
          baseCase: { score: v2.score, probability: 0.5 },
          bearCase: { score: v2.score * 0.8, probability: 0.25 },
        },
        professionalInsights: {
          steamMoveDetected: false,
          predictedClosingLine: features.market?.line || 0,
          optimalBettingTime: 'V2',
          bestAvailableLine: features.market?.line || 0,
          bestBook: features.book || 'Unknown',
          publicBettingPercentage: 50,
          sharpBettingPercentage: 50,
          contrarianOpportunity: false,
          injuryTimingAdvantage: 0,
          crossMarketArbitrage: 0,
        },
        dataQuality: features.dataQuality?.dataValidationScore || 0.95,
        modelAgreement: 1.0,
        historicalAccuracy: 0,
        timestamp: new Date().toISOString(),
        modelVersion: 'v2-registry',
        configUsed: 'computeScoreV2',
      };
    }

    // 🆕 STEP -1: GET SPORT-SPECIFIC CONFIGURATION
    const sportConfig = getScoringConfig(features.sport || 'NBA');
    const sportWeights = sportConfig.weights;

    // Temporarily override active config with sport-specific weights
    const originalConfig = this.activeConfig;
    const tempConfigKey = `${features.sport || 'NBA'}_temp_${Date.now()}`;
    this.scoringConfigs.set(tempConfigKey, {
      name: `${sportConfig.weights.sport} Professional`,
      version: sportConfig.weights.version,
      weights: this.convertToLegacyWeights(sportWeights),
      enabled: true,
      minConfidence: 75,
      maxRisk: 0.25,
      description: sportConfig.weights.description,
    });
    this.activeConfig = tempConfigKey;

    try {
      // 🆕 STEP 0: DEVIG ODDS (CRITICAL - ALL SHARP SYSTEMS DO THIS FIRST)
      const deviggingResult = await this.devigOdds(features);

      // 🆕 STEP 0.5: START CLV TRACKING
      await this.startCLVTracking(features);

      // 1. Enrich features with advanced analytics (now using devigged odds)
      const enrichedFeatures = await this.featureEngineer.enrichFeatures({
        ...features,
        // Replace raw odds with devigged fair odds for all calculations
        odds: deviggingResult.fairOdds,
        expectedValue: deviggingResult.deviggedEdge, // Use true edge
        market: {
          ...features.market,
          odds: deviggingResult.fairOdds,
        },
      });

      // 2. Get ML model predictions
      let mlPredictions = await this.getMLPredictions(enrichedFeatures);

      // Ensure ML predictions has valid structure
      if (!mlPredictions || typeof mlPredictions !== 'object') {
        console.warn('Invalid ML predictions, using fallback');
        mlPredictions = {
          neuralNetwork: 50,
          gradientBoosting: 50,
          randomForest: 50,
          ensemble: 50,
          contributions: {
            'Neural Network': 10,
            'Gradient Boosting': 12.5,
            'Random Forest': 7.5,
            Ensemble: 15,
          },
          agreement: 0.5,
        };
      }

      // Validate each prediction value
      mlPredictions.neuralNetwork = safeNumber(mlPredictions.neuralNetwork, 50);
      mlPredictions.gradientBoosting = safeNumber(mlPredictions.gradientBoosting, 50);
      mlPredictions.randomForest = safeNumber(mlPredictions.randomForest, 50);
      mlPredictions.ensemble = safeNumber(mlPredictions.ensemble, 50);
      mlPredictions.agreement = safeNumber(mlPredictions.agreement, 0.5);

      // Ensure ML predictions have required structure with safe defaults
      if (!mlPredictions || typeof mlPredictions !== 'object') {
        mlPredictions = {
          neuralNetwork: 50,
          gradientBoosting: 50,
          randomForest: 50,
          ensemble: 50,
          contributions: {
            'Neural Network': 10,
            'Gradient Boosting': 12.5,
            'Random Forest': 7.5,
            Ensemble: 15,
          },
          agreement: 0.5,
        };
      }

      // Ensure all required ML prediction fields exist
      mlPredictions.neuralNetwork = safeNumber(mlPredictions.neuralNetwork, 50);
      mlPredictions.gradientBoosting = safeNumber(mlPredictions.gradientBoosting, 50);
      mlPredictions.randomForest = safeNumber(mlPredictions.randomForest, 50);
      mlPredictions.ensemble = safeNumber(mlPredictions.ensemble, 50);
      mlPredictions.agreement = safeNumber(mlPredictions.agreement, 0.5);

      if (!mlPredictions.contributions || typeof mlPredictions.contributions !== 'object') {
        mlPredictions.contributions = {
          'Neural Network': safeNumber(mlPredictions.neuralNetwork, 50) * 0.2,
          'Gradient Boosting': safeNumber(mlPredictions.gradientBoosting, 50) * 0.25,
          'Random Forest': safeNumber(mlPredictions.randomForest, 50) * 0.15,
          Ensemble: safeNumber(mlPredictions.ensemble, 50) * 0.3,
        };
      }

      // 3. Calculate composite professional_score with dynamic weights
      const compositeScore = await this.calculateCompositeScore(enrichedFeatures, mlPredictions);

      // 4. Calculate initial confidence based on professional_score and ML agreement
      const initialConfidence = safeNumber(
        Math.min(
          100,
          safeNumber(compositeScore?.finalScore, 0) * safeNumber(mlPredictions?.agreement, 0.5)
        ),
        50
      );

      // Debug logging for confidence calculation
      if (isNaN(initialConfidence)) {
        console.warn('Initial confidence calculation producing NaN:', {
          compositeFinalScore: compositeScore?.finalScore,
          mlAgreement: mlPredictions?.agreement,
          result: initialConfidence,
        });
      }

      // 5. Perform risk assessment with proper confidence
      const riskAssessment = await this.assessRisk(
        enrichedFeatures,
        compositeScore,
        initialConfidence
      );

      // 6. 🆕 NEW: Calculate Professional Capper Insights
      const professionalInsights = await this.calculateProfessionalInsights(enrichedFeatures);

      // 6.5. 🆕 NEW: Enhanced Capper Analysis (based on capper insights)
      let enhancedCapperAnalysis: EnhancedScoringResult | undefined;
      try {
        if (
          enrichedFeatures.sport &&
          ['MLB', 'NBA', 'NFL', 'NHL'].includes(enrichedFeatures.sport)
        ) {
          enhancedCapperAnalysis = await enhancedScoringEngine.calculateEnhancedScore(
            enrichedFeatures.sport,
            {
              player: {
                id: enrichedFeatures.player || 'unknown',
                name: enrichedFeatures.player || 'unknown',
              },
              opposingPitcher: null, // Will be enhanced when data available
            },
            {
              team: 'unknown', // Will be enhanced when team data available
              venue: 'unknown', // Will be enhanced when venue data available
              weather: { temperature: 75, windSpeed: 0 }, // Default weather
              isTradeDeadline: this.isTradeDeadlineWindow(),
              hasSignificantWeather: false,
              isRevengeGame: false, // Will be enhanced with rivalry data
            },
            { marketData: enrichedFeatures.market }
          );

          // Integrate enhanced professional_score into final professional_score (10% weight)
          if (enhancedCapperAnalysis) {
            const enhancedWeight = 0.1;
            compositeScore.finalScore =
              compositeScore.finalScore * (1 - enhancedWeight) +
              enhancedCapperAnalysis.enhancedScore * enhancedWeight;
          }
        }
      } catch (error) {
        console.warn('Enhanced capper analysis failed:', error);
        // Continue without enhanced analysis
      }

      // 7. Generate scenario analysis
      const scenarioAnalysis = await this.generateScenarioAnalysis(
        enrichedFeatures,
        compositeScore
      );

      // 8. Calculate feature attribution
      const featureContributions = this.calculateFeatureContributions(
        enrichedFeatures,
        compositeScore
      );

      // 9. Determine tier and confidence
      const { tier, confidence } = this.determineTierAndConfidence(
        compositeScore,
        riskAssessment,
        enrichedFeatures
      );

      // 10. Calculate Kelly fraction and position size
      const kellyFraction = this.calculateKellyFraction(
        enrichedFeatures,
        compositeScore,
        riskAssessment
      );
      const rawPositionSize = await this.riskManager.calculatePositionSize(
        kellyFraction,
        riskAssessment.riskScore
      );

      // Ensure tier-based minimum positions are respected
      let positionSize = rawPositionSize;
      if (tier === 'S' && positionSize < 0.05) {
        positionSize = 0.05;
      } else if (tier === 'A' && positionSize < 0.03) {
        positionSize = 0.03;
      } else if (tier === 'B' && positionSize < 0.015) {
        positionSize = 0.015;
      } else if (tier === 'C' && positionSize < 0.005) {
        positionSize = 0.005;
      }

      const result: GradingResult = {
        propId: features.propId,
        finalScore: compositeScore.finalScore,
        confidence,
        tier,
        edgeScore: compositeScore.edgeScore,
        featureContributions,
        modelContributions: mlPredictions.contributions,
        kellyFraction,
        positionSize,
        riskScore: riskAssessment.riskScore,
        correlationRisk: riskAssessment.correlationRisk,
        scenarioAnalysis,
        professionalInsights, // 🆕 NEW: Professional capper insights
        enhancedCapperAnalysis, // 🆕 NEW: Enhanced capper analysis based on capper insights
        deviggingResult, // 🆕 NEW: Devigging results for transparency
        dataQuality: enrichedFeatures.dataQuality.dataValidationScore || 0.95,
        modelAgreement: mlPredictions.agreement,
        historicalAccuracy: await this.getHistoricalAccuracy(features),
        timestamp: new Date().toISOString(),
        modelVersion: this.mlModelManager.getModelVersion(),
        configUsed: this.activeConfig,
      };

      // 9. Log performance for continuous improvement
      await this.logPerformance(features, result, Date.now() - startTime);

      // Debug logging for high-tier props
      if (features.expectedValue > 8 || features.sharpMoney > 75) {
        console.log(`\n🔍 Debug Info for ${features.propId}:`);
        console.log(`   Composite Score: ${compositeScore.finalScore.toFixed(2)}`);
        console.log(`   Score Breakdown:`, compositeScore.breakdown);
        console.log(`   ML Predictions:`, mlPredictions);
        console.log(`   Risk Assessment:`, riskAssessment);
      }

      // Tranche 6: Shadow mode drift logging (compute V2 alongside V1, return V1)
      if (canary.mode === 'shadow') {
        try {
          const v2Shadow = computeScoreV2(features);
          logDrift({
            pickId: features.propId || 'unknown',
            sport: features.sport || 'NBA',
            mode: 'shadow',
            v1Score: result.finalScore,
            v1Tier: result.tier,
            v1Ev: result.edgeScore,
            v2Result: v2Shadow,
          });
          // Tranche 7: Shadow promotion policy evaluation (log only, never promotes in shadow)
          const promoCfg = parsePromotionPolicyConfig();
          if (promoCfg.policyEnabled) {
            const pd = evaluatePromotion(
              v2Shadow,
              features.sport || 'NBA',
              features.propId || 'unknown',
              promoCfg
            );
            // eslint-disable-next-line no-console
            console.log(
              JSON.stringify({ type: 'promotion_decision_shadow', pick_id: features.propId, ...pd })
            );
          }
        } catch (e) {
          console.error('V2 shadow scoring failed:', e);
        }
      }

      // Tranche 9→Unblock-001: v2_primary now handled at top of gradeProp() alongside 'v2'.
      // Previously this block ran V1 first, then overrode with V2 output for drift comparison.
      // Now v2_primary is caught at the top-level canary check and returns V2 directly.

      return result;
    } finally {
      // Clean up temporary sport-specific configuration
      this.scoringConfigs.delete(tempConfigKey);
      this.activeConfig = originalConfig;
    }
  }

  /**
   * Convert new SportSpecificWeights format to legacy ScoringWeights format
   */
  private convertToLegacyWeights(sportWeights: any): ScoringWeights {
    return {
      // Core Components
      expectedValue: sportWeights.expectedValue || 0.2,
      lineMovement: sportWeights.lineMovement || 0.1,
      matchupRating: sportWeights.matchupRating || 0.13,
      playerForm: sportWeights.playerForm || 0.09,
      injuryImpact: sportWeights.injuryImpact || 0.07,
      weatherImpact: sportWeights.weatherImpact || 0.02,

      // Advanced Market Intelligence
      marketIntelligence: sportWeights.marketIntelligence || 0.15,
      sharpMoney: sportWeights.sharpMoney || 0.1,
      volumeProfile: sportWeights.volumeProfile || 0.07,
      closingLineValue: sportWeights.closingLineValue || 0.12,

      // Professional Capper Features
      steamDetection: sportWeights.steamDetection || 0.025,
      closingLinePrediction: sportWeights.closingLinePrediction || 0.02,
      optimalTiming: sportWeights.optimalTiming || 0.015,
      lineShoppingEdge: sportWeights.lineShoppingEdge || 0.015,
      publicVsSharpSplit: sportWeights.publicVsSharpSplit || 0.02,
      marketTimingAdvantage: sportWeights.marketTimingAdvantage || 0.01,
      injuryTimingEdge: sportWeights.injuryTimingEdge || 0.01,
      crossMarketDiscrepancy: sportWeights.crossMarketDiscrepancy || 0.005,

      // Player & Game Context
      playerFatigue: sportWeights.playerFatigue || 0.05,
      venueAdvantage: sportWeights.venueAdvantage || 0.04,
      refereeImpact: sportWeights.refereeImpact || 0.03,
      paceImpact: sportWeights.paceImpact || 0.04,
      motivationalFactors: sportWeights.motivationalFactors || 0.02,

      // Risk & Correlation
      correlationRisk: sportWeights.correlationRisk || 0.09,
      volatility: sportWeights.volatility || 0.07,
      portfolioImpact: sportWeights.portfolioImpact || 0.1,

      // ML Model Ensemble
      neuralNetwork: sportWeights.neuralNetwork || 0.18,
      gradientBoosting: sportWeights.gradientBoosting || 0.22,
      randomForest: sportWeights.randomForest || 0.13,
      ensemble: sportWeights.ensemble || 0.27,
    };
  }

  /**
   * Get ML model predictions with ensemble scoring
   */
  private async getMLPredictions(features: GradingFeatureSet): Promise<{
    neuralNetwork: number;
    gradientBoosting: number;
    randomForest: number;
    ensemble: number;
    contributions: Record<string, number>;
    agreement: number;
  }> {
    const [nn, gb, rf] = await Promise.all([
      this.mlModelManager.scoreWithNeuralNetwork(features),
      this.mlModelManager.scoreWithGradientBoosting(features),
      this.mlModelManager.scoreWithRandomForest(features),
    ]);

    const ensemble = await this.mlModelManager.scoreWithEnsemble(features);

    // Calculate model agreement (how much models agree)
    const scores = [nn.professional_score, gb.professional_score, rf.score];
    const mean = scores.reduce((a, b) => a + b) / scores.length;
    const variance =
      scores.reduce((acc, professional_score) => acc + Math.pow(professional_score - mean, 2), 0) /
      scores.length;
    const agreement = Math.max(0, 1 - variance / 100); // Normalize to 0-1

    return {
      neuralNetwork: nn.professional_score,
      gradientBoosting: gb.professional_score,
      randomForest: rf.professional_score,
      ensemble: ensemble.professional_score,
      contributions: {
        'Neural Network': nn.professional_score * 0.2,
        'Gradient Boosting': gb.professional_score * 0.25,
        'Random Forest': rf.professional_score * 0.15,
        Ensemble: ensemble.professional_score * 0.3,
      },
      agreement,
    };
  }

  /**
   * Calculate composite professional_score with dynamic weight optimization
   */
  private async calculateCompositeScore(
    features: GradingFeatureSet,
    mlPredictions: any
  ): Promise<{ finalScore: number; edgeScore: number; breakdown: Record<string, number> }> {
    const config = this.scoringConfigs.get(this.activeConfig)!;
    const weights = config.weights;

    const breakdown: Record<string, number> = {};
    let compositeScore = 0;

    // Core features (max 35 points) - Increased weight
    const coreScore = this.calculateCoreScore(features, weights);
    const coreContribution = safeMultiply(coreScore, 3.5);
    compositeScore = safeNumber(compositeScore + coreContribution, 0);
    breakdown['Core Features'] = coreContribution;

    // Market intelligence (max 30 points) - Increased weight
    const marketScore = this.calculateMarketIntelligenceScore(features, weights);
    const marketContribution = safeMultiply(marketScore, 3);
    compositeScore = safeNumber(compositeScore + marketContribution, 0);
    breakdown['Market Intelligence'] = marketContribution;

    // Player & game context (max 15 points)
    const contextScore = this.calculateContextScore(features, weights);
    const contextContribution = safeMultiply(contextScore, 1.5);
    compositeScore = safeNumber(compositeScore + contextContribution, 0);
    breakdown['Game Context'] = contextContribution;

    // Risk factors (max 10 points)
    const riskScore = this.calculateRiskScore(features, weights);
    const riskContribution = riskScore;
    compositeScore = safeNumber(compositeScore + riskContribution, 0);
    breakdown['Risk Factors'] = riskContribution;

    // 🆕 NEW: Professional capper features (max 12 points)
    let professionalScore = 0;
    try {
      professionalScore = await this.calculateProfessionalCapperScore(features, weights);
      professionalScore = safeNumber(professionalScore, 0);
    } catch (error) {
      console.warn('Professional capper scoring failed, using default:', error);
      professionalScore = 10; // Safe default
    }
    const professionalContribution = safeMultiply(professionalScore, 1.2);
    compositeScore = safeNumber(compositeScore + professionalContribution, 0);
    breakdown['Professional Features'] = professionalContribution;

    // ML model ensemble (max 10 points) - Reduced weight due to inconsistency
    const mlScore = this.calculateMLScore(mlPredictions, weights);
    const mlContribution = mlScore;
    compositeScore = safeNumber(compositeScore + mlContribution, 0);
    breakdown['ML Models'] = mlContribution;

    // Add bonus for exceptional features
    let bonusScore = 0;
    if (features.expectedValue > 10) {
      bonusScore += 5;
    }
    if (features.sharpMoney > 80) {
      bonusScore += 5;
    }
    if (features.matchupRating > 90) {
      bonusScore += 3;
    }
    if (features.playerForm > 90) {
      bonusScore += 3;
    }
    if (bonusScore > 0) {
      compositeScore = safeNumber(compositeScore + bonusScore, 0);
      breakdown['Excellence Bonus'] = bonusScore;
    }

    // Calculate edge professional_score (expected value above market)
    const edgeScore = Math.max(0, safeNumber(compositeScore, 0) - 50); // Anything above 50 is edge

    const safeFinalScore = safeNumber(compositeScore, 0);
    const clampedFinalScore = Math.max(0, Math.min(100, safeFinalScore));

    // Debug logging to track the issue
    if (isNaN(clampedFinalScore)) {
      console.warn('calculateCompositeScore producing NaN:', {
        compositeScore,
        safeFinalScore,
        clampedFinalScore,
        breakdown,
      });
    }

    return {
      finalScore: clampedFinalScore,
      edgeScore,
      breakdown,
    };
  }

  /**
   * Calculate core scoring components
   */
  private calculateCoreScore(features: GradingFeatureSet, weights: any): number {
    let professional_score = 0;

    // Each component contributes based on its weight
    // Expected Value: 12.5% EV should give high professional_score
    const evValue = safeNumber(features.expectedValue, 0);
    const evScore = Math.min(10, evValue / 1.25);
    professional_score += safeMultiply(evScore, safeWeight(weights, 'expectedValue', 0.3));

    // Line Movement: 3.5 points movement is excellent
    const lineValue = safeNumber(features.lineMovement, 0);
    const lineScore = Math.min(10, Math.abs(lineValue) * 2);
    professional_score += safeMultiply(lineScore, safeWeight(weights, 'lineMovement', 0.2));

    // Matchup Rating: 92/100 is excellent
    const matchupValue = safeNumber(features.matchupRating, 50);
    const matchupScore = matchupValue / 10;
    professional_score += safeMultiply(matchupScore, safeWeight(weights, 'matchupRating', 0.25));

    // Player Form: 95/100 is peak form
    const formValue = safeNumber(features.playerForm, 50);
    const formScore = formValue / 10;
    professional_score += safeMultiply(formScore, safeWeight(weights, 'playerForm', 0.25));

    // Injury Impact: 0 is perfect (no injury)
    const injuryValue = safeNumber(features.injuryImpact, 0);
    const injuryScore = 10 - Math.min(10, injuryValue);
    professional_score += safeMultiply(injuryScore, safeWeight(weights, 'injuryImpact', 0.15));

    // Weather Impact: 0 is perfect (no impact)
    const weatherValue = safeNumber(features.weatherImpact, 0);
    const weatherScore = 10 - Math.min(10, Math.abs(weatherValue));
    professional_score += safeMultiply(weatherScore, safeWeight(weights, 'weatherImpact', 0.1));

    return safeNumber(professional_score, 0);
  }

  /**
   * Calculate market intelligence professional_score
   */
  private calculateMarketIntelligenceScore(features: GradingFeatureSet, weights: any): number {
    let professional_score = 0;

    // Market Intelligence: 0-100 scale to 0-10
    const marketValue = safeNumber(features.marketIntelligence, 50);
    const marketScore = marketValue / 10;
    professional_score += safeMultiply(marketScore, safeWeight(weights, 'marketIntelligence', 0.3));

    // Sharp Money: 0-100 percentage to 0-10
    const sharpValue = safeNumber(features.sharpMoney, 50);
    const sharpScore = sharpValue / 10;
    professional_score += safeMultiply(sharpScore, safeWeight(weights, 'sharpMoney', 0.25));

    // FIX-02 (scoring-system-audit 2026-01-29): playerFatigue removed from market intelligence.
    // It is scored only in calculateContextScore to prevent double-penalization.

    // Volatility: 0-1 scale, lower is better
    const volatilityValue = safeNumber(features.volatility, 5);
    const volatilityScore = Math.max(0, 10 - volatilityValue * 10);
    professional_score += safeMultiply(volatilityScore, safeWeight(weights, 'volatility', 0.2));

    // Portfolio Impact: 0-0.1 scale, lower is better
    const portfolioValue = safeNumber(features.portfolioImpact, 0);
    const portfolioScore = Math.max(0, 10 - portfolioValue * 100);
    professional_score += safeMultiply(portfolioScore, safeWeight(weights, 'portfolioImpact', 0.1));

    // Bonus for high sharp money with good EV
    const evValue = safeNumber(features.expectedValue, 0);
    if (sharpValue >= 75 && evValue >= 8) {
      professional_score += 2; // Bonus points for strong combination
    }

    return safeNumber(professional_score, 0);
  }

  /**
   * Calculate ML model professional_score
   */
  private calculateMLScore(mlPredictions: any, weights: any): number {
    let professional_score = 0;

    // Ensure mlPredictions exists and has required properties
    if (!mlPredictions || typeof mlPredictions !== 'object') {
      return 0;
    }

    // ML predictions are already 0-100, scale to 0-10
    const nnValue = safeNumber(mlPredictions.neuralNetwork, 50);
    professional_score += safeMultiply(nnValue / 10, safeWeight(weights, 'neuralNetwork', 0.25));

    const gbValue = safeNumber(mlPredictions.gradientBoosting, 50);
    professional_score += safeMultiply(gbValue / 10, safeWeight(weights, 'gradientBoosting', 0.25));

    const rfValue = safeNumber(mlPredictions.randomForest, 50);
    professional_score += safeMultiply(rfValue / 10, safeWeight(weights, 'randomForest', 0.25));

    const ensembleValue = safeNumber(mlPredictions.ensemble, 50);
    professional_score += safeMultiply(ensembleValue / 10, safeWeight(weights, 'ensemble', 0.25));

    return safeNumber(professional_score, 0);
  }

  /**
   * Calculate game context professional_score
   */
  private calculateContextScore(features: GradingFeatureSet, weights: any): number {
    let professional_score = 0;

    // Player Fatigue: 0 is good, higher is bad
    const fatigueValue = safeNumber(features.playerFatigue, 0);
    const fatigueScore = Math.max(0, 10 - fatigueValue / 10);
    professional_score += safeMultiply(fatigueScore, safeWeight(weights, 'playerFatigue', 0.2));

    // Venue Advantage: 0-20 scale to 0-10
    const venueValue = safeNumber(features.venueAdvantage, 0);
    const venueScore = Math.min(10, venueValue / 2);
    professional_score += safeMultiply(venueScore, safeWeight(weights, 'venueAdvantage', 0.2));

    // Referee Impact: -10 to +10 scale to 0-10
    const refValue = safeNumber(features.refereeImpact, 0);
    const refScore = Math.max(0, Math.min(10, 5 + refValue / 2));
    professional_score += safeMultiply(refScore, safeWeight(weights, 'refereeImpact', 0.2));

    // Pace Impact: 0-20 scale to 0-10
    const paceValue = safeNumber(features.paceImpact, 0);
    const paceScore = Math.min(10, paceValue / 2);
    professional_score += safeMultiply(paceScore, safeWeight(weights, 'paceImpact', 0.2));

    // Motivational Factors: 0-30 scale to 0-10
    const motivationValue = safeNumber(features.motivationalFactors, 0);
    const motivationScore = Math.min(10, motivationValue / 3);
    professional_score += safeMultiply(
      motivationScore,
      safeWeight(weights, 'motivationalFactors', 0.2)
    );

    return safeNumber(professional_score, 0);
  }

  /**
   * Calculate risk-adjusted professional_score
   */
  private calculateRiskScore(features: GradingFeatureSet, weights: any): number {
    let professional_score = 0;

    // Correlation Risk: 0-1 scale, lower is better
    const correlationValue = safeNumber(features.correlationRisk, 0);
    const correlationScore = Math.max(0, 10 - correlationValue * 10);
    professional_score += safeMultiply(
      correlationScore,
      safeWeight(weights, 'correlationRisk', 0.33)
    );

    // Volatility: 0-10 scale, lower is better
    const volatilityValue = safeNumber(features.volatility, 5);
    const volatilityScore = Math.max(0, 10 - volatilityValue);
    professional_score += safeMultiply(volatilityScore, safeWeight(weights, 'volatility', 0.33));

    // Portfolio Impact: 0-1 scale, lower is better
    const portfolioValue = safeNumber(features.portfolioImpact, 0);
    const portfolioScore = Math.max(0, 10 - portfolioValue * 10);
    professional_score += safeMultiply(
      portfolioScore,
      safeWeight(weights, 'portfolioImpact', 0.34)
    );

    return safeNumber(professional_score, 0);
  }

  /**
   * Assess comprehensive risk for the prop
   */
  private async assessRisk(
    features: GradingFeatureSet,
    _compositeScore: any,
    confidence: number
  ): Promise<{
    riskScore: number;
    correlationRisk: number;
    volatilityRisk: number;
    portfolioRisk: number;
    liquidityRisk: number;
  }> {
    const riskMetrics = await this.riskManager.assessPropRisk({
      propId: features.propId,
      sport: features.sport,
      player: features.player || 'Unknown',
      marketType: features.marketType || features.market.type,
      odds: features.odds ?? features.market.odds,
      expectedValue: features.expectedValue,
      confidence: confidence, // Use proper confidence percentage
    });

    return {
      riskScore: riskMetrics.overallRisk,
      correlationRisk: features.correlationRisk || 0,
      volatilityRisk: features.volatility || 0,
      portfolioRisk: features.portfolioImpact || 0,
      liquidityRisk: features.bidAskSpread ? Math.min(10, features.bidAskSpread * 100) : 1,
    };
  }

  /**
   * Generate scenario analysis for the prop
   */
  private async generateScenarioAnalysis(
    features: GradingFeatureSet,
    compositeScore: any
  ): Promise<{
    bullCase: { score: number; probability: number };
    baseCase: { score: number; probability: number };
    bearCase: { score: number; probability: number };
  }> {
    const baseScore = compositeScore.finalScore;
    const volatility = features.volatility || 5;

    // Calculate scenario scores based on volatility
    const bullCase = Math.min(100, baseScore + volatility * 1.5);
    const bearCase = Math.max(0, baseScore - volatility * 1.5);

    // Calculate probabilities based on model confidence and historical data
    const confidence = safeDivide(safeNumber(compositeScore?.finalScore, 0), 100, 0.5);

    // Debug logging for scenario confidence
    if (isNaN(confidence)) {
      console.warn('Scenario confidence calculation producing NaN:', {
        compositeFinalScore: compositeScore?.finalScore,
        result: confidence,
      });
    }
    const baseProbability = 0.4 + confidence * 0.2; // 40-60% base case probability

    return {
      bullCase: {
        score: bullCase,
        probability: Math.round((1 - baseProbability) * 0.6 * 100) / 100,
      },
      baseCase: {
        score: baseScore,
        probability: Math.round(baseProbability * 100) / 100,
      },
      bearCase: {
        score: bearCase,
        probability: Math.round((1 - baseProbability) * 0.4 * 100) / 100,
      },
    };
  }

  /**
   * Calculate feature contributions using SHAP-like methodology
   */
  private calculateFeatureContributions(
    _features: GradingFeatureSet,
    compositeScore: any
  ): Record<string, number> {
    const contributions: Record<string, number> = {};
    const totalScore = compositeScore.finalScore;

    // Calculate relative contributions of each feature category
    Object.entries(compositeScore.breakdown).forEach(([category, score]) => {
      contributions[category] = safeDivide(score as number, totalScore, 0) * 100;
    });

    return contributions;
  }

  /**
   * Determine tier and confidence based on professional_score and risk.
   * Tranche 2, Stage 1 (2026-01-29): Base tier now delegates to canonicalTier (TierScale.ts).
   */
  private determineTierAndConfidence(
    compositeScore: any,
    riskAssessment: any,
    features?: GradingFeatureSet
  ): {
    tier: Tier;
    confidence: number;
  } {
    const professional_score = compositeScore.finalScore;
    const risk = riskAssessment.riskScore;
    const edge = compositeScore.edgeScore;

    // Calculate confidence as a percentage (0-1)
    // Base confidence from professional_score (normalized to 0-1)
    const baseConfidence = safeDivide(professional_score, 100, 0.5);

    // Risk adjustment (higher risk reduces confidence)
    const riskMultiplier = Math.max(0.5, 1 - risk / 20);

    // Edge bonus (higher edge increases confidence)
    const edgeMultiplier = Math.min(1.2, 1 + safeDivide(edge, 50, 0));

    // Final confidence calculation
    const confidence = Math.min(1, baseConfidence * riskMultiplier * edgeMultiplier);

    // Canonical tier determination — delegates to TierScale.ts (single source of truth)
    let tier: Tier = canonicalTier({ score: professional_score, edge, risk });

    // Override based on exceptional features
    if (compositeScore.breakdown && compositeScore.breakdown['Core Features'] >= 18 && risk <= 5) {
      // High core features with reasonable risk should be at least A tier
      tier = tier === 'D' || tier === 'C' || tier === 'B' ? 'A' : tier;
    }

    // Additional override for high EV + sharp money (only if features provided)
    if (features && features.expectedValue >= 8 && features.sharpMoney >= 75 && risk <= 5) {
      tier = tier === 'D' || tier === 'C' || tier === 'B' ? 'A' : tier;
    }

    // Adjust confidence based on tier
    let tierAdjustedConfidence = confidence;
    if (tier === 'S') {
      tierAdjustedConfidence = Math.max(0.8, confidence); // S-tier minimum 80% confidence
    } else if (tier === 'A') {
      tierAdjustedConfidence = Math.max(0.65, confidence); // A-tier minimum 65% confidence
    } else if (tier === 'B') {
      tierAdjustedConfidence = Math.max(0.5, confidence); // B-tier minimum 50% confidence
    }

    return { tier, confidence: tierAdjustedConfidence };
  }

  /**
   * Calculate Kelly fraction for optimal position sizing
   */
  private calculateKellyFraction(
    features: GradingFeatureSet,
    compositeScore: any,
    riskAssessment: any
  ): number {
    // Use a combination of professional_score and expected value for win probability
    const scoreComponent = safeDivide(compositeScore.finalScore, 100, 0.5);
    const evComponent = Math.min(1, 0.5 + safeDivide(safeNumber(features.expectedValue, 0), 20, 0)); // EV of 10% = 0.75 prob
    const winProbability = scoreComponent * 0.6 + evComponent * 0.4; // Blend both factors

    const odds = features.odds ?? features.market.odds;
    const decimalOdds = odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;

    // Kelly formula: f = (bp - q) / b
    // where b = odds-1, p = win probability, q = lose probability
    const b = decimalOdds - 1;
    const p = winProbability;
    const q = 1 - p;

    const kellyFraction = safeDivide(b * p - q, b, 0);

    // Apply risk adjustment
    const riskAdjustment = Math.max(
      0.5,
      1 - safeDivide(safeNumber(riskAssessment.riskScore, 0), 20, 0)
    ); // More lenient risk adjustment

    // Apply confidence adjustment
    const confidenceAdjustment = Math.max(
      0.5,
      safeDivide(safeNumber(compositeScore?.finalScore, 0), 100, 0.5)
    );

    // Debug logging for Kelly confidence adjustment
    if (isNaN(confidenceAdjustment)) {
      console.warn('Kelly confidence adjustment producing NaN:', {
        compositeFinalScore: compositeScore?.finalScore,
        result: confidenceAdjustment,
      });
    }

    const adjustedKelly = kellyFraction * riskAdjustment * confidenceAdjustment;

    // Tier-based minimum positions
    const tier = this.determineTierAndConfidence(compositeScore, riskAssessment, features).tier;
    let minimumPosition = 0;

    if (tier === 'S') {
      minimumPosition = 0.05;
    } // 5% minimum for S-tier
    else if (tier === 'A') {
      minimumPosition = 0.03;
    } // 3% minimum for A-tier
    else if (tier === 'B') {
      minimumPosition = 0.015;
    } // 1.5% minimum for B-tier
    else if (tier === 'C') {
      minimumPosition = 0.005;
    } // 0.5% minimum for C-tier

    // For high-value props with strong indicators, ensure minimum position
    if (features.expectedValue > 8 && features.sharpMoney > 75) {
      return Math.max(minimumPosition, Math.min(0.25, adjustedKelly));
    }

    return Math.max(minimumPosition, Math.min(0.25, adjustedKelly)); // Cap at 25%
  }

  /**
   * Get historical accuracy for similar props
   */
  private async getHistoricalAccuracy(_features: GradingFeatureSet): Promise<number> {
    const accuracy = await this.performanceAnalyzer.getHistoricalAccuracy();
    return accuracy.overall;
  }

  /**
   * Log performance for continuous improvement
   */
  private async logPerformance(
    _features: GradingFeatureSet,
    result: GradingResult,
    _processingTime: number
  ): Promise<void> {
    await this.performanceAnalyzer.logGradingPerformance(
      result,
      0, // actualOutcome - will be updated when result is known
      0 // actualProfit - will be updated when result is known
    );
  }

  /**
   * Update scoring configuration
   */
  public updateScoringConfig(configName: string, config: ScoringConfig): void {
    this.scoringConfigs.set(configName, config);
  }

  /**
   * Switch active scoring configuration
   */
  public setActiveConfig(configName: string): void {
    if (this.scoringConfigs.has(configName)) {
      this.activeConfig = configName;
    } else {
      throw new Error(`Scoring configuration '${configName}' not found`);
    }
  }

  /**
   * Get available scoring configurations
   */
  public getAvailableConfigs(): string[] {
    return Array.from(this.scoringConfigs.keys());
  }

  /**
   * Get current scoring configuration
   */
  public getCurrentConfig(): ScoringConfig {
    return this.scoringConfigs.get(this.activeConfig)!;
  }

  /**
   * Optimize weights based on historical performance
   */
  public async optimizeWeights(timeframe: string = '30d'): Promise<ScoringWeights> {
    // Enhanced weight optimization based on historical performance
    const performanceData = this.getPerformanceData(timeframe);

    if (performanceData.length === 0) {
      return this.getCurrentConfig().weights;
    }

    // Analyze which features perform best
    const featurePerformance = this.analyzeFeaturePerformance(performanceData);

    // Adjust weights based on performance
    const optimizedWeights = { ...this.getCurrentConfig().weights };

    Object.entries(featurePerformance).forEach(([feature, performance]) => {
      if (optimizedWeights[feature as keyof ScoringWeights]) {
        // Boost weights for high-performing features
        const boost = Math.min(0.5, performance * 0.3);
        optimizedWeights[feature as keyof ScoringWeights] *= 1 + boost;
      }
    });

    // Normalize weights to sum to 1
    const totalWeight = Object.values(optimizedWeights).reduce((sum, weight) => sum + weight, 0);
    Object.keys(optimizedWeights).forEach(key => {
      optimizedWeights[key as keyof ScoringWeights] /= totalWeight;
    });

    return optimizedWeights;
  }

  private getPerformanceData(timeframe: string): number[] {
    return this._performanceHistory.get(timeframe) || [];
  }

  private analyzeFeaturePerformance(performanceData: number[]): Record<string, number> {
    // Analyze which features correlate with better performance
    const featurePerformance: Record<string, number> = {};

    // This is a simplified analysis - in production, you'd analyze actual feature contributions
    const features = [
      'expectedValue',
      'lineMovement',
      'matchupRating',
      'playerForm',
      'marketIntelligence',
    ];

    features.forEach(feature => {
      // Calculate correlation between feature usage and performance
      const correlation = this.calculatePerformanceCorrelation(feature, performanceData);
      featurePerformance[feature] = Math.max(0, correlation);
    });

    return featurePerformance;
  }

  private calculatePerformanceCorrelation(_feature: string, performanceData: number[]): number {
    // FIX-03 (scoring-system-audit 2026-01-29): Return neutral value instead of random.
    // Until real performance data is collected and analyzed, weights should remain stable.
    if (performanceData.length < 10) {
      return 0.5;
    }
    return 0.5; // Neutral — no weight adjustment until real correlation data available
  }

  private initializePerformanceTracking(): void {
    // Initialize performance tracking for different timeframes
    const timeframes = ['7d', '30d', '90d', '180d'];
    timeframes.forEach(timeframe => {
      this._performanceHistory.set(timeframe, []);
    });
  }

  /**
   * Batch grade multiple props efficiently
   */
  public async gradeProps(propsList: GradingFeatureSet[]): Promise<GradingResult[]> {
    const results = await Promise.all(propsList.map(features => this.gradeProp(features)));

    // Apply portfolio-level risk adjustments
    return await this.riskManager.adjustPortfolioRisk(results);
  }

  // ========================================
  // 🆕 NEW: 8 PROFESSIONAL CAPPER FEATURES
  // ========================================

  /**
   * Calculate all professional capper insights
   */
  private async calculateProfessionalInsights(
    features: GradingFeatureSet
  ): Promise<GradingResult['professionalInsights']> {
    const propId = features.propId;

    // 1. Steam Move Detection
    const steamAnalysis = await this.detectSteamMove(propId);

    // 2. Closing Line Prediction
    const predictedClosingLine = await this.predictClosingLine(propId, features);

    // 3. Optimal Betting Time
    const optimalBettingTime = this.calculateOptimalBettingTime(features);

    // 4. Line Shopping
    const lineShoppingResult = await this.findBestAvailableLine(propId);

    // 5. Public vs Sharp Split
    const bettingPercentages = await this.getBettingPercentages(propId);

    // 6. Injury Timing Advantage
    const injuryTimingAdvantage = this.calculateInjuryTimingAdvantage(features);

    // 7. Cross Market Arbitrage
    const crossMarketArbitrage = await this.calculateCrossMarketArbitrage(propId);

    return {
      steamMoveDetected: steamAnalysis.detected,
      predictedClosingLine,
      optimalBettingTime,
      bestAvailableLine: lineShoppingResult.line,
      bestBook: lineShoppingResult.book,
      publicBettingPercentage: bettingPercentages.public,
      sharpBettingPercentage: bettingPercentages.sharp,
      contrarianOpportunity: bettingPercentages.public > 70 && bettingPercentages.sharp < 40,
      injuryTimingAdvantage,
      crossMarketArbitrage,
    };
  }

  /**
   * Calculate professional capper professional_score contribution
   */
  private async calculateProfessionalCapperScore(
    features: GradingFeatureSet,
    weights: ScoringWeights
  ): Promise<number> {
    let professional_score = 0;
    const propId = features.propId;

    try {
      // 1. Steam Detection Score (0-10) - Safe with fallback
      try {
        const steamAnalysis = await this.detectSteamMove(propId);
        const steamScore = steamAnalysis.detected ? 8 : 2;
        professional_score += safeMultiply(
          steamScore,
          safeWeight(weights, 'steamDetection', 0.025)
        );
      } catch (error) {
        professional_score += safeMultiply(2, safeWeight(weights, 'steamDetection', 0.025)); // Default fallback
      }

      // 2. Closing Line Prediction Score (0-10) - Safe with fallback
      try {
        const closingLinePrediction = await this.predictClosingLine(propId, features);
        const currentLine = safeNumber(features.market?.line, 0);
        const lineValueScore = Math.min(10, Math.abs(closingLinePrediction - currentLine) * 2);
        professional_score += safeMultiply(
          lineValueScore,
          safeWeight(weights, 'closingLinePrediction', 0.02)
        );
      } catch (error) {
        professional_score += safeMultiply(5, safeWeight(weights, 'closingLinePrediction', 0.02)); // Default fallback
      }

      // 3. Optimal Timing Score (0-10) - Safe with fallback
      try {
        const optimalTiming = this.calculateOptimalBettingTime(features);
        const timingScore =
          optimalTiming === 'immediate'
            ? 10
            : optimalTiming === 'monitor'
              ? 6
              : optimalTiming === 'final_check'
                ? 4
                : 1;
        professional_score += safeMultiply(
          timingScore,
          safeWeight(weights, 'optimalTiming', 0.015)
        );
      } catch (error) {
        professional_score += safeMultiply(5, safeWeight(weights, 'optimalTiming', 0.015)); // Default fallback
      }

      // 4. Line Shopping Edge Score (0-10) - Safe with fallback
      try {
        const lineShoppingResult = await this.findBestAvailableLine(propId);
        const currentOdds = safeNumber(features.market?.odds, -110);
        const lineShoppingEdgeScore = Math.min(
          10,
          Math.abs(lineShoppingResult.line - currentOdds) / 5
        );
        professional_score += safeMultiply(
          lineShoppingEdgeScore,
          safeWeight(weights, 'lineShoppingEdge', 0.015)
        );
      } catch (error) {
        professional_score += safeMultiply(3, safeWeight(weights, 'lineShoppingEdge', 0.015)); // Default fallback
      }

      // 5. Public vs Sharp Split Score (0-10) - Safe with fallback
      try {
        const bettingPercentages = await this.getBettingPercentages(propId);
        const contrarianScore =
          bettingPercentages.public > 70 ? 8 : bettingPercentages.public < 30 ? 3 : 5;
        professional_score += safeMultiply(
          contrarianScore,
          safeWeight(weights, 'publicVsSharpSplit', 0.02)
        );
      } catch (error) {
        professional_score += safeMultiply(5, safeWeight(weights, 'publicVsSharpSplit', 0.02)); // Default fallback
      }

      // 6. Market Timing Advantage (0-10) - Safe with fallback
      try {
        const hoursToGame = this.calculateHoursToGame(features);
        const marketTimingScore =
          hoursToGame > 24 ? 9 : hoursToGame > 8 ? 6 : hoursToGame > 2 ? 3 : 1;
        professional_score += safeMultiply(
          marketTimingScore,
          safeWeight(weights, 'marketTimingAdvantage', 0.01)
        );
      } catch (error) {
        professional_score += safeMultiply(5, safeWeight(weights, 'marketTimingAdvantage', 0.01)); // Default fallback
      }

      // 7. Injury Timing Edge (0-10) - Safe with fallback
      try {
        const injuryTimingScore = this.calculateInjuryTimingAdvantage(features);
        professional_score += safeMultiply(
          injuryTimingScore,
          safeWeight(weights, 'injuryTimingEdge', 0.01)
        );
      } catch (error) {
        professional_score += safeMultiply(2, safeWeight(weights, 'injuryTimingEdge', 0.01)); // Default fallback
      }

      // 8. Cross Market Discrepancy (0-10) - Safe with fallback
      try {
        const crossMarketScore = await this.calculateCrossMarketArbitrage(propId);
        professional_score += safeMultiply(
          crossMarketScore,
          safeWeight(weights, 'crossMarketDiscrepancy', 0.005)
        );
      } catch (error) {
        professional_score += safeMultiply(2, safeWeight(weights, 'crossMarketDiscrepancy', 0.005)); // Default fallback
      }
    } catch (error) {
      console.warn('Professional capper scoring failed, using fallback:', error);
      // Fallback to a reasonable default professional_score
      professional_score = 10; // Default professional professional_score
    }

    return safeNumber(professional_score, 0);
  }

  /**
   * 1. Real-time Steam Move Detection
   */
  private async detectSteamMove(
    propId: string
  ): Promise<{ detected: boolean; confidence: number }> {
    const lineHistory = this.lineMovementHistory.get(propId) || [];

    if (lineHistory.length < 3) {
      return { detected: false, confidence: 0 };
    }

    // Steam move criteria:
    // 1. Significant line movement (>1.5 points in short time)
    // 2. High volume spike (>150% of average)
    // 3. Movement velocity (rapid changes)

    const recent = lineHistory.slice(-3);
    const lineMovement = Math.abs(recent[2].line - recent[0].line);
    const isSignificantMovement = lineMovement >= 1.5;

    // Check volume spike if available
    let volumeSpike = false;
    const recentVolumes = recent.map(h => h.volume || 0).filter(v => v > 0);
    if (recentVolumes.length >= 2) {
      const currentVolume = recentVolumes[recentVolumes.length - 1];
      const avgVolume =
        recentVolumes.slice(0, -1).reduce((a, b) => a + b, 0) / (recentVolumes.length - 1);
      volumeSpike = currentVolume > avgVolume * 1.5;
    }

    // Check velocity (time between moves)
    const timeSpan = recent[2].timestamp - recent[0].timestamp;
    const isFastMovement = timeSpan < 300000; // Less than 5 minutes

    const confidence =
      (isSignificantMovement ? 0.5 : 0) + (volumeSpike ? 0.3 : 0) + (isFastMovement ? 0.2 : 0);

    return {
      detected: confidence >= 0.6,
      confidence: Math.min(confidence, 1.0),
    };
  }

  /**
   * 2. Closing Line Prediction
   */
  private async predictClosingLine(propId: string, features: GradingFeatureSet): Promise<number> {
    const currentLine = features.market?.line || 0;
    const lineHistory = this.lineMovementHistory.get(propId) || [];

    if (lineHistory.length < 2) {
      return currentLine; // Not enough data
    }

    // Calculate movement trend
    const recentMovement = lineHistory.slice(-5); // Last 5 data points
    const trend = this.calculateLineTrend(recentMovement);

    // Time decay - lines typically move more early, stabilize closer to game
    const hoursToGame = this.calculateHoursToGame(features);
    const timeFactor = Math.max(0.1, hoursToGame / 24); // Stronger movements early

    // Volume-weighted prediction
    const volumeData = recentMovement.map(h => h.volume || 0);
    const avgVolume = volumeData.reduce((a, b) => a + b, 0) / volumeData.length;
    const currentVolume = volumeData[volumeData.length - 1] || avgVolume;

    let predictionAdjustment = 0;
    if (currentVolume > avgVolume * 1.5) {
      // High volume suggests continued movement
      predictionAdjustment = trend * 0.5;
    }

    return currentLine + predictionAdjustment * timeFactor;
  }

  /**
   * 3. Optimal Betting Time Calculation
   */
  private calculateOptimalBettingTime(features: GradingFeatureSet): string {
    const hoursToGame = this.calculateHoursToGame(features);
    const hasBreakingNews = features.injuryImpact > 5 || features.weatherImpact > 3;

    // Professional timing strategy:
    if (hasBreakingNews && hoursToGame < 4) {
      return 'immediate'; // Act on breaking news quickly
    } else if (hoursToGame > 24) {
      return 'immediate'; // Lock in early value before market correction
    } else if (hoursToGame > 8) {
      return 'monitor'; // Watch for late information
    } else if (hoursToGame > 2) {
      return 'final_check'; // Last chance for value
    } else {
      return 'avoid'; // Too close to game, lines are efficient
    }
  }

  /**
   * 4. Multi-book Line Shopping
   */
  private async findBestAvailableLine(propId: string): Promise<{ line: number; book: string }> {
    const bookData = this.bookLines.get(propId) || [];

    if (bookData.length === 0) {
      // FIX-04 (scoring-system-audit 2026-01-29): Return deterministic default instead of random.
      // Until real multi-book data is connected, report neutral/unknown values.
      return {
        line: -110, // Standard market line default
        book: 'Unknown',
      };
    }

    // Find best available line (most favorable odds)
    const bestLine = bookData.reduce((best, current) => {
      return Math.abs(current.odds) < Math.abs(best.odds) ? current : best;
    });

    return {
      line: bestLine.odds,
      book: bestLine.book,
    };
  }

  /**
   * 5. Public vs Sharp Betting Percentages
   */
  private async getBettingPercentages(propId: string): Promise<{ public: number; sharp: number }> {
    const cached = this.bettingPercentages.get(propId);

    if (cached && Date.now() - cached.timestamp < 300000) {
      // 5 minute cache
      return { public: cached.public, sharp: cached.sharp };
    }

    // FIX-04 (scoring-system-audit 2026-01-29): Return deterministic neutral split instead of random.
    // Until real betting percentage data is connected, assume neutral 50/50 split.
    const publicPercentage = 50;
    const sharpPercentage = 50;

    // Cache the result
    this.bettingPercentages.set(propId, {
      public: publicPercentage,
      sharp: sharpPercentage,
      timestamp: Date.now(),
    });

    return { public: publicPercentage, sharp: sharpPercentage };
  }

  /**
   * 6. Market Timing Advantage (already calculated in optimal timing)
   */
  private calculateMarketTimingAdvantage(features: GradingFeatureSet): number {
    const hoursToGame = this.calculateHoursToGame(features);

    // Professional timing: early for value, late only for breaking news
    if (hoursToGame > 24) {
      return 0.9; // Best time for value
    } else if (hoursToGame > 8) {
      return 0.6; // Good timing
    } else if (hoursToGame > 2) {
      return 0.3; // Okay timing
    } else {
      return 0.1; // Poor timing unless breaking news
    }
  }

  /**
   * 7. Injury Timing Edge
   */
  private calculateInjuryTimingAdvantage(features: GradingFeatureSet): number {
    const hasRecentInjuryNews = features.injuryImpact > 3;
    const hoursToGame = this.calculateHoursToGame(features);

    if (!hasRecentInjuryNews) return 2; // Base professional_score

    // Recent injury news creates value before lines adjust
    if (hoursToGame > 12) {
      return 8; // Early injury news advantage
    } else if (hoursToGame > 4) {
      return 6; // Some advantage
    } else {
      return 3; // Lines likely adjusted
    }
  }

  /**
   * 8. Cross Market Discrepancy Detection
   */
  private async calculateCrossMarketArbitrage(propId: string): Promise<number> {
    const relatedProps = this.crossMarketData.get(propId) || [];

    if (relatedProps.length === 0) return 2; // Base professional_score

    // Look for discrepancies in related markets
    // E.g., player points vs team total, rebounds vs double-double
    let maxDiscrepancy = 0;

    for (const related of relatedProps) {
      if (related.correlation > 0.7) {
        // Highly correlated markets
        // FIX-04 (scoring-system-audit 2026-01-29): Return 0 discrepancy instead of random.
        // Until real cross-market comparison data is available, report no discrepancy.
        const discrepancy = 0;
        maxDiscrepancy = Math.max(maxDiscrepancy, discrepancy);
      }
    }

    return Math.min(10, 2 + maxDiscrepancy);
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  private calculateHoursToGame(features: GradingFeatureSet): number {
    try {
      // Try multiple possible date fields
      const gameDate = features.game_date || features.gameDate || features.timestamp;
      if (!gameDate) return 12; // Default to 12 hours if no date

      const gameTime = new Date(gameDate);
      const now = new Date();

      // Validate dates
      if (isNaN(gameTime.getTime()) || isNaN(now.getTime())) {
        return 12; // Default if invalid dates
      }

      return Math.max(0, (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60));
    } catch (error) {
      console.warn('calculateHoursToGame failed:', error);
      return 12; // Safe default
    }
  }

  private calculateLineTrend(lineHistory: Array<{ timestamp: number; line: number }>): number {
    if (lineHistory.length < 2) return 0;

    // Simple linear trend calculation
    const first = lineHistory[0];
    const last = lineHistory[lineHistory.length - 1];
    const timeSpan = last.timestamp - first.timestamp;
    const lineChange = last.line - first.line;

    return timeSpan > 0 ? lineChange / (timeSpan / 3600000) : 0; // Change per hour
  }

  /**
   * Update line movement data (called by external data feeds)
   */
  public updateLineMovement(propId: string, line: number, volume?: number): void {
    const history = this.lineMovementHistory.get(propId) || [];
    history.push({ timestamp: Date.now(), line, volume });

    // Keep only last 24 hours of data
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = history.filter(h => h.timestamp > cutoff);

    this.lineMovementHistory.set(propId, filtered);
  }

  /**
   * Update betting percentages (called by external data feeds)
   */
  public updateBettingPercentages(
    propId: string,
    publicPercentage: number,
    sharpPercentage: number
  ): void {
    this.bettingPercentages.set(propId, {
      public: publicPercentage,
      sharp: sharpPercentage,
      timestamp: Date.now(),
    });
  }

  /**
   * Update multi-book lines (called by external data feeds)
   */
  public updateBookLines(propId: string, book: string, line: number, odds: number): void {
    const bookData = this.bookLines.get(propId) || [];

    // Remove old entry for this book if exists
    const filtered = bookData.filter(b => b.book !== book);

    // Add new entry
    filtered.push({ book, line, odds, timestamp: Date.now() });

    this.bookLines.set(propId, filtered);
  }

  /**
   * Add injury news timing (called by news feeds)
   */
  public addInjuryNews(propId: string, severity: number, newsBreakTimestamp: number): void {
    const injuryData = this.injuryNews.get(propId) || [];
    injuryData.push({ timestamp: Date.now(), severity, newsBreak: newsBreakTimestamp });
    this.injuryNews.set(propId, injuryData);
  }

  /**
   * Add cross-market relationship (called during prop setup)
   */
  public addCrossMarketRelationship(
    propId: string,
    relatedPropId: string,
    correlation: number
  ): void {
    const crossData = this.crossMarketData.get(propId) || [];
    crossData.push({ relatedPropId, correlation });
    this.crossMarketData.set(propId, crossData);
  }

  // 🆕 NEW: Enhanced Capper Analysis Helper Methods
  /**
   * Check if current time is within trade deadline window
   */
  private isTradeDeadlineWindow(): boolean {
    const now = new Date();
    const currentYear = now.getFullYear();

    // MLB trade deadline is typically July 31st
    const mlbDeadline = new Date(currentYear, 6, 31); // July = month 6
    const daysBefore = 3;
    const daysAfter = 7;

    const timeDiff = Math.abs(now.getTime() - mlbDeadline.getTime());
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Check if within window
    if (now < mlbDeadline) {
      return daysDiff <= daysBefore;
    } else {
      return daysDiff <= daysAfter;
    }
  }

  /**
   * Check if weather has significant impact on game
   */
  private hasSignificantWeather(weather: any): boolean {
    if (!weather) return false;

    // Significant weather conditions that affect props
    const hasStrongWind = weather.windSpeed && weather.windSpeed > 15; // mph
    const hasExtremeTemp =
      weather.temperature && (weather.temperature < 50 || weather.temperature > 90);
    const hasPrecipitation = weather.precipitation && weather.precipitation > 0.1;

    return hasStrongWind || hasExtremeTemp || hasPrecipitation;
  }

  /**
   * Check if this is a revenge game or rivalry matchup
   */
  private isRevengeGame(features: GradingFeatureSet): boolean {
    // This would need historical data to determine revenge games
    // For now, return false - this should be enhanced with actual rivalry data
    // Future enhancement: Access team data from game context or database

    // Known rivalries could be hardcoded or fetched from database
    // This is a placeholder for future enhancement when team data is available

    return false; // Will be enhanced when team/opponent data is accessible
  }

  // ========================================
  // 🆕 NEW: PROFESSIONAL DEVIGGING & CLV INTEGRATION
  // ========================================

  /**
   * Devig odds - THE most critical method for sharp betting
   * No professional system works with raw, juiced lines
   */
  private async devigOdds(features: GradingFeatureSet): Promise<{
    originalEdge: number;
    deviggedEdge: number;
    totalVig: number;
    fairOdds: number;
    trueValue: boolean;
  }> {
    const marketOdds = features.odds ?? features.market.odds;
    const modelProbability = this.calculateModelProbability(features);

    // Calculate original edge (with vig)
    const originalEdge = features.expectedValue || 0;

    // Devig the market odds
    // For now, assume two-way market - enhance later for multi-way
    const oppositeOdds = this.calculateOppositeOdds(marketOdds, modelProbability);

    const edgeResult = deviggingService.calculateEdge(
      modelProbability,
      marketOdds,
      true // Include Kelly multiplier
    );

    return {
      originalEdge,
      deviggedEdge: edgeResult.edge,
      totalVig: this.estimateVig(marketOdds, oppositeOdds),
      fairOdds: this.probToAmericanOdds(
        edgeResult.edge > 0 ? modelProbability : 1 - modelProbability
      ),
      trueValue: edgeResult.hasValue,
    };
  }

  /**
   * Start CLV tracking for this pick
   */
  private async startCLVTracking(features: GradingFeatureSet): Promise<void> {
    try {
      await clvTrackingService.trackPick({
        propId: features.propId,
        sport: features.sport,
        market: features.market?.type || 'player_props',
        book: features.book || 'DraftKings',
        betLine: features.market?.line || 0,
        betOdds: features.odds ?? features.market.odds,
        modelEdge: features.expectedValue || 0,
        gameTime: new Date(features.game_date || Date.now() + 24 * 60 * 60 * 1000), // Default to 24h from now
      });
    } catch (error) {
      console.warn('CLV tracking failed for', features.propId, error);
      // Don't fail the whole grading if CLV tracking fails
    }
  }

  /**
   * Calculate model probability from features
   */
  private calculateModelProbability(features: GradingFeatureSet): number {
    // Use a combination of expected value and other indicators
    const baseProb = 0.5; // 50% baseline

    // Adjust based on expected value
    const evAdjustment = (features.expectedValue || 0) * 0.01; // 10% EV = +0.1 prob

    // Adjust based on sharp money
    const sharpAdjustment = ((features.sharpMoney || 50) - 50) * 0.002; // 75% sharp = +0.05 prob

    // Clamp to reasonable bounds
    const probability = Math.max(0.1, Math.min(0.9, baseProb + evAdjustment + sharpAdjustment));

    return probability;
  }

  /**
   * Calculate opposite odds for devigging
   */
  private calculateOppositeOdds(primaryOdds: number, modelProb: number): number {
    const oppositeProb = 1 - modelProb;
    return this.probToAmericanOdds(oppositeProb);
  }

  /**
   * Convert probability to American odds
   */
  private probToAmericanOdds(probability: number): number {
    if (probability >= 0.5) {
      return -Math.round((probability * 100) / (1 - probability));
    } else {
      return Math.round((100 - probability * 100) / probability);
    }
  }

  /**
   * Estimate vig from two odds
   */
  private estimateVig(odds1: number, odds2: number): number {
    const prob1 = odds1 > 0 ? 100 / (odds1 + 100) : Math.abs(odds1) / (Math.abs(odds1) + 100);
    const prob2 = odds2 > 0 ? 100 / (odds2 + 100) : Math.abs(odds2) / (Math.abs(odds2) + 100);

    const totalImplied = prob1 + prob2;
    const vig = totalImplied - 1;

    return vig * 100; // Return as percentage
  }

  /**
   * Apply dynamic sportsbook weights based on performance
   */
  private async applyBookWeights(features: GradingFeatureSet, baseEdge: number): Promise<number> {
    const book = features.book || 'DraftKings';

    // This would fetch from database in production
    // For now, use some example adjustments
    const bookMultipliers: Record<string, number> = {
      DraftKings: 1.0,
      FanDuel: 1.05, // Slightly better lines historically
      BetMGM: 0.95, // Slightly worse lines
      Caesars: 0.9,
      PointsBet: 1.1, // Often has better player props
    };

    const multiplier = bookMultipliers[book] || 1.0;
    return baseEdge * multiplier;
  }

  /**
   * Apply market-specific confidence adjustments
   */
  private async applyMarketConfidence(
    features: GradingFeatureSet,
    baseConfidence: number
  ): Promise<number> {
    const sport = features.sport;
    const market = features.market?.type || 'player_props';

    // This would fetch from database in production
    // For now, use some example adjustments
    const marketMultipliers: Record<string, Record<string, number>> = {
      MLB: {
        player_props: 1.1,
        totals: 1.05,
        spreads: 1.0,
        moneyline: 0.95,
      },
      NBA: {
        player_props: 1.15,
        totals: 1.1,
        spreads: 1.0,
        moneyline: 0.9,
      },
      NFL: {
        player_props: 1.2,
        totals: 1.1,
        spreads: 1.05,
        moneyline: 1.0,
      },
    };

    const multiplier = marketMultipliers[sport]?.[market] || 1.0;
    return Math.min(1.0, baseConfidence * multiplier);
  }

  /**
   * Trigger feedback loop (should be called periodically)
   */
  public async triggerFeedbackLoop(): Promise<void> {
    try {
      // Dynamically import to avoid circular dependency
      const { feedbackLoopService } = await import(
        '../../../services/feedback/FeedbackLoopService'
      );
      await feedbackLoopService.runFeedbackLoop();
    } catch (error) {
      console.error('Feedback loop failed:', error);
    }
  }
}
