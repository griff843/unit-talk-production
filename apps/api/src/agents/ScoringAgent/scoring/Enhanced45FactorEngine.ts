/**
 * Enhanced 45-Factor Scoring Engine
 * 
 * World-class scoring system that rivals the best betting syndicates.
 * Implements 45 distinct factors across Market, Player, Matchup, Price, and Meta categories.
 * Designed for processing 8K+ simultaneous props with sub-50ms feature retrieval.
 */

import { GradingFeatureSet } from '../../../types/GradingFeatureSet';
import { FeatureStoreIntegration } from './FeatureStoreIntegration';
import { MaterialChangeDetector } from './MaterialChangeDetector';
import { createLogger } from '../../../utils/logger';
import {
  applyProfessionalOddsFilter,
  calculateOddsPenalty,
  calculateTrueExpectedValue,
  oddsToImpliedProbability
} from './oddsValueCalculator';
import { dynamicWeightLoader } from './DynamicWeightLoader';

export interface Enhanced45FactorResult {
  totalScore: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  confidence: number;
  kellyFraction: number;
  
  // Category Scores (0-100 each)
  marketScore: number;
  playerScore: number;
  matchupScore: number;
  priceScore: number;
  metaScore: number;
  
  // Individual Factor Scores (all 45 factors)
  factorScores: Record<string, number>;
  factorWeights: Record<string, number>;
  
  // Risk & Performance
  riskAdjustedScore: number;
  expectedValue: number;
  sharpeRatio: number;
  maxDrawdown: number;
  
  // Execution Metrics
  processingTimeMs: number;
  featuresRetrievedMs: number;
  modelAgreement: number;
  dataQuality: number;
  
  // Metadata
  timestamp: string;
  version: string;
  configUsed: string;
}

export interface Factor45Config {
  // Market Factors (10)
  marketFactors: {
    expectedValueDevigged: number;        // Devigged expected value
    lineMovementVelocity: number;         // Rate of line change
    closingLineValue: number;             // CLV prediction
    marketEfficiency: number;             // How efficient is this market
    publicVsSharpSplit: number;           // Betting percentage analysis
    volumeProfile: number;                // Volume pattern analysis
    crossMarketArbitrage: number;         // Related market opportunities
    steamDetection: number;               // Real-time steam moves
    marketResistance: number;             // Line resistance levels
    optimalTiming: number;                // Best time to bet
  };
  
  // Player Factors (10)
  playerFactors: {
    playerForm: number;                   // Recent performance trend
    roleStability: number;               // Consistency in role/usage
    matchupHistory: number;              // Historical vs opponent
    injuryImpact: number;                // Injury news impact
    fatigueLevel: number;                // Rest and workload
    usageRate: number;                   // Team usage percentage
    performanceTrends: number;           // Long-term trends
    clutchFactor: number;                // Performance in key moments
    propSpecificTendencies: number;      // Prop-specific patterns
    situationalPerformance: number;      // Context-specific performance
  };
  
  // Matchup Factors (10)
  matchupFactors: {
    teamVsTeam: number;                  // Head-to-head matchup
    defenseVsPosition: number;           // DVP analysis
    paceImpact: number;                  // Game pace effect
    gameScript: number;                  // Expected game flow
    homeAwaysplits: number;             // Venue impact
    refereeTendencies: number;           // Referee impact
    weatherImpact: number;               // Weather conditions
    venueFactors: number;                // Venue-specific effects
    restAdvantage: number;               // Days rest difference
    motivationalFactors: number;         // Playoff implications, etc.
  };
  
  // Price Factors (10)
  priceFactors: {
    lineShoppingEdge: number;            // Best available line
    kellyFraction: number;               // Optimal position size
    riskAdjustedReturn: number;          // Risk-adjusted expected return
    correlationRisk: number;             // Portfolio correlation
    portfolioImpact: number;             // Effect on overall portfolio
    volatilityScore: number;             // Price volatility
    liquidityPremium: number;            // Market liquidity
    marketTiming: number;                // Time decay effects
    bidAskSpread: number;                // Market spread analysis
    optionValue: number;                 // Optionality in the bet
  };
  
  // Meta Factors (5)
  metaFactors: {
    dataQuality: number;                 // Data completeness & accuracy
    modelAgreement: number;              // Model consensus
    historicalAccuracy: number;          // Track record
    confidenceInterval: number;          // Uncertainty bounds
    recencyBiasAdjustment: number;       // Recency weighting
  };
}

export class Enhanced45FactorEngine {
  private logger = createLogger('Enhanced45FactorEngine');
  private featureStore: FeatureStoreIntegration;
  private changeDetector: MaterialChangeDetector;
  
  // Default configuration optimized for professional betting
  private defaultConfig: Factor45Config = {
    marketFactors: {
      expectedValueDevigged: 0.25,      // Highest weight - foundation of value
      lineMovementVelocity: 0.15,       // Critical for steam detection
      closingLineValue: 0.12,           // Strong predictor of success
      marketEfficiency: 0.10,           // Market maturity indicator
      publicVsSharpSplit: 0.08,         // Contrarian opportunities
      volumeProfile: 0.08,              // Volume indicates conviction
      crossMarketArbitrage: 0.06,       // Related market inefficiencies
      steamDetection: 0.06,             // Real-time move detection
      marketResistance: 0.05,           // Support/resistance levels
      optimalTiming: 0.05               // Timing execution advantage
    },
    playerFactors: {
      playerForm: 0.20,                 // Current form is crucial
      roleStability: 0.15,              // Consistency matters
      matchupHistory: 0.12,             // Historical performance vs opponent
      injuryImpact: 0.12,               // Health impact on performance
      fatigueLevel: 0.10,               // Rest impact on performance
      usageRate: 0.08,                  // Opportunity volume
      performanceTrends: 0.08,          // Long-term trajectory
      clutchFactor: 0.06,               // Performance under pressure
      propSpecificTendencies: 0.05,     // Prop-specific patterns
      situationalPerformance: 0.04      // Context dependency
    },
    matchupFactors: {
      teamVsTeam: 0.18,                 // Overall matchup quality
      defenseVsPosition: 0.16,          // DVP is critical for props
      paceImpact: 0.14,                 // Pace creates opportunities
      gameScript: 0.12,                // Expected game flow
      homeAwaysplits: 0.10,            // Venue advantage
      refereeTendencies: 0.08,          // Officials impact game flow
      weatherImpact: 0.08,              // Environmental factors
      venueFactors: 0.06,               // Venue-specific effects
      restAdvantage: 0.04,              // Rest differential
      motivationalFactors: 0.04         // Situational motivation
    },
    priceFactors: {
      lineShoppingEdge: 0.18,           // Best price available
      kellyFraction: 0.16,              // Optimal sizing
      riskAdjustedReturn: 0.14,         // Risk per unit return
      correlationRisk: 0.12,            // Portfolio risk
      portfolioImpact: 0.10,            // Overall portfolio effect
      volatilityScore: 0.08,            // Price stability
      liquidityPremium: 0.08,           // Market depth
      marketTiming: 0.06,               // Time decay
      bidAskSpread: 0.04,               // Transaction costs
      optionValue: 0.04                 // Embedded optionality
    },
    metaFactors: {
      dataQuality: 0.30,                // Quality of input data
      modelAgreement: 0.25,             // Consensus among models
      historicalAccuracy: 0.20,         // Track record
      confidenceInterval: 0.15,         // Uncertainty quantification
      recencyBiasAdjustment: 0.10       // Temporal weighting
    }
  };
  
  constructor(
    featureStore: FeatureStoreIntegration,
    changeDetector: MaterialChangeDetector
  ) {
    this.featureStore = featureStore;
    this.changeDetector = changeDetector;

    // Log available ML-optimized configs
    const availableConfigs = dynamicWeightLoader.getAvailableConfigs();
    if (availableConfigs.length > 0) {
      this.logger.info('ML-optimized weights available', {
        sports: availableConfigs,
        count: availableConfigs.length
      });
    }
  }
  
  /**
   * Calculate comprehensive 45-factor score for a prop
   */
  async calculate45FactorScore(
    features: GradingFeatureSet,
    config?: Partial<Factor45Config>
  ): Promise<Enhanced45FactorResult> {
    const startTime = Date.now();

    // Load sport-specific ML-optimized weights (if available)
    const sport = features.sport || 'NFL';
    const mlWeights = dynamicWeightLoader.loadWeights(sport);

    // Merge with provided config (provided config takes precedence)
    const effectiveConfig = this.mergeConfig(config, mlWeights);

    // Defensive validation - ensure all config sections exist
    if (!effectiveConfig.marketFactors || !effectiveConfig.playerFactors ||
        !effectiveConfig.matchupFactors || !effectiveConfig.priceFactors ||
        !effectiveConfig.metaFactors) {
      this.logger.error('Enhanced45FactorEngine configuration validation failed', {
        propId: features.propId,
        hasMarketFactors: !!effectiveConfig.marketFactors,
        hasPlayerFactors: !!effectiveConfig.playerFactors,
        hasMatchupFactors: !!effectiveConfig.matchupFactors,
        hasPriceFactors: !!effectiveConfig.priceFactors,
        hasMetaFactors: !!effectiveConfig.metaFactors
      });
      return this.createFallbackResult(features, startTime);
    }

    try {
      // Step 0: Professional Odds Filter - CRITICAL
      const odds = features.odds || features.market?.odds || -110;
      const oddsFilter = applyProfessionalOddsFilter(odds);

      if (!oddsFilter.passes) {
        this.logger.warn('Pick rejected by professional odds filter', {
          propId: features.propId,
          odds,
          reason: oddsFilter.reason
        });

        // Return minimum score for filtered picks
        return this.createRejectedResult(features, startTime, oddsFilter.reason);
      }

      if (oddsFilter.severity === 'warn') {
        this.logger.info('Pick flagged for odds review', {
          propId: features.propId,
          odds,
          reason: oddsFilter.reason
        });
      }

      // Step 1: Retrieve precomputed features from feature store (sub-50ms target)
      const featureStartTime = Date.now();
      const enhancedFeatures = await this.featureStore.getEnhancedFeatures(
        features.propId,
        features.sport,
        features.player || 'unknown'
      );
      const featuresRetrievedMs = Date.now() - featureStartTime;

      this.logger.debug('Features retrieved', {
        propId: features.propId,
        retrievalTimeMs: featuresRetrievedMs,
        featuresCount: Object.keys(enhancedFeatures).length,
        odds,
        oddsFilter: oddsFilter.severity
      });
      
      // Step 2: Calculate all 45 factors in parallel
      const [
        marketScores,
        playerScores,
        matchupScores,
        priceScores,
        metaScores
      ] = await Promise.all([
        this.calculateMarketFactors(features, enhancedFeatures, effectiveConfig.marketFactors),
        this.calculatePlayerFactors(features, enhancedFeatures, effectiveConfig.playerFactors),
        this.calculateMatchupFactors(features, enhancedFeatures, effectiveConfig.matchupFactors),
        this.calculatePriceFactors(features, enhancedFeatures, effectiveConfig.priceFactors),
        this.calculateMetaFactors(features, enhancedFeatures, effectiveConfig.metaFactors)
      ]);
      
      // Step 3: Combine category scores with weights
      const categoryWeights = { market: 0.30, player: 0.25, matchup: 0.20, price: 0.15, meta: 0.10 };
      
      const totalScore = 
        marketScores.categoryScore * categoryWeights.market +
        playerScores.categoryScore * categoryWeights.player +
        matchupScores.categoryScore * categoryWeights.matchup +
        priceScores.categoryScore * categoryWeights.price +
        metaScores.categoryScore * categoryWeights.meta;
      
      // Step 4: Determine tier and risk metrics
      const tier = this.determineTier(totalScore);
      const confidence = this.calculateConfidence(totalScore, metaScores.factors.modelAgreement);
      const kellyFraction = this.calculateKellyFraction(totalScore, priceScores.factors.riskAdjustedReturn);
      
      // Step 5: Risk adjustments
      const riskAdjustedScore = this.applyRiskAdjustments(
        totalScore,
        priceScores.factors.correlationRisk,
        metaScores.factors.confidenceInterval
      );
      
      const result: Enhanced45FactorResult = {
        totalScore: Math.max(0, Math.min(100, isNaN(totalScore) ? 50 : totalScore)),
        tier,
        confidence: isNaN(confidence) ? 0.5 : confidence,
        kellyFraction,
        marketScore: marketScores.categoryScore,
        playerScore: playerScores.categoryScore,
        matchupScore: matchupScores.categoryScore,
        priceScore: priceScores.categoryScore,
        metaScore: metaScores.categoryScore,
        factorScores: {
          ...marketScores.factors,
          ...playerScores.factors,
          ...matchupScores.factors,
          ...priceScores.factors,
          ...metaScores.factors
        },
        factorWeights: this.getFlattenedWeights(effectiveConfig),
        riskAdjustedScore,
        expectedValue: this.calculateExpectedValue(totalScore, kellyFraction),
        sharpeRatio: this.calculateSharpeRatio(riskAdjustedScore, priceScores.factors.volatilityScore),
        maxDrawdown: this.estimateMaxDrawdown(tier, priceScores.factors.volatilityScore),
        processingTimeMs: Date.now() - startTime,
        featuresRetrievedMs,
        modelAgreement: metaScores.factors.modelAgreement,
        dataQuality: metaScores.factors.dataQuality,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        configUsed: 'enhanced-45-factor'
      };
      
      this.logger.info('45-factor analysis completed', {
        propId: features.propId,
        totalScore: result.totalScore,
        tier: result.tier,
        confidence: result.confidence,
        processingTimeMs: result.processingTimeMs
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('45-factor calculation failed', {
        propId: features.propId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Return fallback result with minimum viable data
      return this.createFallbackResult(features, startTime);
    }
  }
  
  /**
   * Calculate Market Factors (10 factors)
   */
  private async calculateMarketFactors(
    features: GradingFeatureSet,
    enhancedFeatures: any,
    weights: Factor45Config['marketFactors']
  ): Promise<{ categoryScore: number; factors: Record<string, number> }> {

    const factors = {
      expectedValueDevigged: await this.calculateDeviggedEV(features, enhancedFeatures),
      lineMovementVelocity: this.calculateLineVelocity(enhancedFeatures.lineHistory || []),
      closingLineValue: this.calculateCLV(features, enhancedFeatures.predictedClosingLine || 0),
      marketEfficiency: this.calculateMarketEfficiency(enhancedFeatures.marketData || {}),
      publicVsSharpSplit: this.calculateBettingSplit(enhancedFeatures.bettingData || {}),
      volumeProfile: this.calculateVolumeProfile(enhancedFeatures.volumeData || []),
      crossMarketArbitrage: this.calculateCrossMarketOpportunity(enhancedFeatures.relatedMarkets || []),
      steamDetection: this.calculateSteamScore(enhancedFeatures.steamData || {}),
      marketResistance: this.calculateMarketResistance(enhancedFeatures.priceAction || []),
      optimalTiming: this.calculateOptimalTiming(features, enhancedFeatures.timingData || {})
    };
    
    const categoryScore = Object.entries(factors).reduce((sum, [key, score]) => {
      const weight = weights[key as keyof typeof weights];
      if (typeof weight !== 'number' || isNaN(weight)) {
        this.logger.warn('Invalid weight found', { key, weight, score });
        return sum; // Skip invalid weights
      }
      // Ensure score is a valid number
      const validScore = (typeof score === 'number' && !isNaN(score)) ? score : 50;
      return sum + (validScore * weight);
    }, 0);
    
    return { categoryScore: Math.max(0, Math.min(100, categoryScore)), factors };
  }
  
  /**
   * Calculate Player Factors (10 factors)
   */
  private async calculatePlayerFactors(
    features: GradingFeatureSet,
    enhancedFeatures: any,
    weights: Factor45Config['playerFactors']
  ): Promise<{ categoryScore: number; factors: Record<string, number> }> {
    
    const factors = {
      playerForm: this.calculatePlayerForm(enhancedFeatures.recentGames || []),
      roleStability: this.calculateRoleStability(enhancedFeatures.roleData || {}),
      matchupHistory: this.calculateMatchupHistory(enhancedFeatures.headToHead || []),
      injuryImpact: this.calculateInjuryImpact(enhancedFeatures.injuryData || {}),
      fatigueLevel: this.calculateFatigueLevel(enhancedFeatures.restData || {}),
      usageRate: this.calculateUsageRate(enhancedFeatures.usageData || {}),
      performanceTrends: this.calculatePerformanceTrends(enhancedFeatures.seasonTrends || []),
      clutchFactor: this.calculateClutchFactor(enhancedFeatures.clutchData || {}),
      propSpecificTendencies: this.calculatePropTendencies(features, enhancedFeatures.propHistory || []),
      situationalPerformance: this.calculateSituationalPerformance(enhancedFeatures.situationalData || {})
    };
    
    const categoryScore = Object.entries(factors).reduce((sum, [key, score]) => {
      const weight = weights[key as keyof typeof weights];
      if (typeof weight !== 'number' || isNaN(weight)) {
        this.logger.warn('Invalid weight found', { key, weight, score });
        return sum; // Skip invalid weights
      }
      // Ensure score is a valid number
      const validScore = (typeof score === 'number' && !isNaN(score)) ? score : 50;
      return sum + (validScore * weight);
    }, 0);
    
    return { categoryScore: Math.max(0, Math.min(100, categoryScore)), factors };
  }
  
  /**
   * Calculate Matchup Factors (10 factors)
   */
  private async calculateMatchupFactors(
    features: GradingFeatureSet,
    enhancedFeatures: any,
    weights: Factor45Config['matchupFactors']
  ): Promise<{ categoryScore: number; factors: Record<string, number> }> {
    
    const factors = {
      teamVsTeam: this.calculateTeamMatchup(enhancedFeatures.teamMatchup || {}),
      defenseVsPosition: this.calculateDVP(enhancedFeatures.dvpData || {}),
      paceImpact: this.calculatePaceImpact(enhancedFeatures.paceData || {}),
      gameScript: this.calculateGameScript(enhancedFeatures.gameScript || {}),
      homeAwaysplits: this.calculateVenueSplits(enhancedFeatures.venueData || {}),
      refereeTendencies: this.calculateRefereImpact(enhancedFeatures.officialData || {}),
      weatherImpact: this.calculateWeatherImpact(enhancedFeatures.weatherData || {}),
      venueFactors: this.calculateVenueFactors(enhancedFeatures.venueAnalysis || {}),
      restAdvantage: this.calculateRestAdvantage(enhancedFeatures.restData || {}),
      motivationalFactors: this.calculateMotivation(enhancedFeatures.motivationData || {})
    };
    
    const categoryScore = Object.entries(factors).reduce((sum, [key, score]) => {
      const weight = weights[key as keyof typeof weights];
      if (typeof weight !== 'number' || isNaN(weight)) {
        this.logger.warn('Invalid weight found', { key, weight, score });
        return sum; // Skip invalid weights
      }
      // Ensure score is a valid number
      const validScore = (typeof score === 'number' && !isNaN(score)) ? score : 50;
      return sum + (validScore * weight);
    }, 0);
    
    return { categoryScore: Math.max(0, Math.min(100, categoryScore)), factors };
  }
  
  /**
   * Calculate Price Factors (10 factors)
   */
  private async calculatePriceFactors(
    features: GradingFeatureSet,
    enhancedFeatures: any,
    weights: Factor45Config['priceFactors']
  ): Promise<{ categoryScore: number; factors: Record<string, number> }> {
    
    const factors = {
      lineShoppingEdge: this.calculateLineShoppingEdge(enhancedFeatures.bookLines || []),
      kellyFraction: this.calculateKellyOptimal(features, enhancedFeatures),
      riskAdjustedReturn: this.calculateRiskAdjustedReturn(features, enhancedFeatures),
      correlationRisk: this.calculateCorrelationRisk(enhancedFeatures.portfolioData || {}),
      portfolioImpact: this.calculatePortfolioImpact(enhancedFeatures.portfolioData || {}),
      volatilityScore: this.calculateVolatility(enhancedFeatures.priceHistory || []),
      liquidityPremium: this.calculateLiquidityPremium(enhancedFeatures.liquidityData || {}),
      marketTiming: this.calculateMarketTimingValue(features, enhancedFeatures.timingData || {}),
      bidAskSpread: this.calculateBidAskImpact(enhancedFeatures.marketDepth || {}),
      optionValue: this.calculateOptionValue(features, enhancedFeatures.optionalityData || {})
    };
    
    const categoryScore = Object.entries(factors).reduce((sum, [key, score]) => {
      const weight = weights[key as keyof typeof weights];
      if (typeof weight !== 'number' || isNaN(weight)) {
        this.logger.warn('Invalid weight found', { key, weight, score });
        return sum; // Skip invalid weights
      }
      // Ensure score is a valid number
      const validScore = (typeof score === 'number' && !isNaN(score)) ? score : 50;
      return sum + (validScore * weight);
    }, 0);
    
    return { categoryScore: Math.max(0, Math.min(100, categoryScore)), factors };
  }
  
  /**
   * Calculate Meta Factors (5 factors)
   */
  private async calculateMetaFactors(
    features: GradingFeatureSet,
    enhancedFeatures: any,
    weights: Factor45Config['metaFactors']
  ): Promise<{ categoryScore: number; factors: Record<string, number> }> {
    
    const factors = {
      dataQuality: this.calculateDataQuality(features, enhancedFeatures),
      modelAgreement: this.calculateModelAgreement(enhancedFeatures.modelOutputs || []),
      historicalAccuracy: this.calculateHistoricalAccuracy(enhancedFeatures.backtestData || {}),
      confidenceInterval: this.calculateConfidenceInterval(enhancedFeatures.uncertaintyData || {}),
      recencyBiasAdjustment: this.calculateRecencyAdjustment(enhancedFeatures.temporalData || {})
    };
    
    const categoryScore = Object.entries(factors).reduce((sum, [key, score]) => {
      const weight = weights[key as keyof typeof weights];
      if (typeof weight !== 'number' || isNaN(weight)) {
        this.logger.warn('Invalid weight found', { key, weight, score });
        return sum; // Skip invalid weights
      }
      // Ensure score is a valid number
      const validScore = (typeof score === 'number' && !isNaN(score)) ? score : 50;
      return sum + (validScore * weight);
    }, 0);
    
    return { categoryScore: Math.max(0, Math.min(100, categoryScore)), factors };
  }
  
  // ========================================
  // MARKET FACTORS IMPLEMENTATION
  // ========================================
  
  private async calculateDeviggedEV(features: GradingFeatureSet, enhancedFeatures: any): Promise<number> {
    const odds = features.odds || features.market?.odds || -110;

    // Apply odds penalty FIRST
    const oddsPenalty = calculateOddsPenalty(odds);

    // Calculate implied probability
    const impliedProb = oddsToImpliedProbability(odds);

    // Assume 5% vig (standard two-way market)
    const vigAdjustment = enhancedFeatures.vigData?.totalVig || 0.05;
    const trueProb = impliedProb / (1 + vigAdjustment);

    // Calculate TRUE expected value using ML-CALIBRATED probability model
    // This uses 2.3M settled outcomes for sport-specific calibration
    let calculatedProb = 0.52; // Fallback default

    try {
      // Import ML-calibrated probability calculator
      const { CalibratedProbabilityCalculator } = await import('../../../models/CalibratedProbabilityCalculator');
      const calibratedCalc = new CalibratedProbabilityCalculator();

      // Calculate calibrated probability
      const probResult = await calibratedCalc.calculateProbability({
        sport: features.sport || 'NFL',
        playerId: features.player?.id || features.player?.player_id,
        playerName: features.player?.name || features.player?.player_name || 'Unknown',
        marketType: features.market?.type || features.market?.market_type || 'unknown',
        line: features.market?.line || 0,
        opponent: features.opponent?.name || features.opponent,
        venue: features.venue,
        gameDate: features.game?.date || features.event_date
      });

      if (probResult) {
        calculatedProb = probResult.probability;

        // Log the ML-calibrated probability calculation
        this.logger.info('ML-calibrated probability calculated', {
          player: features.player?.name,
          market: features.market?.type,
          line: features.market?.line,
          probability: probResult.probability.toFixed(4),
          baseProbability: probResult.metadata?.baseProbability?.toFixed(4),
          calibrationMethod: probResult.metadata?.calibrationMethod,
          confidence: probResult.confidence.toFixed(4),
          method: probResult.method,
          dataPoints: probResult.dataPoints,
          sport: features.sport || 'NFL'
        });
      }
    } catch (error: any) {
      this.logger.warn('Failed to calculate ML-calibrated probability, using fallback', {
        error: error.message,
        fallbackProb: calculatedProb
      });
    }

    const ev = calculateTrueExpectedValue(odds, calculatedProb);

    // Base score on EV
    let baseScore = Math.max(0, Math.min(100, 50 + (ev * 2)));

    // Apply odds penalty to base score
    const finalScore = baseScore * oddsPenalty;

    this.logger.debug('Devigged EV calculated', {
      odds,
      impliedProb: impliedProb.toFixed(4),
      trueProb: trueProb.toFixed(4),
      ev: ev.toFixed(2),
      oddsPenalty: oddsPenalty.toFixed(2),
      baseScore: baseScore.toFixed(2),
      finalScore: finalScore.toFixed(2)
    });

    return finalScore;
  }
  
  private calculateLineVelocity(lineHistory: any[]): number {
    if (lineHistory.length < 2) return 50;
    
    const recent = lineHistory.slice(-5);
    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
    const totalMovement = recent.reduce((sum, point, i) => {
      if (i === 0) return 0;
      return sum + Math.abs(point.line - recent[i - 1].line);
    }, 0);
    
    const velocity = timeSpan > 0 ? totalMovement / (timeSpan / 3600000) : 0; // Movement per hour
    
    // High velocity (>2 points/hour) = high score
    return Math.max(0, Math.min(100, 50 + (velocity * 12.5)));
  }
  
  private calculateCLV(features: GradingFeatureSet, predictedClosingLine: number): number {
    if (!predictedClosingLine) return 50;
    
    const currentLine = features.market?.line || 0;
    const clvAdvantage = Math.abs(predictedClosingLine - currentLine);
    
    // 1+ point CLV advantage = high score
    return Math.max(0, Math.min(100, 50 + (clvAdvantage * 25)));
  }
  
  private calculateMarketEfficiency(marketData: any): number {
    const efficiency = marketData.efficiency || 0.85; // Default to 85% efficient
    // Less efficient markets = higher opportunity scores
    return Math.max(0, Math.min(100, (1 - efficiency) * 100));
  }
  
  private calculateBettingSplit(bettingData: any): number {
    const publicPercent = bettingData.publicPercent || 50;
    const sharpPercent = bettingData.sharpPercent || 50;
    
    // Contrarian opportunities: public >70% or <30%
    if (publicPercent > 70 || publicPercent < 30) {
      return Math.max(0, Math.min(100, 60 + Math.abs(publicPercent - 50)));
    }
    
    return 50; // Neutral
  }
  
  private calculateVolumeProfile(volumeData: any[]): number {
    if (!volumeData.length) return 50;
    
    const recent = volumeData.slice(-3);
    const avgVolume = recent.reduce((sum, v) => sum + v.volume, 0) / recent.length;
    const currentVolume = recent[recent.length - 1].volume;
    
    // High volume relative to average = conviction
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    return Math.max(0, Math.min(100, 30 + (volumeRatio * 35)));
  }
  
  private calculateCrossMarketOpportunity(relatedMarkets: any[]): number {
    if (!relatedMarkets.length) return 50;
    
    let maxArbitrage = 0;
    for (const market of relatedMarkets) {
      if (market.correlation > 0.7 && market.priceDiscrepancy > 0.02) {
        maxArbitrage = Math.max(maxArbitrage, market.priceDiscrepancy);
      }
    }
    
    return Math.max(0, Math.min(100, 50 + (maxArbitrage * 1000)));
  }
  
  private calculateSteamScore(steamData: any): number {
    const detected = steamData.steamDetected || false;
    const confidence = steamData.confidence || 0;
    
    if (detected && confidence > 0.6) {
      return Math.max(70, Math.min(100, 70 + (confidence * 30)));
    }
    
    return Math.max(0, Math.min(50, confidence * 50));
  }
  
  private calculateMarketResistance(priceAction: any[]): number {
    if (!priceAction.length) return 50;
    
    const supportLevel = priceAction.find(p => p.type === 'support');
    const resistanceLevel = priceAction.find(p => p.type === 'resistance');
    
    if (supportLevel && resistanceLevel) {
      const proximity = Math.min(
        Math.abs(supportLevel.price - (priceAction[priceAction.length - 1].price || 0)),
        Math.abs(resistanceLevel.price - (priceAction[priceAction.length - 1].price || 0))
      );
      
      return Math.max(0, Math.min(100, 80 - (proximity * 20)));
    }
    
    return 50;
  }
  
  private calculateOptimalTiming(features: GradingFeatureSet, timingData: any): number {
    const hoursToGame = this.calculateHoursToGame(features);
    const optimalWindow = timingData.optimalWindow || { start: 24, end: 2 };
    
    if (hoursToGame >= optimalWindow.start) return 90; // Early value
    if (hoursToGame <= optimalWindow.end) return 20;   // Too close
    
    // Linear scale between optimal windows
    const position = (hoursToGame - optimalWindow.end) / (optimalWindow.start - optimalWindow.end);
    return Math.max(20, Math.min(90, 20 + (position * 70)));
  }
  
  // ========================================
  // PLAYER FACTORS IMPLEMENTATION
  // ========================================
  
  private calculatePlayerForm(recentGames: any[]): number {
    if (!recentGames.length) return 50;
    
    const games = recentGames.slice(-10); // Last 10 games
    const avgPerformance = games.reduce((sum, game) => sum + game.performance, 0) / games.length;
    const trend = this.calculateTrend(games.map(g => g.performance));
    
    const formScore = (avgPerformance * 0.7) + (trend * 0.3);
    return Math.max(0, Math.min(100, 50 + formScore));
  }
  
  private calculateRoleStability(roleData: any): number {
    const usageVariance = roleData.usageVariance || 0.1;
    const roleConsistency = roleData.consistency || 0.8;
    
    // Lower variance + higher consistency = higher score
    const stabilityScore = (1 - usageVariance) * roleConsistency * 100;
    return Math.max(0, Math.min(100, stabilityScore));
  }
  
  private calculateMatchupHistory(headToHead: any[]): number {
    if (!headToHead.length) return 50;
    
    const recentH2H = headToHead.slice(-5);
    const avgPerformance = recentH2H.reduce((sum, game) => sum + game.performance, 0) / recentH2H.length;
    
    return Math.max(0, Math.min(100, 25 + (avgPerformance * 1.5)));
  }
  
  private calculateInjuryImpact(injuryData: any): number {
    const severity = injuryData.severity || 0;
    const recency = injuryData.recency || 30; // Days ago
    
    if (severity === 0) return 100; // No injury
    
    const impactScore = 100 - (severity * 20) - Math.max(0, (7 - recency) * 5);
    return Math.max(0, Math.min(100, impactScore));
  }
  
  private calculateFatigueLevel(restData: any): number {
    const daysRest = restData.daysRest || 1;
    const recentWorkload = restData.recentWorkload || 50;
    
    const restScore = Math.min(100, (daysRest * 20) + 40);
    const workloadScore = Math.max(0, 100 - recentWorkload);
    
    return (restScore * 0.6) + (workloadScore * 0.4);
  }
  
  private calculateUsageRate(usageData: any): number {
    const currentUsage = usageData.currentUsage || 50;
    const seasonAvg = usageData.seasonAvg || 50;
    const opportunity = usageData.opportunity || 50;
    
    // Higher usage + higher opportunity = higher score
    const usageScore = (currentUsage * 0.4) + (seasonAvg * 0.3) + (opportunity * 0.3);
    return Math.max(0, Math.min(100, usageScore));
  }
  
  private calculatePerformanceTrends(seasonTrends: any[]): number {
    if (!seasonTrends.length) return 50;
    
    const trend = this.calculateTrend(seasonTrends.map(t => t.performance));
    return Math.max(0, Math.min(100, 50 + (trend * 25)));
  }
  
  private calculateClutchFactor(clutchData: any): number {
    const clutchPerformance = clutchData.clutchPerformance || 50;
    const sampleSize = clutchData.sampleSize || 10;
    
    // Adjust for sample size confidence
    const confidence = Math.min(1, sampleSize / 20);
    const adjustedScore = (clutchPerformance * confidence) + (50 * (1 - confidence));
    
    return Math.max(0, Math.min(100, adjustedScore));
  }
  
  private calculatePropTendencies(features: GradingFeatureSet, propHistory: any[]): number {
    if (!propHistory.length) return 50;
    
    const relevantHistory = propHistory.filter(p => p.statType === features.market.type);
    if (!relevantHistory.length) return 50;
    
    const hitRate = relevantHistory.reduce((sum, p) => sum + (p.hit ? 1 : 0), 0) / relevantHistory.length;
    return Math.max(0, Math.min(100, hitRate * 100));
  }
  
  private calculateSituationalPerformance(situationalData: any): number {
    const context = situationalData.context || 'neutral';
    const performance = situationalData.performance || 50;
    const contextMultipliers = {
      'favorable': 1.2,
      'neutral': 1.0,
      'unfavorable': 0.8
    };
    
    const adjustedPerformance = performance * (contextMultipliers[context as keyof typeof contextMultipliers] || 1.0);
    return Math.max(0, Math.min(100, adjustedPerformance));
  }
  
  // ========================================
  // MATCHUP, PRICE & META FACTORS (Simplified for brevity)
  // ========================================
  
  private calculateTeamMatchup(teamMatchup: any): number {
    return Math.max(0, Math.min(100, teamMatchup.rating || 50));
  }
  
  private calculateDVP(dvpData: any): number {
    return Math.max(0, Math.min(100, dvpData.rating || 50));
  }
  
  private calculatePaceImpact(paceData: any): number {
    return Math.max(0, Math.min(100, paceData.impact || 50));
  }
  
  private calculateGameScript(gameScript: any): number {
    return Math.max(0, Math.min(100, gameScript.favorability || 50));
  }
  
  private calculateVenueSplits(venueData: any): number {
    return Math.max(0, Math.min(100, venueData.advantage || 50));
  }
  
  private calculateRefereImpact(officialData: any): number {
    return Math.max(0, Math.min(100, officialData.impact || 50));
  }
  
  private calculateWeatherImpact(weatherData: any): number {
    return Math.max(0, Math.min(100, 50 - (weatherData.severity || 0) * 10));
  }
  
  private calculateVenueFactors(venueAnalysis: any): number {
    return Math.max(0, Math.min(100, venueAnalysis.advantage || 50));
  }
  
  private calculateRestAdvantage(restData: any): number {
    const advantage = restData.advantage || 0;
    return Math.max(0, Math.min(100, 50 + (advantage * 10)));
  }
  
  private calculateMotivation(motivationData: any): number {
    return Math.max(0, Math.min(100, motivationData.level || 50));
  }
  
  // Price factors (simplified implementations)
  private calculateLineShoppingEdge(bookLines: any[]): number {
    if (!bookLines.length) return 50;
    const bestLine = Math.min(...bookLines.map(b => Math.abs(b.odds)));
    const avgLine = bookLines.reduce((sum, b) => sum + Math.abs(b.odds), 0) / bookLines.length;
    const edge = ((avgLine - bestLine) / avgLine) * 100;
    return Math.max(0, Math.min(100, 50 + edge));
  }
  
  private calculateKellyOptimal(features: GradingFeatureSet, enhancedFeatures: any): number {
    const edge = enhancedFeatures.edge || features.expectedValue || 0;
    const odds = features.odds || features.market.odds;
    const winProb = this.oddsToProb(odds) + (edge / 100);
    
    const b = Math.abs(odds) / 100;
    const kelly = (b * winProb - (1 - winProb)) / b;
    
    return Math.max(0, Math.min(100, kelly * 200 + 50));
  }
  
  private calculateRiskAdjustedReturn(features: GradingFeatureSet, enhancedFeatures: any): number {
    const expectedReturn = enhancedFeatures.expectedReturn || features.expectedValue || 0;
    const volatility = enhancedFeatures.volatility || 5;
    const sharpe = volatility > 0 ? expectedReturn / volatility : 0;
    return Math.max(0, Math.min(100, 50 + (sharpe * 10)));
  }
  
  private calculateCorrelationRisk(portfolioData: any): number {
    const correlation = portfolioData.maxCorrelation || 0;
    return Math.max(0, Math.min(100, 100 - (correlation * 50)));
  }
  
  private calculatePortfolioImpact(portfolioData: any): number {
    const impact = portfolioData.portfolioImpact || 0;
    return Math.max(0, Math.min(100, 50 - (impact * 25)));
  }
  
  private calculateVolatility(priceHistory: any[]): number {
    if (!priceHistory.length) return 50;
    const volatility = this.calculateStandardDeviation(priceHistory.map(p => p.price));
    return Math.max(0, Math.min(100, 100 - (volatility * 10)));
  }
  
  private calculateLiquidityPremium(liquidityData: any): number {
    const depth = liquidityData.depth || 50;
    return Math.max(0, Math.min(100, depth));
  }
  
  private calculateMarketTimingValue(features: GradingFeatureSet, timingData: any): number {
    const hoursToGame = this.calculateHoursToGame(features);
    const optimalHours = timingData.optimalHours || 12;
    const distance = Math.abs(hoursToGame - optimalHours);
    return Math.max(0, Math.min(100, 100 - (distance * 2)));
  }
  
  private calculateBidAskImpact(marketDepth: any): number {
    const spread = marketDepth.bidAskSpread || 0.02;
    return Math.max(0, Math.min(100, 100 - (spread * 1000)));
  }
  
  private calculateOptionValue(features: GradingFeatureSet, optionalityData: any): number {
    const optionValue = optionalityData.value || 0;
    return Math.max(0, Math.min(100, 50 + (optionValue * 50)));
  }
  
  // Meta factors (simplified implementations)
  private calculateDataQuality(features: GradingFeatureSet, enhancedFeatures: any): number {
    const completeness = features.dataQuality?.completeness || 0.95;
    const accuracy = enhancedFeatures.dataAccuracy || 0.95;
    return Math.max(0, Math.min(100, (completeness + accuracy) * 50));
  }
  
  private calculateModelAgreement(modelOutputs: any[]): number {
    if (!modelOutputs.length) return 50;
    const scores = modelOutputs.map(m => m.score);
    const variance = this.calculateVariance(scores);
    const agreement = Math.max(0, 1 - (variance / 100));
    return Math.max(0, Math.min(100, agreement * 100));
  }
  
  private calculateHistoricalAccuracy(backtestData: any): number {
    const accuracy = backtestData.accuracy || 0.55;
    return Math.max(0, Math.min(100, accuracy * 100));
  }
  
  private calculateConfidenceInterval(uncertaintyData: any): number {
    const confidenceWidth = uncertaintyData.confidenceWidth || 0.2;
    return Math.max(0, Math.min(100, 100 - (confidenceWidth * 250)));
  }
  
  private calculateRecencyAdjustment(temporalData: any): number {
    const recencyBias = temporalData.recencyBias || 0;
    return Math.max(0, Math.min(100, 50 - (recencyBias * 50)));
  }
  
  // ========================================
  // HELPER METHODS
  // ========================================
  
  private mergeConfig(
    config?: Partial<Factor45Config>,
    mlWeights?: Factor45Config
  ): Factor45Config {
    // Priority: config > mlWeights > defaultConfig
    const baseConfig = mlWeights || this.defaultConfig;

    if (!config) return baseConfig;

    return {
      marketFactors: { ...baseConfig.marketFactors, ...config.marketFactors },
      playerFactors: { ...baseConfig.playerFactors, ...config.playerFactors },
      matchupFactors: { ...baseConfig.matchupFactors, ...config.matchupFactors },
      priceFactors: { ...baseConfig.priceFactors, ...config.priceFactors },
      metaFactors: { ...baseConfig.metaFactors, ...config.metaFactors }
    };
  }
  
  private getFlattenedWeights(config: Factor45Config): Record<string, number> {
    return {
      ...config.marketFactors,
      ...config.playerFactors,
      ...config.matchupFactors,
      ...config.priceFactors,
      ...config.metaFactors
    };
  }
  
  private determineTier(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
    if (score >= 85) return 'S';
    if (score >= 70) return 'A';
    if (score >= 55) return 'B';
    if (score >= 40) return 'C';
    return 'D';
  }
  
  private calculateConfidence(score: number, modelAgreement: number): number {
    const baseConfidence = score / 100;
    const agreementAdjustment = (modelAgreement / 100) * 0.2;
    return Math.max(0, Math.min(1, baseConfidence + agreementAdjustment));
  }
  
  private calculateKellyFraction(score: number, riskAdjustedReturn: number): number {
    const edge = (score - 50) / 100; // Convert score to edge
    const kelly = edge * 0.25; // Conservative Kelly multiplier
    return Math.max(0, Math.min(0.25, kelly));
  }
  
  private applyRiskAdjustments(score: number, correlationRisk: number, confidenceInterval: number): number {
    const correlationPenalty = (100 - correlationRisk) / 100 * 0.1;
    const confidencePenalty = (100 - confidenceInterval) / 100 * 0.05;
    
    return score * (1 - correlationPenalty - confidencePenalty);
  }
  
  private calculateExpectedValue(score: number, kellyFraction: number): number {
    return ((score - 50) / 100) * kellyFraction * 100;
  }
  
  private calculateSharpeRatio(riskAdjustedScore: number, volatility: number): number {
    const excess = (riskAdjustedScore - 50) / 100;
    const vol = (100 - volatility) / 100;
    return vol > 0 ? excess / vol : 0;
  }
  
  private estimateMaxDrawdown(tier: string, volatility: number): number {
    const baseDrawdowns = { S: 0.05, A: 0.08, B: 0.12, C: 0.18, D: 0.25 };
    const baseDrawdown = baseDrawdowns[tier as keyof typeof baseDrawdowns] || 0.25;
    const volatilityMultiplier = 1 + ((100 - volatility) / 100);
    
    return baseDrawdown * volatilityMultiplier;
  }
  
  private calculateHoursToGame(features: GradingFeatureSet): number {
    try {
      const gameDate = features.game_date || features.timestamp;
      if (!gameDate) return 12;
      
      const gameTime = new Date(gameDate);
      const now = new Date();
      
      return Math.max(0, (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60));
    } catch {
      return 12;
    }
  }
  
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    let trend = 0;
    for (let i = 1; i < values.length; i++) {
      trend += values[i] - values[i - 1];
    }
    
    return trend / (values.length - 1);
  }
  
  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }
  
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }
  
  private oddsToProb(odds: number): number {
    return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  }
  
  private createFallbackResult(features: GradingFeatureSet, startTime: number): Enhanced45FactorResult {
    return {
      totalScore: 50,
      tier: 'C',
      confidence: 0.5,
      kellyFraction: 0.01,
      marketScore: 50,
      playerScore: 50,
      matchupScore: 50,
      priceScore: 50,
      metaScore: 50,
      factorScores: {},
      factorWeights: {},
      riskAdjustedScore: 50,
      expectedValue: 0,
      sharpeRatio: 0,
      maxDrawdown: 0.15,
      processingTimeMs: Date.now() - startTime,
      featuresRetrievedMs: 0,
      modelAgreement: 0.5,
      dataQuality: 0.5,
      timestamp: new Date().toISOString(),
      version: '1.0.0-fallback',
      configUsed: 'fallback'
    };
  }

  /**
   * Create result for picks rejected by professional odds filter
   */
  private createRejectedResult(
    features: GradingFeatureSet,
    startTime: number,
    reason?: string
  ): Enhanced45FactorResult {
    return {
      totalScore: 0,  // Zero score for rejected picks
      tier: 'D',
      confidence: 0,
      kellyFraction: 0,
      marketScore: 0,
      playerScore: 0,
      matchupScore: 0,
      priceScore: 0,
      metaScore: 0,
      factorScores: { rejection_reason: reason || 'Unprofessional odds' },
      factorWeights: {},
      riskAdjustedScore: 0,
      expectedValue: -100,  // Negative EV to signal bad value
      sharpeRatio: 0,
      maxDrawdown: 1.0,  // 100% drawdown risk
      processingTimeMs: Date.now() - startTime,
      featuresRetrievedMs: 0,
      modelAgreement: 0,
      dataQuality: 0,
      timestamp: new Date().toISOString(),
      version: '1.0.0-rejected',
      configUsed: 'professional-odds-filter'
    };
  }
  
  /**
   * Process batch of props for high throughput
   */
  async batchProcess45Factor(
    propsList: GradingFeatureSet[],
    config?: Partial<Factor45Config>
  ): Promise<Enhanced45FactorResult[]> {
    const batchSize = 100; // Process in batches of 100
    const results: Enhanced45FactorResult[] = [];
    
    for (let i = 0; i < propsList.length; i += batchSize) {
      const batch = propsList.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(features => this.calculate45FactorScore(features, config))
      );
      results.push(...batchResults);
    }
    
    this.logger.info('Batch 45-factor processing completed', {
      totalProps: propsList.length,
      batches: Math.ceil(propsList.length / batchSize),
      avgScore: results.reduce((sum, r) => sum + r.totalScore, 0) / results.length
    });
    
    return results;
  }
}