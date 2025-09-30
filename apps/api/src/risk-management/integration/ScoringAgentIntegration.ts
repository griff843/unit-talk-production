/**
 * ScoringAgent Integration
 *
 * Integration layer connecting the Phase 7 Risk Management system with the existing
 * ScoringAgent and Enhanced45FactorEngine. Provides risk-enhanced scoring and
 * automated position sizing with comprehensive risk controls.
 */

import { createLogger } from '../../utils/logger';
import { RiskManagementEngine, PropRiskAssessment } from '../core/RiskManagementEngine';
import { RiskManagementConfigFactory } from '../config';
import { Enhanced45FactorEngine, Enhanced45FactorResult } from '../../agents/ScoringAgent/scoring/Enhanced45FactorEngine';
import { FeatureStoreIntegration } from '../../agents/ScoringAgent/scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from '../../agents/ScoringAgent/scoring/MaterialChangeDetector';
import { GradingFeatureSet } from '../../types/GradingFeatureSet';
import {
  Position,
  RiskProfile,
  RiskAlert,
  KellyResult
} from '../types';

export interface RiskEnhancedScoringResult {
  // Original 45-factor scoring
  factorAnalysis: Enhanced45FactorResult;

  // Risk management analysis
  riskAssessment: PropRiskAssessment;

  // Integrated recommendations
  finalRecommendation: 'APPROVE' | 'REDUCE' | 'REJECT';
  finalStake: number;
  maxStake: number;

  // Risk adjustments applied
  riskAdjustments: {
    kellyAdjustment: number;        // Kelly-based adjustment
    correlationAdjustment: number;  // Correlation-based adjustment
    portfolioAdjustment: number;    // Portfolio context adjustment
    overallAdjustment: number;      // Combined adjustment factor
  };

  // Alerts and warnings
  riskAlerts: RiskAlert[];
  warnings: string[];

  // Performance metrics
  expectedSharpe: number;
  riskAdjustedReturn: number;
  portfolioImpact: number;

  // Metadata
  processingTime: number;
  riskEngineVersion: string;
  scoringEngineVersion: string;
}

export interface ScoringIntegrationConfig {
  enableRiskManagement: boolean;
  riskProfile: RiskProfile;
  autoApproveThreshold: number;      // Auto-approve if risk score below this
  autoRejectThreshold: number;       // Auto-reject if risk score above this
  kellyMultiplierOverride?: number;  // Override Kelly multiplier
  maxStakeOverride?: number;         // Override max stake calculation
}

export class ScoringAgentIntegration {
  private logger = createLogger('ScoringAgentIntegration');
  private riskEngine: RiskManagementEngine;
  private scoringEngine: Enhanced45FactorEngine;
  private featureStore: FeatureStoreIntegration;
  private changeDetector: MaterialChangeDetector;
  private config: ScoringIntegrationConfig;

  // Integration statistics
  private integrationStats = {
    totalProcessed: 0,
    riskApproved: 0,
    riskReduced: 0,
    riskRejected: 0,
    avgRiskScore: 0,
    avgKellyFraction: 0,
    avgProcessingTime: 0
  };

  constructor(config: ScoringIntegrationConfig) {
    this.config = config;

    // Initialize risk management engine
    const riskConfig = RiskManagementConfigFactory.createFromEnvironment();
    this.riskEngine = new RiskManagementEngine(riskConfig, config.riskProfile);

    // Initialize scoring components
    this.featureStore = new FeatureStoreIntegration();
    this.changeDetector = new MaterialChangeDetector();
    this.scoringEngine = new Enhanced45FactorEngine(this.featureStore, this.changeDetector);

    this.logger.info('ScoringAgent Integration initialized', {
      riskManagementEnabled: config.enableRiskManagement,
      riskProfile: config.riskProfile.id,
      autoApproveThreshold: config.autoApproveThreshold,
      autoRejectThreshold: config.autoRejectThreshold
    });
  }

  /**
   * Process prop through integrated risk-enhanced scoring pipeline
   */
  async processRiskEnhancedScoring(
    features: GradingFeatureSet,
    gameContext?: {
      gameId?: string;
      gameTime?: string;
      sport: string;
    }
  ): Promise<RiskEnhancedScoringResult> {
    const startTime = Date.now();

    try {
      // Step 1: Run 45-factor analysis
      const factorAnalysis = await this.scoringEngine.calculate45FactorScore(features);

      // Step 2: Run risk assessment if risk management is enabled
      let riskAssessment: PropRiskAssessment;
      let riskAlerts: RiskAlert[] = [];

      if (this.config.enableRiskManagement) {
        riskAssessment = await this.performRiskAssessment(features, factorAnalysis, gameContext);
        riskAlerts = await this.checkRiskAlerts();
      } else {
        riskAssessment = this.createBypassRiskAssessment(features, factorAnalysis);
      }

      // Step 3: Integrate recommendations
      const integratedResult = this.integrateRecommendations(factorAnalysis, riskAssessment);

      // Step 4: Calculate risk adjustments
      const riskAdjustments = this.calculateRiskAdjustments(factorAnalysis, riskAssessment);

      // Step 5: Generate final stake recommendation
      const stakeRecommendation = this.calculateFinalStake(
        factorAnalysis,
        riskAssessment,
        riskAdjustments
      );

      // Step 6: Calculate performance projections
      const performanceMetrics = this.calculatePerformanceProjections(
        factorAnalysis,
        riskAssessment,
        stakeRecommendation
      );

      const result: RiskEnhancedScoringResult = {
        factorAnalysis,
        riskAssessment,
        finalRecommendation: integratedResult.recommendation,
        finalStake: stakeRecommendation.finalStake,
        maxStake: stakeRecommendation.maxStake,
        riskAdjustments,
        riskAlerts,
        warnings: [...factorAnalysis.factorWeights ? [] : ['Factor analysis incomplete'], ...riskAssessment.warnings],
        expectedSharpe: performanceMetrics.expectedSharpe,
        riskAdjustedReturn: performanceMetrics.riskAdjustedReturn,
        portfolioImpact: performanceMetrics.portfolioImpact,
        processingTime: Date.now() - startTime,
        riskEngineVersion: '1.0.0',
        scoringEngineVersion: factorAnalysis.version
      };

      // Update statistics
      this.updateIntegrationStats(result);

      this.logger.info('Risk-enhanced scoring completed', {
        propId: features.propId,
        factorScore: factorAnalysis.totalScore,
        riskScore: riskAssessment.overallRisk,
        finalRecommendation: result.finalRecommendation,
        finalStake: result.finalStake,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      this.logger.error('Risk-enhanced scoring failed', {
        propId: features.propId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return this.createFallbackResult(features, startTime);
    }
  }

  /**
   * Batch process multiple props with risk management
   */
  async batchProcessRiskEnhanced(
    propositions: Array<{
      features: GradingFeatureSet;
      gameContext?: any;
    }>
  ): Promise<RiskEnhancedScoringResult[]> {
    const batchStartTime = Date.now();

    this.logger.info('Starting batch risk-enhanced scoring', {
      batchSize: propositions.length
    });

    // Process in parallel with controlled concurrency
    const batchSize = 20; // Process 20 at a time to avoid overwhelming the system
    const results: RiskEnhancedScoringResult[] = [];

    for (let i = 0; i < propositions.length; i += batchSize) {
      const batch = propositions.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(({ features, gameContext }) =>
          this.processRiskEnhancedScoring(features, gameContext)
        )
      );
      results.push(...batchResults);
    }

    // Sort by combined score (factor score + risk score)
    results.sort((a, b) => {
      const scoreA = a.factorAnalysis.totalScore * (1 - a.riskAssessment.overallRisk / 10);
      const scoreB = b.factorAnalysis.totalScore * (1 - b.riskAssessment.overallRisk / 10);
      return scoreB - scoreA;
    });

    this.logger.info('Batch risk-enhanced scoring completed', {
      batchSize: propositions.length,
      approved: results.filter(r => r.finalRecommendation === 'APPROVE').length,
      reduced: results.filter(r => r.finalRecommendation === 'REDUCE').length,
      rejected: results.filter(r => r.finalRecommendation === 'REJECT').length,
      avgProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
      totalProcessingTime: Date.now() - batchStartTime
    });

    return results;
  }

  /**
   * Add position to risk management system
   */
  async addPositionToRiskEngine(position: Position): Promise<void> {
    if (this.config.enableRiskManagement) {
      await this.riskEngine.addPosition(position);

      this.logger.debug('Position added to risk engine', {
        positionId: position.id,
        propId: position.propId,
        stake: position.stake
      });
    }
  }

  /**
   * Get comprehensive risk status
   */
  async getRiskStatus(): Promise<{
    portfolioRisk: any;
    activeAlerts: RiskAlert[];
    riskProfile: RiskProfile;
    integrationStats: any;
    systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  }> {
    const [portfolioRisk, activeAlerts] = await Promise.all([
      this.riskEngine.getPortfolioRisk(),
      this.riskEngine.getActiveAlerts()
    ]);

    let systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';

    if (activeAlerts.some(alert => alert.severity === 'CRITICAL')) {
      systemHealth = 'CRITICAL';
    } else if (activeAlerts.some(alert => alert.severity === 'HIGH')) {
      systemHealth = 'WARNING';
    }

    return {
      portfolioRisk,
      activeAlerts,
      riskProfile: this.riskEngine.getRiskProfile(),
      integrationStats: this.integrationStats,
      systemHealth
    };
  }

  // ========================================
  // Private Methods
  // ========================================

  /**
   * Perform comprehensive risk assessment
   */
  private async performRiskAssessment(
    features: GradingFeatureSet,
    factorAnalysis: Enhanced45FactorResult,
    gameContext?: any
  ): Promise<PropRiskAssessment> {
    // Convert features to risk assessment format
    const propForRisk = {
      propId: features.propId,
      sport: features.sport || 'Unknown',
      player: features.player || 'Unknown',
      marketType: features.market?.type || 'Unknown',
      odds: features.odds || features.market?.odds || 0,
      line: features.market?.line,
      expectedValue: factorAnalysis.expectedValue,
      confidence: factorAnalysis.confidence * 100,
      winProbability: this.calculateWinProbability(features.odds || 0, factorAnalysis.expectedValue),
      gameId: gameContext?.gameId,
      gameTime: gameContext?.gameTime || new Date().toISOString()
    };

    return await this.riskEngine.assessPropRisk(propForRisk);
  }

  /**
   * Create bypass risk assessment when risk management is disabled
   */
  private createBypassRiskAssessment(
    features: GradingFeatureSet,
    factorAnalysis: Enhanced45FactorResult
  ): PropRiskAssessment {
    return {
      propId: features.propId,
      overallRisk: 3, // Low-medium risk
      riskBreakdown: {
        individualRisk: 3,
        correlationRisk: 2,
        concentrationRisk: 2,
        liquidityRisk: 3,
        timingRisk: 2,
        portfolioContribution: 0,
        valueAtRisk: 0,
        expectedShortfall: 0,
        maxDrawdownContribution: 0
      },
      riskFactors: [],
      kellyResult: {
        positionId: `bypass-${features.propId}`,
        propId: features.propId,
        optimalFraction: 0.02,
        fractionalKelly: 0.02,
        recommendedStake: this.config.riskProfile.bankroll * 0.02,
        maxStake: this.config.riskProfile.bankroll * 0.05,
        winProbability: this.calculateWinProbability(features.odds || 0, factorAnalysis.expectedValue),
        odds: features.odds || 0,
        expectedValue: factorAnalysis.expectedValue,
        edge: factorAnalysis.expectedValue / 100,
        confidenceAdjustment: 1,
        correlationAdjustment: 1,
        portfolioAdjustment: 1,
        riskScore: 3,
        recommendation: 'APPROVE',
        warnings: [],
        calculatedAt: new Date().toISOString(),
        modelVersion: '1.0.0-bypass',
        bankrollAtCalculation: this.config.riskProfile.bankroll
      },
      recommendation: 'APPROVE',
      suggestedStake: this.config.riskProfile.bankroll * 0.02,
      maxStake: this.config.riskProfile.bankroll * 0.05,
      warnings: ['Risk management bypassed'],
      correlationRisk: 2,
      portfolioImpact: 1
    };
  }

  /**
   * Integrate recommendations from scoring and risk analysis
   */
  private integrateRecommendations(
    factorAnalysis: Enhanced45FactorResult,
    riskAssessment: PropRiskAssessment
  ): { recommendation: 'APPROVE' | 'REDUCE' | 'REJECT'; reasoning: string[] } {
    const reasoning: string[] = [];

    // Factor analysis recommendation weight
    const factorWeight = factorAnalysis.totalScore >= 85 ? 1.0 :
                        factorAnalysis.totalScore >= 70 ? 0.8 :
                        factorAnalysis.totalScore >= 55 ? 0.6 : 0.4;

    // Risk assessment recommendation weight
    const riskWeight = riskAssessment.overallRisk <= 3 ? 1.0 :
                      riskAssessment.overallRisk <= 5 ? 0.8 :
                      riskAssessment.overallRisk <= 7 ? 0.6 : 0.3;

    // Combined score
    const combinedScore = (factorWeight + riskWeight) / 2;

    // Apply auto-thresholds
    if (riskAssessment.overallRisk >= this.config.autoRejectThreshold) {
      reasoning.push(`Auto-reject: Risk score ${riskAssessment.overallRisk} >= ${this.config.autoRejectThreshold}`);
      return { recommendation: 'REJECT', reasoning };
    }

    if (riskAssessment.overallRisk <= this.config.autoApproveThreshold && factorAnalysis.totalScore >= 70) {
      reasoning.push(`Auto-approve: Low risk (${riskAssessment.overallRisk}) + good score (${factorAnalysis.totalScore})`);
      return { recommendation: 'APPROVE', reasoning };
    }

    // Integrated decision
    if (combinedScore >= 0.8) {
      reasoning.push(`Approve: Strong combined score (${(combinedScore * 100).toFixed(1)}%)`);
      return { recommendation: 'APPROVE', reasoning };
    } else if (combinedScore >= 0.6) {
      reasoning.push(`Reduce: Moderate combined score (${(combinedScore * 100).toFixed(1)}%)`);
      return { recommendation: 'REDUCE', reasoning };
    } else {
      reasoning.push(`Reject: Low combined score (${(combinedScore * 100).toFixed(1)}%)`);
      return { recommendation: 'REJECT', reasoning };
    }
  }

  /**
   * Calculate risk adjustments to apply
   */
  private calculateRiskAdjustments(
    factorAnalysis: Enhanced45FactorResult,
    riskAssessment: PropRiskAssessment
  ): {
    kellyAdjustment: number;
    correlationAdjustment: number;
    portfolioAdjustment: number;
    overallAdjustment: number;
  } {
    // Kelly-based adjustment
    const kellyAdjustment = riskAssessment.kellyResult.optimalFraction > 0 ?
      riskAssessment.kellyResult.fractionalKelly / riskAssessment.kellyResult.optimalFraction : 0.25;

    // Correlation adjustment
    const correlationAdjustment = Math.max(0.3, 1 - (riskAssessment.correlationRisk / 10));

    // Portfolio context adjustment
    const portfolioAdjustment = Math.max(0.5, 1 - (riskAssessment.portfolioImpact / 10));

    // Combined adjustment
    const overallAdjustment = kellyAdjustment * correlationAdjustment * portfolioAdjustment;

    return {
      kellyAdjustment,
      correlationAdjustment,
      portfolioAdjustment,
      overallAdjustment
    };
  }

  /**
   * Calculate final stake recommendation
   */
  private calculateFinalStake(
    factorAnalysis: Enhanced45FactorResult,
    riskAssessment: PropRiskAssessment,
    riskAdjustments: any
  ): { finalStake: number; maxStake: number } {
    let finalStake = riskAssessment.suggestedStake;

    // Apply risk adjustments
    finalStake *= riskAdjustments.overallAdjustment;

    // Apply configuration overrides
    if (this.config.kellyMultiplierOverride) {
      finalStake = riskAssessment.kellyResult.optimalFraction *
                   this.config.kellyMultiplierOverride *
                   this.config.riskProfile.bankroll;
    }

    const maxStake = this.config.maxStakeOverride || riskAssessment.maxStake;

    // Ensure within limits
    finalStake = Math.max(0, Math.min(finalStake, maxStake));

    return { finalStake, maxStake };
  }

  /**
   * Calculate performance projections
   */
  private calculatePerformanceProjections(
    factorAnalysis: Enhanced45FactorResult,
    riskAssessment: PropRiskAssessment,
    stakeRecommendation: any
  ): {
    expectedSharpe: number;
    riskAdjustedReturn: number;
    portfolioImpact: number;
  } {
    const expectedReturn = factorAnalysis.expectedValue / 100;
    const riskLevel = riskAssessment.overallRisk / 10;

    return {
      expectedSharpe: riskLevel > 0 ? expectedReturn / riskLevel : 0,
      riskAdjustedReturn: expectedReturn * (1 - riskLevel * 0.1),
      portfolioImpact: stakeRecommendation.finalStake / this.config.riskProfile.bankroll
    };
  }

  /**
   * Calculate win probability from odds and expected value
   */
  private calculateWinProbability(odds: number, expectedValue: number): number {
    // Convert odds to implied probability
    const impliedProb = odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);

    // Add expected value edge
    return Math.min(0.99, Math.max(0.01, impliedProb + (expectedValue / 100)));
  }

  /**
   * Check for active risk alerts
   */
  private async checkRiskAlerts(): Promise<RiskAlert[]> {
    return this.riskEngine.getActiveAlerts();
  }

  /**
   * Update integration statistics
   */
  private updateIntegrationStats(result: RiskEnhancedScoringResult): void {
    this.integrationStats.totalProcessed++;

    const count = this.integrationStats.totalProcessed;

    // Update recommendation counts
    if (result.finalRecommendation === 'APPROVE') this.integrationStats.riskApproved++;
    else if (result.finalRecommendation === 'REDUCE') this.integrationStats.riskReduced++;
    else this.integrationStats.riskRejected++;

    // Update running averages
    this.integrationStats.avgRiskScore =
      ((this.integrationStats.avgRiskScore * (count - 1)) + result.riskAssessment.overallRisk) / count;

    this.integrationStats.avgKellyFraction =
      ((this.integrationStats.avgKellyFraction * (count - 1)) + result.riskAssessment.kellyResult.fractionalKelly) / count;

    this.integrationStats.avgProcessingTime =
      ((this.integrationStats.avgProcessingTime * (count - 1)) + result.processingTime) / count;
  }

  /**
   * Create fallback result for error cases
   */
  private createFallbackResult(features: GradingFeatureSet, startTime: number): RiskEnhancedScoringResult {
    const fallbackFactorAnalysis: Enhanced45FactorResult = {
      totalScore: 40,
      tier: 'C',
      confidence: 0.3,
      kellyFraction: 0,
      marketScore: 40,
      playerScore: 40,
      matchupScore: 40,
      priceScore: 40,
      metaScore: 40,
      factorScores: {},
      factorWeights: {},
      riskAdjustedScore: 40,
      expectedValue: 0,
      sharpeRatio: 0,
      maxDrawdown: 0.2,
      processingTimeMs: 0,
      featuresRetrievedMs: 0,
      modelAgreement: 0.5,
      dataQuality: 0.5,
      timestamp: new Date().toISOString(),
      version: '1.0.0-fallback',
      configUsed: 'fallback'
    };

    const fallbackRiskAssessment = this.createBypassRiskAssessment(features, fallbackFactorAnalysis);

    return {
      factorAnalysis: fallbackFactorAnalysis,
      riskAssessment: fallbackRiskAssessment,
      finalRecommendation: 'REJECT',
      finalStake: 0,
      maxStake: 0,
      riskAdjustments: {
        kellyAdjustment: 0,
        correlationAdjustment: 0,
        portfolioAdjustment: 0,
        overallAdjustment: 0
      },
      riskAlerts: [],
      warnings: ['Processing failed - using fallback result'],
      expectedSharpe: 0,
      riskAdjustedReturn: 0,
      portfolioImpact: 0,
      processingTime: Date.now() - startTime,
      riskEngineVersion: '1.0.0-fallback',
      scoringEngineVersion: '1.0.0-fallback'
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ScoringIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.riskProfile) {
      this.riskEngine.updateRiskProfile(newConfig.riskProfile);
    }

    this.logger.info('Integration configuration updated', {
      changes: Object.keys(newConfig)
    });
  }

  /**
   * Get integration statistics
   */
  getIntegrationStatistics(): any {
    return {
      ...this.integrationStats,
      approvalRate: this.integrationStats.totalProcessed > 0 ?
        this.integrationStats.riskApproved / this.integrationStats.totalProcessed : 0,
      reductionRate: this.integrationStats.totalProcessed > 0 ?
        this.integrationStats.riskReduced / this.integrationStats.totalProcessed : 0,
      rejectionRate: this.integrationStats.totalProcessed > 0 ?
        this.integrationStats.riskRejected / this.integrationStats.totalProcessed : 0
    };
  }
}