import { GradingFeatureSet } from '../../../types/GradingFeatureSet';


import { MLModelManager } from './mlModelManager';
import { FeatureEngineer } from './featureEngineer';
import { RiskManager } from './riskManager';
import { PerformanceAnalyzer } from './performanceAnalyzer';

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
export class SyndicateGradingEngine {
  private mlModelManager: MLModelManager;
  private featureEngineer: FeatureEngineer;
  private riskManager: RiskManager;
  private performanceAnalyzer: PerformanceAnalyzer;
  
  private scoringConfigs: Map<string, ScoringConfig> = new Map();
  private activeConfig: string = 'default';
  private _performanceHistory: Map<string, number[]> = new Map();
  
  constructor() {
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
      maxCVaR: 0.08
    });
    this.performanceAnalyzer = new PerformanceAnalyzer();

    this.initializeDefaultConfigs();
  }

  /**
   * Initialize Fortune 100 level scoring configurations
   */
  private initializeDefaultConfigs(): void {
    // Default Fortune 100 Configuration
    const defaultConfig: ScoringConfig = {
      name: 'Fortune 100 Default',
      version: '2025.07.08',
      weights: {
        expectedValue: 0.25,
        lineMovement: 0.12,
        matchupRating: 0.15,
        playerForm: 0.10,
        injuryImpact: 0.08,
        weatherImpact: 0.03,
        marketIntelligence: 0.18,
        sharpMoney: 0.12,
        volumeProfile: 0.08,
        closingLineValue: 0.15,
        playerFatigue: 0.06,
        venueAdvantage: 0.05,
        refereeImpact: 0.04,
        paceImpact: 0.05,
        motivationalFactors: 0.03,
        correlationRisk: 0.10,
        volatility: 0.08,
        portfolioImpact: 0.12,
        neuralNetwork: 0.20,
        gradientBoosting: 0.25,
        randomForest: 0.15,
        ensemble: 0.30
      },
      enabled: true,
      minConfidence: 75,
      maxRisk: 0.25,
      description: 'Fortune 100 syndicate-level scoring with advanced ML ensemble'
    };

    // Sport-Specific Configurations
    const nbaConfig: ScoringConfig = {
      ...defaultConfig,
      name: 'NBA Specialized',
      sport: 'NBA',
      weights: {
        ...defaultConfig.weights,
        playerFatigue: 0.12,  // Higher weight for NBA fatigue
        paceImpact: 0.10,     // NBA pace is crucial
        refereeImpact: 0.08   // NBA refs have significant impact
      }
    };

    const nflConfig: ScoringConfig = {
      ...defaultConfig,
      name: 'NFL Specialized',
      sport: 'NFL',
      weights: {
        ...defaultConfig.weights,
        weatherImpact: 0.08,  // Weather crucial for NFL
        injuryImpact: 0.15,   // Injuries more impactful in NFL
        motivationalFactors: 0.08 // Playoff implications matter more
      }
    };

    this.scoringConfigs.set('default', defaultConfig);
    this.scoringConfigs.set('nba', nbaConfig);
    this.scoringConfigs.set('nfl', nflConfig);
  }

  /**
   * Grade a single prop with Fortune 100 level analysis
   */
  async gradeProp(features: GradingFeatureSet): Promise<GradingResult> {
    const startTime = Date.now();
    
    // 1. Enrich features with advanced analytics
    const enrichedFeatures = await this.featureEngineer.enrichFeatures(features);
    
    // 2. Get ML model predictions
    const mlPredictions = await this.getMLPredictions(enrichedFeatures);
    
    // 3. Calculate composite score with dynamic weights
    const compositeScore = await this.calculateCompositeScore(enrichedFeatures, mlPredictions);

    // 4. Calculate initial confidence based on score and ML agreement
    const initialConfidence = Math.min(100, compositeScore.finalScore * mlPredictions.agreement);

    // 5. Perform risk assessment with proper confidence
    const riskAssessment = await this.assessRisk(enrichedFeatures, compositeScore, initialConfidence);

    // 6. Generate scenario analysis
    const scenarioAnalysis = await this.generateScenarioAnalysis(enrichedFeatures, compositeScore);

    // 7. Calculate feature attribution
    const featureContributions = this.calculateFeatureContributions(enrichedFeatures, compositeScore);

    // 8. Determine tier and confidence
    const { tier, confidence} = this.determineTierAndConfidence(compositeScore, riskAssessment, enrichedFeatures);

    // 9. Calculate Kelly fraction and position size
    const kellyFraction = this.calculateKellyFraction(enrichedFeatures, compositeScore, riskAssessment);
    const rawPositionSize = await this.riskManager.calculatePositionSize(kellyFraction, riskAssessment.riskScore);

    // Ensure tier-based minimum positions are respected
    let positionSize = rawPositionSize;
    if (tier === 'S' && positionSize < 0.05) positionSize = 0.05;
    else if (tier === 'A' && positionSize < 0.03) positionSize = 0.03;
    else if (tier === 'B' && positionSize < 0.015) positionSize = 0.015;
    else if (tier === 'C' && positionSize < 0.005) positionSize = 0.005;

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
      dataQuality: enrichedFeatures.dataValidationScore || 0.95,
      modelAgreement: mlPredictions.agreement,
      historicalAccuracy: await this.getHistoricalAccuracy(features),
      timestamp: new Date().toISOString(),
      modelVersion: this.mlModelManager.getModelVersion(),
      configUsed: this.activeConfig
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

    return result;
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
      this.mlModelManager.scoreWithRandomForest(features)
    ]);

    const ensemble = await this.mlModelManager.scoreWithEnsemble(features);
    
    // Calculate model agreement (how much models agree)
    const scores = [nn.score, gb.score, rf.score];
    const mean = scores.reduce((a, b) => a + b) / scores.length;
    const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
    const agreement = Math.max(0, 1 - (variance / 100)); // Normalize to 0-1

    return {
      neuralNetwork: nn.score,
      gradientBoosting: gb.score,
      randomForest: rf.score,
      ensemble: ensemble.score,
      contributions: {
        'Neural Network': nn.score * 0.2,
        'Gradient Boosting': gb.score * 0.25,
        'Random Forest': rf.score * 0.15,
        'Ensemble': ensemble.score * 0.3
      },
      agreement
    };
  }

  /**
   * Calculate composite score with dynamic weight optimization
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
    const coreContribution = coreScore * 3.5;
    compositeScore += coreContribution;
    breakdown['Core Features'] = coreContribution;

    // Market intelligence (max 30 points) - Increased weight
    const marketScore = this.calculateMarketIntelligenceScore(features, weights);
    const marketContribution = marketScore * 3;
    compositeScore += marketContribution;
    breakdown['Market Intelligence'] = marketContribution;

    // Player & game context (max 15 points)
    const contextScore = this.calculateContextScore(features, weights);
    const contextContribution = contextScore * 1.5;
    compositeScore += contextContribution;
    breakdown['Game Context'] = contextContribution;

    // Risk factors (max 10 points)
    const riskScore = this.calculateRiskScore(features, weights);
    const riskContribution = riskScore;
    compositeScore += riskContribution;
    breakdown['Risk Factors'] = riskContribution;

    // ML model ensemble (max 10 points) - Reduced weight due to inconsistency
    const mlScore = this.calculateMLScore(mlPredictions, weights);
    const mlContribution = mlScore;
    compositeScore += mlContribution;
    breakdown['ML Models'] = mlContribution;

    // Add bonus for exceptional features
    let bonusScore = 0;
    if (features.expectedValue > 10) bonusScore += 5;
    if (features.sharpMoney > 80) bonusScore += 5;
    if (features.matchupRating > 90) bonusScore += 3;
    if (features.playerForm > 90) bonusScore += 3;
    if (bonusScore > 0) {
      compositeScore += bonusScore;
      breakdown['Excellence Bonus'] = bonusScore;
    }

    // Calculate edge score (expected value above market)
    const edgeScore = Math.max(0, compositeScore - 50); // Anything above 50 is edge

    return {
      finalScore: Math.max(0, Math.min(100, compositeScore)),
      edgeScore,
      breakdown
    };
  }

  /**
   * Calculate core scoring components
   */
  private calculateCoreScore(features: GradingFeatureSet, weights: any): number {
    let score = 0;

    // Each component contributes based on its weight
    // Expected Value: 12.5% EV should give high score
    const evScore = Math.min(10, (features.expectedValue || 0) / 1.25);
    score += evScore * weights.expectedValue;

    // Line Movement: 3.5 points movement is excellent
    const lineScore = Math.min(10, Math.abs(features.lineMovement || 0) * 2);
    score += lineScore * weights.lineMovement;

    // Matchup Rating: 92/100 is excellent
    const matchupScore = (features.matchupRating || 50) / 10;
    score += matchupScore * weights.matchupRating;

    // Player Form: 95/100 is peak form
    const formScore = (features.playerForm || 50) / 10;
    score += formScore * weights.playerForm;

    // Injury Impact: 0 is perfect (no injury)
    const injuryScore = 10 - Math.min(10, (features.injuryImpact || 0));
    score += injuryScore * weights.injuryImpact;

    // Weather Impact: 0 is perfect (no impact)
    const weatherScore = 10 - Math.min(10, Math.abs(features.weatherImpact || 0));
    score += weatherScore * weights.weatherImpact;

    return score;
  }

  /**
   * Calculate market intelligence score
   */
  private calculateMarketIntelligenceScore(features: GradingFeatureSet, weights: any): number {
    let score = 0;

    // Market Intelligence: 0-100 scale to 0-10
    const marketScore = (features.marketIntelligence || 50) / 10;
    score += marketScore * weights.marketIntelligence;

    // Sharp Money: 0-100 percentage to 0-10
    const sharpScore = (features.sharpMoney || 50) / 10;
    score += sharpScore * weights.sharpMoney;

    // Player Fatigue: 0 is good, higher is bad - use playerFatigue field
    const fatigueScore = Math.max(0, 10 - (features.playerFatigue || 0) / 10);
    score += fatigueScore * weights.playerFatigue;

    // Venue Advantage: 0-20 scale to 0-10

    // Volatility: 0-1 scale, lower is better
    const volatilityScore = Math.max(0, 10 - (features.volatility || 0) * 10);
    score += volatilityScore * weights.volatility;

    // Portfolio Impact: 0-0.1 scale, lower is better
    const portfolioScore = Math.max(0, 10 - (features.portfolioImpact || 0) * 100);
    score += portfolioScore * weights.portfolioImpact;

    // Bonus for high sharp money with good EV
    if (features.sharpMoney >= 75 && features.expectedValue >= 8) {
      score += 2; // Bonus points for strong combination
    }

    return score;
  }

  /**
   * Calculate ML model score
   */
  private calculateMLScore(mlPredictions: any, weights: any): number {
    let score = 0;

    // ML predictions are already 0-100, scale to 0-10
    score += (mlPredictions.neuralNetwork / 10) * weights.neuralNetwork;
    score += (mlPredictions.gradientBoosting / 10) * weights.gradientBoosting;
    score += (mlPredictions.randomForest / 10) * weights.randomForest;
    score += (mlPredictions.ensemble / 10) * weights.ensemble;

    return score;
  }

  /**
   * Calculate game context score
   */
  private calculateContextScore(features: GradingFeatureSet, weights: any): number {
    let score = 0;

    // Player Fatigue: 0 is good, higher is bad - use playerFatigue field
    const fatigueScore = Math.max(0, 10 - (features.playerFatigue || 0) / 10);
    score += fatigueScore * weights.playerFatigue;

    // Venue Advantage: 0-20 scale to 0-10
    const venueScore = Math.min(10, (features.venueAdvantage || 0) / 2);
    score += venueScore * weights.venueAdvantage;

    // Referee Impact: -10 to +10 scale to 0-10
    const refScore = Math.max(0, Math.min(10, 5 + (features.refereeImpact || 0) / 2));
    score += refScore * weights.refereeImpact;

    // Pace Impact: 0-20 scale to 0-10
    const paceScore = Math.min(10, (features.paceImpact || 0) / 2);
    score += paceScore * weights.paceImpact;

    // Motivational Factors: 0-30 scale to 0-10
    const motivationScore = Math.min(10, (features.motivationalFactors || 0) / 3);
    score += motivationScore * weights.motivationalFactors;

    return score;
  }

  /**
   * Calculate risk-adjusted score
   */
  private calculateRiskScore(features: GradingFeatureSet, weights: any): number {
    let score = 0;

    // Correlation Risk: 0-1 scale, lower is better
    const correlationScore = Math.max(0, 10 - (features.correlationRisk || 0) * 10);
    score += correlationScore * weights.correlationRisk;
    score += Math.max(0, 10 - (features.volatility || 0)) * weights.volatility;
    score += Math.max(0, 10 - (features.portfolioImpact || 0)) * weights.portfolioImpact;

    return score;
  }

  /**
   * Assess comprehensive risk for the prop
   */
  private async assessRisk(features: GradingFeatureSet, compositeScore: any, confidence: number): Promise<{
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
      confidence: confidence // Use proper confidence percentage
    });

    return {
      riskScore: riskMetrics.overallRisk,
      correlationRisk: features.correlationRisk || 0,
      volatilityRisk: features.volatility || 0,
      portfolioRisk: features.portfolioImpact || 0,
      liquidityRisk: features.bidAskSpread ? Math.min(10, features.bidAskSpread * 100) : 1
    };
  }

  /**
   * Generate scenario analysis for the prop
   */
  private async generateScenarioAnalysis(features: GradingFeatureSet, compositeScore: any): Promise<{
    bullCase: { score: number; probability: number };
    baseCase: { score: number; probability: number };
    bearCase: { score: number; probability: number };
  }> {
    const baseScore = compositeScore.finalScore;
    const volatility = features.volatility || 5;
    
    // Calculate scenario scores based on volatility
    const bullCase = Math.min(100, baseScore + (volatility * 1.5));
    const bearCase = Math.max(0, baseScore - (volatility * 1.5));
    
    // Calculate probabilities based on model confidence and historical data
    const confidence = compositeScore.finalScore / 100;
    const baseProbability = 0.4 + (confidence * 0.2); // 40-60% base case probability
    
    return {
      bullCase: { 
        score: bullCase, 
        probability: Math.round((1 - baseProbability) * 0.6 * 100) / 100 
      },
      baseCase: { 
        score: baseScore, 
        probability: Math.round(baseProbability * 100) / 100 
      },
      bearCase: { 
        score: bearCase, 
        probability: Math.round((1 - baseProbability) * 0.4 * 100) / 100 
      }
    };
  }


  /**
   * Calculate feature contributions using SHAP-like methodology
   */
  private calculateFeatureContributions(features: GradingFeatureSet, compositeScore: any): Record<string, number> {
    const contributions: Record<string, number> = {};
    const totalScore = compositeScore.finalScore;

    // Calculate relative contributions of each feature category
    Object.entries(compositeScore.breakdown).forEach(([category, score]) => {
      contributions[category] = ((score as number) / totalScore) * 100;
    });

    return contributions;
  }

  /**
   * Determine tier and confidence based on score and risk
   */
  private determineTierAndConfidence(
    compositeScore: any,
    riskAssessment: any,
    features?: GradingFeatureSet
  ): {
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    confidence: number
  } {
    const score = compositeScore.finalScore;
    const risk = riskAssessment.riskScore;
    const edge = compositeScore.edgeScore;

    // Calculate confidence as a percentage (0-1)
    // Base confidence from score (normalized to 0-1)
    const baseConfidence = score / 100;

    // Risk adjustment (higher risk reduces confidence)
    const riskMultiplier = Math.max(0.5, 1 - (risk / 20));

    // Edge bonus (higher edge increases confidence)
    const edgeMultiplier = Math.min(1.2, 1 + (edge / 50));

    // Final confidence calculation
    const confidence = Math.min(1, baseConfidence * riskMultiplier * edgeMultiplier);

    // Tier determination with more reasonable thresholds
    let tier: 'S' | 'A' | 'B' | 'C' | 'D';

    // Adjust thresholds to be more reasonable for actual scores
    if (score >= 70 && edge >= 20 && risk <= 4) tier = 'S';
    else if (score >= 50 && edge >= 0 && risk <= 5) tier = 'A'; // Lowered A-tier threshold
    else if (score >= 40 && risk <= 6) tier = 'B';
    else if (score >= 30 && risk <= 7) tier = 'C';
    else tier = 'D';

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
  private calculateKellyFraction(features: GradingFeatureSet, compositeScore: any, riskAssessment: any): number {
    // Use a combination of score and expected value for win probability
    const scoreComponent = compositeScore.finalScore / 100;
    const evComponent = Math.min(1, 0.5 + (features.expectedValue / 20)); // EV of 10% = 0.75 prob
    const winProbability = (scoreComponent * 0.6 + evComponent * 0.4); // Blend both factors

    const odds = features.odds ?? features.market.odds;
    const decimalOdds = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;

    // Kelly formula: f = (bp - q) / b
    // where b = odds-1, p = win probability, q = lose probability
    const b = decimalOdds - 1;
    const p = winProbability;
    const q = 1 - p;

    const kellyFraction = (b * p - q) / b;

    // Apply risk adjustment
    const riskAdjustment = Math.max(0.5, 1 - (riskAssessment.riskScore / 20)); // More lenient risk adjustment

    // Apply confidence adjustment
    const confidenceAdjustment = Math.max(0.5, compositeScore.finalScore / 100);

    const adjustedKelly = kellyFraction * riskAdjustment * confidenceAdjustment;

    // Tier-based minimum positions
    const tier = this.determineTierAndConfidence(compositeScore, riskAssessment, features).tier;
    let minimumPosition = 0;

    if (tier === 'S') minimumPosition = 0.05; // 5% minimum for S-tier
    else if (tier === 'A') minimumPosition = 0.03; // 3% minimum for A-tier
    else if (tier === 'B') minimumPosition = 0.015; // 1.5% minimum for B-tier
    else if (tier === 'C') minimumPosition = 0.005; // 0.5% minimum for C-tier

    // For high-value props with strong indicators, ensure minimum position
    if (features.expectedValue > 8 && features.sharpMoney > 75) {
      return Math.max(minimumPosition, Math.min(0.25, adjustedKelly));
    }

    return Math.max(minimumPosition, Math.min(0.25, adjustedKelly)); // Cap at 25%
  }

  /**
   * Get historical accuracy for similar props
   */
  private async getHistoricalAccuracy(features: GradingFeatureSet): Promise<number> {
    const accuracy = await this.performanceAnalyzer.getHistoricalAccuracy();
    return accuracy.overall;
  }

  /**
   * Log performance for continuous improvement
   */
  private async logPerformance(features: GradingFeatureSet, result: GradingResult, processingTime: number): Promise<void> {
    await this.performanceAnalyzer.logGradingPerformance(
      result,
      0, // actualOutcome - will be updated when result is known
      0  // actualProfit - will be updated when result is known
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
    // Get performance data for optimization
    const performanceData = this.performanceAnalyzer.exportPerformanceData();

    // This would use techniques like genetic algorithms, gradient descent, or Bayesian optimization
    // For now, return current weights (placeholder for future ML implementation)

    return this.getCurrentConfig().weights;
  }

  /**
   * Batch grade multiple props efficiently
   */
  public async gradeProps(propsList: GradingFeatureSet[]): Promise<GradingResult[]> {
    const results = await Promise.all(
      propsList.map(features => this.gradeProp(features))
    );
    
    // Apply portfolio-level risk adjustments
    return await this.riskManager.adjustPortfolioRisk(results);
  }
}
