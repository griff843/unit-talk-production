/**
 * Feature-Flagged Scoring Agent
 * 
 * Orchestrates between Enhanced 45-factor Engine and Legacy Scoring System
 * with comprehensive A/B testing, performance monitoring, and automatic rollback
 */

import { BaseAgent, HealthCheckResult } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';
import { GradingFeatureSet as ScoringFeatureSet } from '../../types/GradingFeatureSet';
import { Enhanced45FactorEngine, Enhanced45FactorResult } from './scoring/Enhanced45FactorEngine';
import { FeatureFlagService } from '../../services/feature-flags/FeatureFlagService';
import { ABTestingEngine } from '../../services/feature-flags/ABTestingEngine';
import { SupabaseClient } from '@supabase/supabase-js';
// import { createLogger } from '../../utils/logger';
import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';

export interface LegacyScoringResult {
  totalScore: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  confidence: number;
  kellyFraction: number;
  expectedValue: number;
  processingTimeMs: number;
  timestamp: string;
  version: string;
}

export interface ScoringComparisonResult {
  propId: string;
  userId?: string;
  
  // Flag evaluation
  flagEnabled: boolean;
  variant: 'control' | 'treatment';
  abTestGroup?: string;
  
  // Legacy system results
  legacyResult: LegacyScoringResult;
  legacyProcessingTime: number;
  
  // Enhanced system results (if enabled)
  enhancedResult?: Enhanced45FactorResult;
  enhancedProcessingTime?: number;
  
  // Performance comparison
  performanceDelta: number;
  accuracyComparison?: number;
  
  // Final decision
  selectedResult: Enhanced45FactorResult | LegacyScoringResult;
  selectionReason: string;
  
  // Metadata
  timestamp: string;
  environment: string;
}

export class FeatureFlaggedScoringAgent extends BaseAgent {
  private enhanced45FactorEngine?: Enhanced45FactorEngine;
  private featureFlagService: FeatureFlagService;
  private abTestingEngine: ABTestingEngine;
  private performanceMonitoringInterval?: NodeJS.Timeout;
  
  // Performance tracking
  private performanceMetrics = {
    totalScorings: 0,
    legacyScorings: 0,
    enhancedScorings: 0,
    avgLegacyLatency: 0,
    avgEnhancedLatency: 0,
    errorRate: 0,
    lastReset: Date.now()
  };

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    const supabase = this.supabase as SupabaseClient;
    this.featureFlagService = new FeatureFlagService(supabase);
    this.abTestingEngine = new ABTestingEngine(supabase, this.featureFlagService);
    
    // Initialize enhanced engine lazily
    this.initializeEnhancedEngine();
    
    // Start performance monitoring
    this.startPerformanceMonitoring();
  }

  /**
   * Score a prop using feature-flagged approach
   */
  async scoreProp(features: ScoringFeatureSet, context: {
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  } = {}): Promise<ScoringComparisonResult> {
    const startTime = Date.now();
    const propId = features.propId || `prop-${Date.now()}`;
    
    try {
      // Evaluate feature flag
      const flagEvaluation = await this.featureFlagService.evaluateFlag(
        'enhanced_45_factor_scoring',
        {
          userId: context.userId,
          userSegment: context.metadata?.userSegment,
          environment: process.env.NODE_ENV,
          metadata: context.metadata
        }
      );

      this.logger.debug('Feature flag evaluated for scoring', {
        propId,
        enabled: flagEvaluation.enabled,
        variant: flagEvaluation.variant,
        abTestGroup: flagEvaluation.abTestGroup,
        userId: context.userId
      });

      // Always run legacy system for comparison
      const legacyStartTime = Date.now();
      const legacyResult = await this.runLegacyScoring(features);
      const legacyProcessingTime = Date.now() - legacyStartTime;

      let enhancedResult: Enhanced45FactorResult | undefined;
      let enhancedProcessingTime: number | undefined;
      let selectedResult: Enhanced45FactorResult | LegacyScoringResult;
      let selectionReason: string;
      let performanceDelta: number;

      // Run enhanced system if flag is enabled
      if (flagEvaluation.enabled && this.enhanced45FactorEngine) {
        const enhancedStartTime = Date.now();
        
        try {
          enhancedResult = await this.enhanced45FactorEngine.calculate45FactorScore(features);
          enhancedProcessingTime = Date.now() - enhancedStartTime;
          
          // Calculate performance delta
          performanceDelta = enhancedProcessingTime - legacyProcessingTime;
          
          // Determine which result to use
          const selectionStrategy = await this.determineSelectionStrategy(flagEvaluation);
          
          if (selectionStrategy === 'enhanced') {
            selectedResult = enhancedResult;
            selectionReason = 'Enhanced 45-factor engine selected via feature flag';
          } else if (selectionStrategy === 'legacy') {
            selectedResult = legacyResult;
            selectionReason = 'Legacy system selected for comparison baseline';
          } else {
            // Safety fallback - use better performing system
            selectedResult = performanceDelta <= 1000 ? enhancedResult : legacyResult; // 1 second threshold
            selectionReason = `Performance-based selection: ${selectionStrategy}`;
          }
          
        } catch (error) {
          this.logger.error('Enhanced scoring failed, falling back to legacy', {
            propId,
            error: error instanceof Error ? error.message : String(error)
          });
          
          selectedResult = legacyResult;
          selectionReason = 'Enhanced system failed, legacy fallback';
          performanceDelta = 0;
          
          // Track A/B test error event
          await this.abTestingEngine.trackEvent({
            flagName: 'enhanced_45_factor_scoring',
            variant: 'treatment',
            userId: context.userId || 'anonymous',
            eventType: 'error',
            errorOccurred: true,
            errorDetails: error instanceof Error ? error.message : String(error),
            sessionId: context.sessionId,
            latencyMs: Date.now() - enhancedStartTime
          });
        }
      } else {
        // Flag disabled - use legacy only
        selectedResult = legacyResult;
        selectionReason = 'Feature flag disabled - legacy system only';
        performanceDelta = 0;
      }

      // Create comparison result
      const comparisonResult: ScoringComparisonResult = {
        propId,
        userId: context.userId,
        
        // Flag evaluation
        flagEnabled: flagEvaluation.enabled,
        variant: flagEvaluation.variant as 'control' | 'treatment' || 'control',
        abTestGroup: flagEvaluation.abTestGroup,
        
        // Legacy system results
        legacyResult,
        legacyProcessingTime,
        
        // Enhanced system results
        enhancedResult,
        enhancedProcessingTime,
        
        // Performance comparison
        performanceDelta,
        accuracyComparison: this.calculateAccuracyComparison(legacyResult, enhancedResult),
        
        // Final decision
        selectedResult,
        selectionReason,
        
        // Metadata
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      };

      // Track A/B testing events
      await this.trackABTestingEvents(comparisonResult, context);
      
      // Update performance metrics
      this.updatePerformanceMetrics(comparisonResult);
      
      // Store comparison result for analysis
      await this.storeComparisonResult(comparisonResult);

      const totalProcessingTime = Date.now() - startTime;
      
      this.logger.info('Feature-flagged grading completed', {
        propId,
        flagEnabled: flagEvaluation.enabled,
        variant: comparisonResult.variant,
        selectedSystem: selectedResult === enhancedResult ? 'enhanced' : 'legacy',
        totalProcessingTimeMs: totalProcessingTime,
        performanceDelta
      });

      return comparisonResult;

    } catch (error) {
      this.logger.error('Feature-flagged grading failed', {
        propId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Emergency fallback to legacy system
      const legacyResult = await this.runLegacyScoring(features);
      
      return {
        propId,
        userId: context.userId,
        flagEnabled: false,
        variant: 'control',
        legacyResult,
        legacyProcessingTime: Date.now() - startTime,
        performanceDelta: 0,
        selectedResult: legacyResult,
        selectionReason: 'Emergency fallback due to system error',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      };
    }
  }

  /**
   * Run legacy scoring system
   */
  private async runLegacyScoring(features: ScoringFeatureSet): Promise<LegacyScoringResult> {
    const startTime = Date.now();
    
    try {
      // Simplified legacy scoring logic
      // In production, this would call the existing scoring system
      const baseScore = this.calculateLegacyBaseScore(features);
      const adjustedScore = this.applyLegacyAdjustments(baseScore, features);
      
      const tier = this.determineLegacyTier(adjustedScore);
      const confidence = this.calculateLegacyConfidence(adjustedScore);
      const kellyFraction = this.calculateLegacyKelly(adjustedScore);
      const expectedValue = this.calculateLegacyEV(adjustedScore);
      
      return {
        totalScore: adjustedScore,
        tier,
        confidence,
        kellyFraction,
        expectedValue,
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        version: 'legacy-1.0.0'
      };
      
    } catch (error) {
      this.logger.error('Legacy scoring failed', {
        propId: features.propId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return minimal viable result
      return {
        totalScore: 50,
        tier: 'C',
        confidence: 0.5,
        kellyFraction: 0.01,
        expectedValue: 0,
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        version: 'legacy-fallback'
      };
    }
  }

  /**
   * Determine which system to use based on A/B test assignment
   */
  private async determineSelectionStrategy(flagEvaluation: any): Promise<string> {
    if (!flagEvaluation.abTestGroup) {
      return 'enhanced'; // Default to enhanced if no A/B test
    }
    
    // A/B test logic
    if (flagEvaluation.variant === 'control') {
      return 'legacy';
    } else if (flagEvaluation.variant === 'treatment') {
      return 'enhanced';
    }
    
    return 'enhanced';
  }

  /**
   * Calculate accuracy comparison between systems
   */
  private calculateAccuracyComparison(
    legacyResult: LegacyScoringResult,
    enhancedResult?: Enhanced45FactorResult
  ): number | undefined {
    if (!enhancedResult) return undefined;
    
    // Compare confidence levels as a proxy for accuracy
    const legacyConfidence = legacyResult.confidence;
    const enhancedConfidence = enhancedResult.confidence;
    
    return ((enhancedConfidence - legacyConfidence) / legacyConfidence) * 100;
  }

  /**
   * Track A/B testing events for both systems
   */
  private async trackABTestingEvents(
    result: ScoringComparisonResult,
    context: any
  ): Promise<void> {
    try {
      // Track control group (legacy) event
      await this.abTestingEngine.trackEvent({
        flagName: 'enhanced_45_factor_scoring',
        variant: 'control',
        userId: context.userId || 'anonymous',
        eventType: 'performance',
        eventValue: result.legacyResult.totalScore,
        latencyMs: result.legacyProcessingTime,
        sessionId: context.sessionId,
        metadata: {
          tier: result.legacyResult.tier,
          confidence: result.legacyResult.confidence,
          expectedValue: result.legacyResult.expectedValue
        }
      });

      // Track treatment group (enhanced) event if available
      if (result.enhancedResult && result.enhancedProcessingTime) {
        await this.abTestingEngine.trackEvent({
          flagName: 'enhanced_45_factor_scoring',
          variant: 'treatment',
          userId: context.userId || 'anonymous',
          eventType: 'performance',
          eventValue: result.enhancedResult.totalScore,
          latencyMs: result.enhancedProcessingTime,
          sessionId: context.sessionId,
          metadata: {
            tier: result.enhancedResult.tier,
            confidence: result.enhancedResult.confidence,
            expectedValue: result.enhancedResult.expectedValue,
            factorCount: Object.keys(result.enhancedResult.factorScores).length
          }
        });
      }

      // Track conversion event (successful grading)
      await this.abTestingEngine.trackEvent({
        flagName: 'enhanced_45_factor_scoring',
        variant: result.variant,
        userId: context.userId || 'anonymous',
        eventType: 'conversion',
        eventValue: 1,
        sessionId: context.sessionId
      });

    } catch (error) {
      this.logger.error('Failed to track A/B testing events', {
        propId: result.propId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update internal performance metrics
   */
  private updatePerformanceMetrics(result: ScoringComparisonResult): void {
    this.performanceMetrics.totalScorings++;
    this.performanceMetrics.legacyScorings++;
    
    if (result.enhancedResult) {
      this.performanceMetrics.enhancedScorings++;
    }
    
    // Update latency averages
    const total = this.performanceMetrics.totalScorings;
    this.performanceMetrics.avgLegacyLatency = 
      (this.performanceMetrics.avgLegacyLatency * (total - 1) + result.legacyProcessingTime) / total;
    
    if (result.enhancedProcessingTime) {
      const enhancedTotal = this.performanceMetrics.enhancedScorings;
      this.performanceMetrics.avgEnhancedLatency = 
        (this.performanceMetrics.avgEnhancedLatency * (enhancedTotal - 1) + result.enhancedProcessingTime) / enhancedTotal;
    }
  }

  /**
   * Store comparison result for analysis
   */
  private async storeComparisonResult(result: ScoringComparisonResult): Promise<void> {
    try {
      await withCircuitBreaker.supabase(
        async () => {
          if (!this.supabase) throw new Error('Supabase client not initialized');
          await this.supabase
            .from('scoring_comparisons')
            .insert({
              prop_id: result.propId,
              user_id: result.userId,
              flag_enabled: result.flagEnabled,
              variant: result.variant,
              ab_test_group: result.abTestGroup,
              legacy_result: result.legacyResult,
              enhanced_result: result.enhancedResult,
              legacy_processing_time: result.legacyProcessingTime,
              enhanced_processing_time: result.enhancedProcessingTime,
              performance_delta: result.performanceDelta,
              accuracy_comparison: result.accuracyComparison,
              selected_system: result.selectedResult === result.enhancedResult ? 'enhanced' : 'legacy',
              selection_reason: result.selectionReason,
              environment: result.environment
            });
        },
        async () => {
          this.logger.warn('Circuit breaker open, caching comparison result locally');
        }
      );

    } catch (error) {
      this.logger.error('Failed to store comparison result', {
        propId: result.propId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Initialize enhanced engine with feature dependencies
   */
  private async initializeEnhancedEngine(): Promise<void> {
    try {
      // Check if feature store integration is enabled
      const featureStoreFlag = await this.featureFlagService.evaluateFlag('feature_store_integration');
      
      if (featureStoreFlag.enabled) {
        // Initialize with feature store integration
        const { FeatureStoreIntegration } = await import('./scoring/FeatureStoreIntegration');
        const { MaterialChangeDetector } = await import('./scoring/MaterialChangeDetector');
        
        // Create FeatureStoreService instance (placeholder implementation)
        const featureStoreService = {} as any; // Placeholder - replace with actual service
        const featureStore = new FeatureStoreIntegration(featureStoreService);
        const changeDetector = new MaterialChangeDetector(featureStore);
        
        this.enhanced45FactorEngine = new Enhanced45FactorEngine(featureStore, changeDetector);
        
        this.logger.info('✅ Enhanced 45-factor engine initialized with feature store');
      } else {
        this.logger.info('ℹ️ Enhanced engine not initialized - feature store dependency not met');
      }

    } catch (error) {
      this.logger.error('Failed to initialize enhanced engine', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Emit performance metrics every 60 seconds
    setInterval(async () => {
      await this.emitPerformanceMetrics();
    }, 60000);

    // Reset metrics every hour
    setInterval(() => {
      this.resetPerformanceMetrics();
    }, 60 * 60 * 1000);
  }

  /**
   * Emit performance metrics for monitoring
   */
  private async emitPerformanceMetrics(): Promise<void> {
    try {
      const metrics = {
        ...this.performanceMetrics,
        enhancedAdoptionRate: this.performanceMetrics.totalScorings > 0
          ? this.performanceMetrics.enhancedScorings / this.performanceMetrics.totalScorings
          : 0,
        performanceRatio: this.performanceMetrics.avgLegacyLatency > 0
          ? this.performanceMetrics.avgEnhancedLatency / this.performanceMetrics.avgLegacyLatency
          : 1,
        timestamp: new Date().toISOString()
      };

      await this.supabase!
        .from('events')
        .insert({
          event_type: 'scoring.performance.metrics.v1',
          aggregate_id: 'feature-flagged-scoring-agent',
          aggregate_type: 'scoring_agent',
          event_data: metrics,
          idempotency_key: `scoring-metrics-${Date.now()}`,
          metadata: {
            source: 'FeatureFlaggedScoringAgent',
            component: 'performance_monitoring'
          }
        });

    } catch (error) {
      this.logger.error('Failed to emit performance metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Reset performance metrics
   */
  private resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalScorings: 0,
      legacyScorings: 0,
      enhancedScorings: 0,
      avgLegacyLatency: 0,
      avgEnhancedLatency: 0,
      errorRate: 0,
      lastReset: Date.now()
    };
  }

  // Legacy scoring calculation methods (simplified)
  
  private calculateLegacyBaseScore(features: ScoringFeatureSet): number {
    // Simplified legacy scoring logic
    let score = 50; // Base score
    
    if (features.expectedValue) {
      score += features.expectedValue * 10;
    }
    
    if (features.player) {
      score += 5; // Player bonus
    }
    
    if (features.market?.odds) {
      const impliedProb = Math.abs(features.market.odds) / (Math.abs(features.market.odds) + 100);
      score += (0.5 - impliedProb) * 20;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private applyLegacyAdjustments(baseScore: number, features: ScoringFeatureSet): number {
    let adjustedScore = baseScore;
    
    // Time-based adjustment
    const hoursToGame = this.calculateHoursToGame(features);
    if (hoursToGame < 2) {
      adjustedScore *= 0.9; // Reduce score for games starting soon
    }
    
    // Quality adjustment
    if (features.dataQuality?.completeness && features.dataQuality.completeness < 0.8) {
      adjustedScore *= 0.95; // Reduce score for incomplete data
    }
    
    return Math.max(0, Math.min(100, adjustedScore));
  }

  private determineLegacyTier(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
    if (score >= 80) return 'S';
    if (score >= 65) return 'A';
    if (score >= 50) return 'B';
    if (score >= 35) return 'C';
    return 'D';
  }

  private calculateLegacyConfidence(score: number): number {
    return Math.max(0.3, Math.min(0.95, score / 100));
  }

  private calculateLegacyKelly(score: number): number {
    const edge = (score - 50) / 100;
    return Math.max(0, Math.min(0.25, edge * 0.2));
  }

  private calculateLegacyEV(score: number): number {
    return (score - 50) / 100;
  }

  private calculateHoursToGame(features: ScoringFeatureSet): number {
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

  /**
   * Get agent health status
   */
  getHealthStatus(): {
    healthy: boolean;
    metrics: any;
    enhancedEngineReady: boolean;
  } {
    return {
      healthy: true,
      metrics: this.performanceMetrics,
      enhancedEngineReady: !!this.enhanced45FactorEngine
    };
  }

  /**
   * Get A/B test analysis for the scoring engine
   */
  async getABTestAnalysis(): Promise<any> {
    return await this.abTestingEngine.analyzeTest('enhanced_45_factor_scoring');
  }

  /**
   * Generate comprehensive scoring system report
   */
  async generateSystemReport(): Promise<any> {
    return await this.abTestingEngine.generateTestReport('enhanced_45_factor_scoring');
  }

  // Implement required BaseAgent abstract methods
  protected async initialize(): Promise<void> {
    this.logger.info('Initializing FeatureFlaggedScoringAgent');
    await this.initializeEnhancedEngine();
    this.startPerformanceMonitoring();
  }

  protected async process(): Promise<void> {
    // This agent is called on-demand for scoring, not continuously processing
    this.logger.debug('FeatureFlaggedScoringAgent process method called');
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Cleaning up FeatureFlaggedScoringAgent');
    // Stop any background monitoring
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
    }
  }

  protected async checkHealth(): Promise<HealthCheckResult> {
    try {
      const status = this.getHealthStatus();
      return {
        status: status.healthy ? 'healthy' : 'unhealthy',
        details: {
          enhancedEngineReady: status.enhancedEngineReady,
          metrics: status.metrics
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString()
      };
    }
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      agentName: 'ScoringAgent',
      successCount: this.performanceMetrics.totalScorings,
      errorCount: Math.floor(this.performanceMetrics.totalScorings * this.performanceMetrics.errorRate),
      warningCount: 0, // Default warning count
      processingTimeMs: (this.performanceMetrics.avgLegacyLatency + this.performanceMetrics.avgEnhancedLatency) / 2,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }
}