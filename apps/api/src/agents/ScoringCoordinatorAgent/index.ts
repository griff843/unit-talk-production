import { randomUUID } from 'crypto';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult, BaseMetrics } from '../BaseAgent/types';
import { ScoringAgent } from '../ScoringAgent';
import { ScoringFeatureSet } from '../../types/ScoringFeatureSet';

export interface ScoringCoordinatorMetrics extends BaseMetrics {
  batchesScored: number;
  totalPropsScored: number;
  averageScoringTimeMs: number;
  enhanced45FactorEnabled: boolean;
  scoringEngineHealth: 'healthy' | 'degraded' | 'unhealthy';
  averageScore: number;
  tierDistribution: Record<string, number>;
  throughputPerMinute: number;
  concurrentBatches: number;
  maxConcurrentBatches: number;
}

export interface ScoringResult {
  propId: string;
  finalScore: number;
  confidence: number;
  tier: string;
  edgeScore: number;
  kellyFraction: number;
  processed: boolean;
  processingTimeMs: number;
  error?: string;
}

/**
 * Scoring Coordinator Agent
 *
 * Responsibilities:
 * - Interface with Enhanced45FactorEngine for 195-factor analysis
 * - Coordinate scoring operations across multiple batches
 * - Optimize scoring performance with parallel processing
 * - Handle scoring failures and retries
 * - Manage Enhanced45Factor feature integration
 */
export class ScoringCoordinatorAgent extends BaseAgent {
  protected metrics: ScoringCoordinatorMetrics;
  private scoringAgent: ScoringAgent;
  private activeBatches: Map<string, { startTime: number; size: number }> = new Map();

  // Configuration
  private readonly MAX_CONCURRENT_BATCHES: number;
  private readonly SCORING_TIMEOUT_MS: number;
  private readonly RETRY_ATTEMPTS: number;

  // Performance tracking
  private recentScoringTimes: number[] = [];
  private readonly MAX_RECENT_TIMES = 50;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    this.MAX_CONCURRENT_BATCHES = parseInt(process.env.SCORING_MAX_CONCURRENT_BATCHES || '3');
    this.SCORING_TIMEOUT_MS = parseInt(process.env.SCORING_TIMEOUT_MS || '60000'); // 60 seconds
    this.RETRY_ATTEMPTS = parseInt(process.env.SCORING_RETRY_ATTEMPTS || '2');

    this.metrics = {
      agentName: this.config.name,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0,
      batchesScored: 0,
      totalPropsScored: 0,
      averageScoringTimeMs: 0,
      enhanced45FactorEnabled: process.env.USE_ENHANCED_45_FACTOR === 'true',
      scoringEngineHealth: 'healthy',
      averageScore: 0,
      tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
      throughputPerMinute: 0,
      concurrentBatches: 0,
      maxConcurrentBatches: this.MAX_CONCURRENT_BATCHES
    };

    // Initialize ScoringAgent
    this.scoringAgent = new ScoringAgent(config, deps);
  }

  async initialize(): Promise<void> {
    this.logger.info('🎯 Initializing Scoring Coordinator Agent', {
      enhanced45FactorEnabled: this.metrics.enhanced45FactorEnabled,
      maxConcurrentBatches: this.MAX_CONCURRENT_BATCHES,
      scoringTimeoutMs: this.SCORING_TIMEOUT_MS
    });

    // Initialize underlying ScoringAgent
    await this.scoringAgent.initialize();

    // Verify Enhanced45Factor system status
    if (this.metrics.enhanced45FactorEnabled) {
      const enhanced45Status = this.scoringAgent.getEnhanced45FactorStatus();
      if (enhanced45Status) {
        this.logger.info('🏆 Enhanced 45-Factor system active', {
          featureStoreHealth: enhanced45Status.featureStoreHealth?.status || 'unknown',
          changeDetectorActive: enhanced45Status.changeDetectorStatus?.active || false
        });
      } else {
        this.logger.warn('⚠️ Enhanced 45-Factor system not available, falling back to standard scoring');
        this.metrics.enhanced45FactorEnabled = false;
      }
    }

    this.logger.info('✅ Scoring Coordinator Agent initialized successfully');
  }

  async process(): Promise<void> {
    // This agent primarily responds to batch scoring requests
    // The process method can be used for maintenance tasks
    await this.performMaintenanceTasks();
  }

  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up Scoring Coordinator Agent');

    // Wait for active batches to complete
    await this.waitForActiveBatches();

    // Cleanup ScoringAgent
    await this.scoringAgent.cleanup();

    this.logger.info('✅ Scoring Coordinator Agent cleanup completed');
  }

  protected async collectMetrics(): Promise<ScoringCoordinatorMetrics> {
    return {
      ...this.metrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
      concurrentBatches: this.activeBatches.size,
      averageScoringTimeMs: this.getAverageScoringTime(),
      throughputPerMinute: this.calculateThroughputPerMinute()
    };
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const checks: Array<{ service: string; status: string; error?: string; details?: any }> = [];

    // Check underlying ScoringAgent health
    const scoringAgentHealth = await this.scoringAgent.checkHealth();
    checks.push({
      service: 'scoringAgent',
      status: scoringAgentHealth.status,
      details: scoringAgentHealth.details
    });

    // Check Enhanced45Factor system if enabled
    if (this.metrics.enhanced45FactorEnabled) {
      const enhanced45Status = this.scoringAgent.getEnhanced45FactorStatus();
      if (enhanced45Status) {
        checks.push({
          service: 'enhanced45Factor',
          status: enhanced45Status.featureStoreHealth ? 'healthy' : 'degraded',
          details: enhanced45Status
        });
      } else {
        checks.push({
          service: 'enhanced45Factor',
          status: 'unhealthy',
          error: 'Enhanced 45-Factor system not available'
        });
      }
    }

    // Check performance metrics
    const avgScoringTime = this.getAverageScoringTime();
    const performanceHealthy = avgScoringTime < 30000 && this.metrics.errorCount < 5;

    checks.push({
      service: 'coordinatorPerformance',
      status: performanceHealthy ? 'healthy' : 'degraded',
      details: {
        avgScoringTimeMs: avgScoringTime,
        activeBatches: this.activeBatches.size,
        throughputPerMinute: this.metrics.throughputPerMinute,
        errorRate: this.metrics.errorCount / Math.max(1, this.metrics.totalPropsScored)
      }
    });

    const isHealthy = checks.every(check => check.status === 'healthy');
    this.metrics.scoringEngineHealth = isHealthy ? 'healthy' : 'degraded';

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      details: { checks, metrics: this.metrics }
    };
  }

  /**
   * Score a batch of props using Enhanced45FactorEngine or standard scoring
   */
  async scoreBatch(props: any[]): Promise<ScoringResult[]> {
    const batchId = randomUUID();
    const startTime = Date.now();

    // Track active batch
    this.activeBatches.set(batchId, { startTime, size: props.length });
    this.metrics.concurrentBatches = this.activeBatches.size;

    try {
      this.logger.info(`🎯 Starting batch scoring ${batchId}`, {
        batchSize: props.length,
        enhanced45Factor: this.metrics.enhanced45FactorEnabled,
        activeBatches: this.activeBatches.size
      });

      // Convert props to ScoringFeatureSet format
      const featureSets = props.map(prop => this.convertToFeatureSet(prop));

      let scoringResults: ScoringResult[] = [];

      // Use Enhanced45Factor batch processing if available
      if (this.metrics.enhanced45FactorEnabled) {
        try {
          const enhanced45Results = await this.scoringAgent.batchProcessEnhanced45Factor(featureSets);
          scoringResults = enhanced45Results.map(result => this.convertToScoringResult(result));

          this.logger.info(`🏆 Enhanced 45-Factor batch scoring completed for ${batchId}`, {
            processed: scoringResults.length,
            avgScore: this.calculateAverageScore(scoringResults),
            tierDistribution: this.calculateTierDistribution(scoringResults)
          });
        } catch (error) {
          this.logger.warn(`⚠️ Enhanced 45-Factor batch failed for ${batchId}, falling back to standard scoring`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          // Fall back to standard scoring
          scoringResults = await this.performStandardBatchScoring(featureSets);
        }
      } else {
        // Use standard batch scoring
        scoringResults = await this.performStandardBatchScoring(featureSets);
      }

      // Update metrics
      this.updateBatchMetrics(batchId, props.length, startTime, scoringResults);

      this.logger.info(`✅ Batch scoring ${batchId} completed`, {
        batchSize: props.length,
        processingTimeMs: Date.now() - startTime,
        avgScore: this.calculateAverageScore(scoringResults),
        promoted: scoringResults.filter(r => r.tier !== 'D').length
      });

      return scoringResults;

    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error(`❌ Batch scoring ${batchId} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        batchSize: props.length
      });

      // Return error results for props
      return props.map(prop => ({
        propId: prop.id,
        finalScore: 0,
        confidence: 0,
        tier: 'D',
        edgeScore: 0,
        kellyFraction: 0,
        processed: false,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));

    } finally {
      this.activeBatches.delete(batchId);
      this.metrics.concurrentBatches = this.activeBatches.size;
    }
  }

  /**
   * Score individual props with retry logic
   */
  async scoreProps(props: any[]): Promise<ScoringResult[]> {
    const results: ScoringResult[] = [];
    const failedProps: any[] = [];

    // Process props individually with retry logic
    for (const prop of props) {
      let attempts = 0;
      let scored = false;

      while (attempts < this.RETRY_ATTEMPTS && !scored) {
        try {
          const featureSet = this.convertToFeatureSet(prop);
          const scoringResult = await this.scoreWithTimeout(featureSet);
          results.push(this.convertToScoringResult(scoringResult));
          scored = true;
        } catch (error) {
          attempts++;
          this.logger.warn(`⚠️ Scoring attempt ${attempts} failed for prop ${prop.id}`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          if (attempts >= this.RETRY_ATTEMPTS) {
            failedProps.push(prop);
            results.push({
              propId: prop.id,
              finalScore: 0,
              confidence: 0,
              tier: 'D',
              edgeScore: 0,
              kellyFraction: 0,
              processed: false,
              processingTimeMs: 0,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }
    }

    if (failedProps.length > 0) {
      this.logger.warn(`⚠️ Failed to score ${failedProps.length} props after ${this.RETRY_ATTEMPTS} attempts`, {
        failedPropIds: failedProps.map(p => p.id).slice(0, 5)
      });
    }

    return results;
  }

  // Private implementation methods

  private async performStandardBatchScoring(featureSets: ScoringFeatureSet[]): Promise<ScoringResult[]> {
    try {
      const results = await this.scoringAgent.scoreProps(featureSets);
      return results.map(result => this.convertToScoringResult(result));
    } catch (error) {
      this.logger.error('❌ Standard batch scoring failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        batchSize: featureSets.length
      });
      throw error;
    }
  }

  private async scoreWithTimeout(featureSet: ScoringFeatureSet): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Scoring timeout after ${this.SCORING_TIMEOUT_MS}ms`));
      }, this.SCORING_TIMEOUT_MS);

      this.scoringAgent.scoreProp(featureSet)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private convertToFeatureSet(rawProp: any): ScoringFeatureSet {
    // Convert raw database prop to ScoringFeatureSet format
    return {
      propId: rawProp.id,
      date: rawProp.date || rawProp.game_date || new Date().toISOString().split('T')[0],
      sport: rawProp.sport || 'unknown',
      league: rawProp.league || 'unknown',
      player: rawProp.player_name,
      market: {
        type: rawProp.stat_type || rawProp.market_type || 'unknown',
        line: rawProp.line || 0,
        odds: rawProp.odds || 100
      },
      expectedValue: rawProp.expected_value || 0,
      sharpMoney: rawProp.sharp_money || 50,
      lineMovement: rawProp.line_movement || 0,
      matchupRating: rawProp.matchup_rating || 50,
      playerForm: rawProp.player_form || 50,
      marketType: rawProp.stat_type || rawProp.market_type,
      odds: rawProp.odds,
      injuryImpact: rawProp.injury_impact || 0,
      weatherImpact: rawProp.weather_impact || 0,
      marketIntelligence: rawProp.market_intelligence || 50,
      volumeProfile: rawProp.volume_profile || 50,
      closingLineValue: rawProp.closing_line_value || 0,
      playerFatigue: rawProp.player_fatigue || 0,
      venueAdvantage: rawProp.venue_advantage || 0,
      refereeImpact: rawProp.referee_impact || 0,
      paceImpact: rawProp.pace_impact || 0,
      motivationalFactors: rawProp.motivational_factors || 0,
      correlationRisk: rawProp.correlation_risk || 0,
      volatility: rawProp.volatility || 5,
      portfolioImpact: rawProp.portfolio_impact || 0,
      bidAskSpread: rawProp.bid_ask_spread || 0.02,
      timestamp: rawProp.created_at || new Date().toISOString(),
      version: '1.0',
      source: 'database',
      confidence: rawProp.confidence || 50,
      dataQuality: {
        completeness: rawProp.data_completeness || 0.95,
        outlierScore: rawProp.outlier_score || 0.95,
        consistencyScore: rawProp.consistency_score || 0.95,
        dataValidationScore: rawProp.data_validation_score || 0.95
      }
    };
  }

  private convertToScoringResult(scoringAgentResult: any): ScoringResult {
    return {
      propId: scoringAgentResult.propId,
      finalScore: scoringAgentResult.finalScore,
      confidence: scoringAgentResult.confidence,
      tier: scoringAgentResult.tier,
      edgeScore: scoringAgentResult.edgeScore,
      kellyFraction: scoringAgentResult.kellyFraction,
      processed: true,
      processingTimeMs: 0 // Will be set by caller
    };
  }

  private updateBatchMetrics(batchId: string, batchSize: number, startTime: number, results: ScoringResult[]): void {
    const processingTime = Date.now() - startTime;

    // Update recent scoring times
    this.recentScoringTimes.push(processingTime);
    if (this.recentScoringTimes.length > this.MAX_RECENT_TIMES) {
      this.recentScoringTimes.shift();
    }

    // Update metrics
    this.metrics.batchesScored++;
    this.metrics.totalPropsScored += batchSize;
    this.metrics.averageScoringTimeMs = this.getAverageScoringTime();
    this.metrics.averageScore = this.calculateAverageScore(results);
    this.metrics.tierDistribution = this.calculateTierDistribution(results);

    // Calculate throughput
    const throughputPerMs = batchSize / processingTime;
    this.metrics.throughputPerMinute = Math.round(throughputPerMs * 60000);

    this.metrics.successCount++;
  }

  private getAverageScoringTime(): number {
    if (this.recentScoringTimes.length === 0) return 0;
    return this.recentScoringTimes.reduce((sum, time) => sum + time, 0) / this.recentScoringTimes.length;
  }

  private calculateAverageScore(results: ScoringResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, result) => sum + result.finalScore, 0) / results.length;
  }

  private calculateTierDistribution(results: ScoringResult[]): Record<string, number> {
    const distribution: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };

    results.forEach(result => {
      distribution[result.tier]++;
    });

    return distribution;
  }

  private async waitForActiveBatches(): Promise<void> {
    const maxWaitMs = 60000; // 60 seconds max wait
    const startTime = Date.now();

    while (this.activeBatches.size > 0 && (Date.now() - startTime) < maxWaitMs) {
      this.logger.info(`⏳ Waiting for ${this.activeBatches.size} active batches to complete`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (this.activeBatches.size > 0) {
      this.logger.warn(`⚠️ Force shutdown with ${this.activeBatches.size} batches still active`);
    }
  }

  private async performMaintenanceTasks(): Promise<void> {
    // Periodic maintenance tasks
    try {
      // Update Enhanced45Factor status
      if (this.metrics.enhanced45FactorEnabled) {
        const enhanced45Status = this.scoringAgent.getEnhanced45FactorStatus();
        if (!enhanced45Status) {
          this.logger.warn('⚠️ Enhanced 45-Factor system became unavailable');
          this.metrics.enhanced45FactorEnabled = false;
        }
      }

      // Clean up old batch tracking data
      const now = Date.now();
      const oldBatches = Array.from(this.activeBatches.entries())
        .filter(([_, batch]) => (now - batch.startTime) > 300000) // 5 minutes old
        .map(([batchId]) => batchId);

      if (oldBatches.length > 0) {
        this.logger.warn(`🧹 Cleaning up ${oldBatches.length} stale batch entries`);
        oldBatches.forEach(batchId => this.activeBatches.delete(batchId));
      }

    } catch (error) {
      this.logger.error('❌ Maintenance tasks failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Public interface methods

  public getScoringMetrics(): ScoringCoordinatorMetrics {
    return { ...this.metrics };
  }

  public getActiveBatchStatus(): {
    activeBatches: number;
    maxConcurrentBatches: number;
    avgScoringTime: number;
    throughputPerMinute: number;
  } {
    return {
      activeBatches: this.activeBatches.size,
      maxConcurrentBatches: this.MAX_CONCURRENT_BATCHES,
      avgScoringTime: this.getAverageScoringTime(),
      throughputPerMinute: this.metrics.throughputPerMinute
    };
  }

  public async updateScoringConfiguration(config: any): Promise<void> {
    this.logger.info('🔧 Updating scoring configuration', config);

    // Update ScoringAgent configuration
    if (config.activeConfig) {
      this.scoringAgent.setActiveConfig(config.activeConfig);
    }

    if (config.scoringConfig) {
      this.scoringAgent.updateScoringConfig(config.configName || 'default', config.scoringConfig);
    }
  }
}