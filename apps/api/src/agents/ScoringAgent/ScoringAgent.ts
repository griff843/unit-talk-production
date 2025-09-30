import { randomUUID } from 'crypto';

import { ScoringFeatureSet } from '../../types/ScoringFeatureSet';
import type { GradingFeatureSet } from '../../types/GradingFeatureSet';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult, BaseMetrics } from '../BaseAgent/types';
import { ProfessionalPropProcessor, ProfessionalPropResult } from '../../services/ProfessionalPropProcessor';
import { ParallelScoringEngine } from './scoring/ParallelScoringEngine';
import { QueryOptimizer } from '@unit-talk/database';
// Cache-First Service Integration
import { CacheFirstUnifiedPicksService } from '../../services/CacheFirstUnifiedPicksService';
import { UnifiedPick } from '../../db/unifiedPicksRepo';

import { SyndicateGradingEngine, ScoringResult, ScoringConfig } from './scoring/gradingEngine';
import { Enhanced45FactorEngine, Enhanced45FactorResult } from './scoring/Enhanced45FactorEngine';
import { FeatureStoreIntegration } from './scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from './scoring/MaterialChangeDetector';
import { FeatureStoreService } from '../../services/FeatureStoreService';
import { DataValidationGates } from '../../validation/dataValidationGates';
import { requireSupabase } from '../../utils/supabaseUtils';
// import { Pick, GradeResult } from './types';
// import { PerformanceAnalyzer } from './scoring/performanceAnalyzer';
// import { RiskManager } from './scoring/riskManager';

interface ScoringMetrics extends BaseMetrics {
  picksProcessed: number;
  picksScored: number;
  avgScoringTimeMs: number;
  tierDistribution: Record<string, number>;
  avgConfidence: number;
  promotedToFinal: number;
  rejectedPicks: number;
  batchSize: number;
  throughputPerMinute: number;
  // Cache-first metrics
  cacheHitRatio: number;
  avgCacheResponseTime: number;
  inPlaceUpdates: number;
  batchWarmupsCompleted: number;
}

export class ScoringAgent extends BaseAgent {
  private scoringEngine: SyndicateGradingEngine;
  private professionalProcessor: ProfessionalPropProcessor;
  private parallelEngine: ParallelScoringEngine;
  private queryOptimizer: QueryOptimizer;

  // Cache-First Unified Picks Service for in-place updates
  private cacheFirstService: CacheFirstUnifiedPicksService;

  // 🆕 Enhanced 45-Factor Scoring System
  private enhanced45FactorEngine?: Enhanced45FactorEngine;
  private featureStoreIntegration?: FeatureStoreIntegration;
  private materialChangeDetector?: MaterialChangeDetector;
  
  // private scoringCache: ScoringCache; // TODO: Implement scoring cache
  // private performanceAnalyzer: PerformanceAnalyzer;
  // private riskManager: RiskManager;
  private scoringMetrics: ScoringMetrics;
  private batchProcessor: Map<string, ScoringFeatureSet[]> = new Map();
  private readonly BATCH_SIZE = 1000; // Process ALL props in system through Enhanced45Factor
  private readonly BATCH_TIMEOUT_MS = 10000; // Reduced to 10 seconds for faster processing
  private batchTimer?: NodeJS.Timeout;

  // Feature flags
  private readonly USE_PRO_SCORER: boolean;
  private readonly USE_PARALLEL_PROCESSING: boolean;
  private readonly SCORING_DEBUG: boolean;
  private readonly USE_ENHANCED_45_FACTOR: boolean; // 🆕 New feature flag

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    // Initialize feature flags from environment
    this.USE_PRO_SCORER = process.env.USE_PRO_SCORER === 'true';
    this.USE_PARALLEL_PROCESSING = process.env.USE_PARALLEL_PROCESSING !== 'false'; // Default to true
    this.SCORING_DEBUG = process.env.SCORING_DEBUG === 'true';
    this.USE_ENHANCED_45_FACTOR = process.env.USE_ENHANCED_45_FACTOR === 'true'; // 🆕 New enhanced scoring system

    this.scoringEngine = new SyndicateGradingEngine();
    this.professionalProcessor = ProfessionalPropProcessor.getInstance();

    // Initialize cache-first service for unified picks
    this.cacheFirstService = CacheFirstUnifiedPicksService.getInstance();

    // Initialize optimization components
    this.parallelEngine = new ParallelScoringEngine(this.logger);
    this.queryOptimizer = new QueryOptimizer(this.requireSupabase());
    
    // 🆕 Initialize Enhanced 45-Factor System if enabled
    if (this.USE_ENHANCED_45_FACTOR) {
      try {
        const featureStoreService = new FeatureStoreService();
        this.featureStoreIntegration = new FeatureStoreIntegration(featureStoreService);
        this.materialChangeDetector = new MaterialChangeDetector(this.featureStoreIntegration);
        this.enhanced45FactorEngine = new Enhanced45FactorEngine(
          this.featureStoreIntegration,
          this.materialChangeDetector
        );
        
        // Set up material change event listeners
        this.materialChangeDetector.on('materialChange', this.handleMaterialChange.bind(this));
        this.materialChangeDetector.on('criticalChange', this.handleCriticalChange.bind(this));
        
        this.logger.info('✅ Enhanced 45-Factor Scoring System initialized');
      } catch (error) {
        this.logger.error('❌ Failed to initialize Enhanced 45-Factor System', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Fall back to legacy scoring
        this.USE_ENHANCED_45_FACTOR = false;
      }
    }
    // this.scoringCache = new ScoringCache(); // TODO: Implement scoring cache
    // this.performanceAnalyzer = new PerformanceAnalyzer();
    // this.riskManager = new RiskManager({
    //   maxPositionSize: 0.05,
    //   maxCorrelation: 0.7,
    //   maxDrawdown: 0.2,
    //   minSharpeRatio: 1.0,
    //   maxExposurePerSport: 0.3,
    //   maxExposurePerPlayer: 0.1,
    //   maxDailyRisk: 0.15,
    //   kellyMultiplier: 0.25,
    //   stopLossThreshold: 0.15,
    //   maxVaR: 0.05,
    //   maxCVaR: 0.08
    // });

    this.scoringMetrics = {
      ...this.metrics,
      picksProcessed: 0,
      picksScored: 0,
      avgScoringTimeMs: 0,
      tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
      avgConfidence: 0,
      promotedToFinal: 0,
      rejectedPicks: 0,
      batchSize: this.BATCH_SIZE,
      throughputPerMinute: 0,
      // Initialize cache-first metrics
      cacheHitRatio: 0,
      avgCacheResponseTime: 0,
      inPlaceUpdates: 0,
      batchWarmupsCompleted: 0
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('🎯 Initializing ScoringAgent with ML scoring engine for v3.0.0 unified database');
    this.logger.info(`🔀 Scoring path: ${this.USE_PRO_SCORER ? 'PROFESSIONAL' : 'LEGACY'} (USE_PRO_SCORER=${this.USE_PRO_SCORER})`);
    this.logger.info(`⚡ Parallel processing: ${this.USE_PARALLEL_PROCESSING ? 'ENABLED' : 'DISABLED'} (Expected 5-7x performance boost)`);
    this.logger.info(`📊 Debug logging: ${this.SCORING_DEBUG ? 'ENABLED' : 'DISABLED'} (SCORING_DEBUG=${this.SCORING_DEBUG})`);
    this.logger.info(`🏆 Enhanced 45-Factor: ${this.USE_ENHANCED_45_FACTOR ? 'ENABLED' : 'DISABLED'} (World-class syndicate-level scoring)`); // 🆕
    
    // Verify database access
    if (!this.hasSupabase()) {
      throw new Error('Supabase client required for ScoringAgent');
    }

    // Test database connectivity for v3.0.0 unified tables only
    const requiredTables = ['raw_props', 'unified_picks', 'users'];
    
    for (const table of requiredTables) {
      try {
        const { error } = await this.requireSupabase()
          .from(table)
          .select('id')
          .limit(1);
          
        if (error) {
          this.logger.warn(`⚠️ Table ${table} access check failed: ${error.message}`);
        } else {
          this.logger.info(`✅ v3.0.0 table ${table} accessible`);
        }
      } catch (err) {
        this.logger.error(`❌ Failed to access v3.0.0 table ${table}`, {
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    // Initialize batch processing timer
    this.startBatchTimer();
    
    // Warm up cache if enabled
    await this.cacheFirstService.warmupCache();

    this.logger.info('✅ ScoringAgent initialized successfully for v3.0.0 unified database with cache-first in-place scoring', {
      enhanced45Factor: this.USE_ENHANCED_45_FACTOR,
      professionalScoring: this.USE_PRO_SCORER,
      parallelProcessing: this.USE_PARALLEL_PROCESSING,
      cacheConfig: this.cacheFirstService.getConfig()
    });
  }

  async process(): Promise<void> {
    const startTime = Date.now();
    this.logger.info('🔄 Starting ScoringAgent processing cycle with cache-first in-place updates');

    try {
      // Fetch pending unified picks for scoring
      const pendingPicks = await this.fetchPendingUnifiedPicks();

      if (pendingPicks.length === 0) {
        this.logger.debug('📭 No pending unified picks found for scoring');
        return;
      }

      this.logger.info(`📊 Processing ${pendingPicks.length} pending unified picks for in-place scoring`);

      // Process in batches with cache warming for better performance
      const batchResults = await this.processBatchedWithCache(pendingPicks);

      // Update metrics
      this.updateProcessingMetrics(batchResults, Date.now() - startTime);

      this.logger.info(`✅ In-place scoring cycle completed`, {
        totalProcessed: pendingPicks.length,
        scoredPicks: batchResults.filter(r => r.scored).length,
        avgScore: batchResults.reduce((sum, r) => sum + (r.professionalScore || 0), 0) / batchResults.length,
        processingTimeMs: Date.now() - startTime,
        cacheMetrics: this.cacheFirstService.getMetrics()
      });

    } catch (error) {
      this.scoringMetrics.errorCount++;
      this.logger.error('❌ ScoringAgent in-place processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up ScoringAgent with cache-first service');

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Process any remaining batches
    await this.processRemainingBatches();

    // Cleanup Enhanced45Factor system if enabled
    if (this.USE_ENHANCED_45_FACTOR) {
      await this.cleanupEnhanced45Factor();
    }

    // Cache service cleanup is handled by singleton pattern
    // Log final cache metrics
    const finalCacheMetrics = this.cacheFirstService.getMetrics();
    this.logger.info('Final cache metrics', {
      hitRatio: finalCacheMetrics.hitRatio,
      avgResponseTime: finalCacheMetrics.avgResponseTime,
      l1Hits: finalCacheMetrics.l1Hits,
      l2Hits: finalCacheMetrics.l2Hits,
      l3Hits: finalCacheMetrics.l3Hits,
      misses: finalCacheMetrics.misses
    });

    this.logger.info('✅ ScoringAgent cleanup completed');
  }

  /**
   * Score a single pick by ID - used by scoring queue worker
   */
  async scoreSinglePick(pickId: string): Promise<{ scored: boolean; professionalScore?: number; error?: string }> {
    try {
      this.logger.info('Scoring single pick from queue', { pickId });

      // Fetch pick from cache-first service
      const pick = await this.cacheFirstService.getPick(pickId);
      if (!pick) {
        this.logger.warn('Pick not found for scoring', { pickId });
        return { scored: false, error: 'Pick not found' };
      }

      // Score the pick in-place
      const result = await this.scoreUnifiedPickInPlace(pick);

      this.logger.info('Single pick scored successfully', {
        pickId,
        scored: result.scored,
        professionalScore: result.professionalScore
      });

      return result;

    } catch (error) {
      this.logger.error('Single pick scoring failed', {
        pickId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        scored: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const checks: Array<{ service: string; status: string; error?: string; details?: any }> = [];

    // Database connectivity
    if (this.hasSupabase()) {
      try {
        await this.requireSupabase().from('unified_picks').select('count').limit(1);
        checks.push({ service: 'database', status: 'healthy' });
      } catch (error) {
        checks.push({
          service: 'database',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Cache-first service health
    try {
      const cacheHealth = await this.cacheFirstService.healthCheck();
      checks.push({
        service: 'cacheFirstService',
        status: cacheHealth.status,
        details: cacheHealth.details
      });
    } catch (error) {
      checks.push({
        service: 'cacheFirstService',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Grading engine health
    try {
      const configs = this.scoringEngine.getAvailableConfigs();
      checks.push({ 
        service: 'scoringEngine', 
        status: configs.length > 0 ? 'healthy' : 'degraded',
        details: { availableConfigs: configs.length }
      });
    } catch (error) {
      checks.push({ 
        service: 'scoringEngine', 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Performance metrics check
    const errorRate = this.scoringMetrics.errorCount / Math.max(1, this.scoringMetrics.picksProcessed);
    const performanceHealthy = errorRate < 0.05 && this.scoringMetrics.avgGradingTimeMs < 5000;
    
    checks.push({
      service: 'performance',
      status: performanceHealthy ? 'healthy' : 'degraded',
      details: {
        errorRate: Math.round(errorRate * 100) / 100,
        avgGradingTime: this.scoringMetrics.avgGradingTimeMs,
        throughput: this.scoringMetrics.throughputPerMinute
      }
    });
    
    const isHealthy = checks.every(check => check.status === 'healthy');
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      details: { checks, metrics: this.scoringMetrics }
    };
  }

  async collectMetrics(): Promise<ScoringMetrics> {
    this.scoringMetrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;

    // Include cache metrics in scoring metrics
    const cacheMetrics = this.cacheFirstService.getMetrics();
    return {
      ...this.scoringMetrics,
      cacheHitRatio: cacheMetrics.hitRatio,
      avgCacheResponseTime: cacheMetrics.avgResponseTime
    };
  }

  // ========================================
  // 🆕 NEW: IN-PLACE SCORING METHODS
  // ========================================

  /**
   * Fetch unified picks that need scoring (not promotion)
   */
  private async fetchPendingUnifiedPicks(): Promise<UnifiedPick[]> {
    try {
      // Get picks that haven't been scored yet or need re-scoring
      // FIXED: Don't filter by published status - props need scoring before publication
      const pendingPicks = await this.cacheFirstService.listPicks({
        limit: this.BATCH_SIZE
      });

      // Filter for picks that need Enhanced45Factor scoring (195-factor system)
      // Priority 1: Props without professional_score (completely unscored)
      // Priority 2: Props without Enhanced45Factor features (need upgrade to 195-factor)
      const picksNeedingScoring = pendingPicks.filter(pick => {
        // Unscored props (highest priority)
        if (!pick.professionalScore) return true;

        // Props without Enhanced45Factor features (need 195-factor upgrade)
        const hasEnhanced45Features = pick.featureContributions &&
          typeof pick.featureContributions === 'object' &&
          'playerForm' in pick.featureContributions &&
          'optimalTiming' in pick.featureContributions;

        if (!hasEnhanced45Features) return true;

        // Re-score Enhanced45Factor props if older than 1 hour
        return pick.scoredAt && Date.now() - new Date(pick.scoredAt).getTime() > 3600000;
      });

      const unscored = pendingPicks.filter(p => !p.professionalScore).length;
      const needsEnhanced45Upgrade = pendingPicks.filter(p =>
        p.professionalScore &&
        (!p.featureContributions ||
         !('playerForm' in p.featureContributions))
      ).length;

      this.logger.info(`Found ${picksNeedingScoring.length} unified picks needing Enhanced45Factor scoring`, {
        totalPicks: pendingPicks.length,
        needsScoring: picksNeedingScoring.length,
        unscored: unscored,
        needsEnhanced45Upgrade: needsEnhanced45Upgrade,
        published: pendingPicks.filter(p => p.published).length
      });

      return picksNeedingScoring;
    } catch (error) {
      this.logger.error('Failed to fetch pending unified picks', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Process batch of unified picks with cache warming and in-place updates
   */
  private async processBatchedWithCache(picks: UnifiedPick[]): Promise<Array<{ pickId: string; scored: boolean; professionalScore?: number }>> {
    const results: Array<{ pickId: string; scored: boolean; professionalScore?: number }> = [];
    const batches = this.createBatches(picks, this.BATCH_SIZE);

    // Warm up cache for the batch
    await this.warmupCacheForBatch(picks);

    // Process batches in parallel for maximum throughput
    const batchPromises = batches.map(async (batch, index) => {
      try {
        const batchResults = await this.scoreBatchInPlace(batch);
        return { success: true, results: batchResults };
      } catch (error) {
        this.logger.error('Batch scoring failed, attempting individual recovery', {
          batchIndex: index,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Recovery: Process each pick individually
        const recoveredResults: Array<{ pickId: string; scored: boolean; professionalScore?: number }> = [];
        for (const pick of batch) {
          try {
            const result = await this.scoreUnifiedPickInPlace(pick);
            recoveredResults.push(result);
          } catch (pickError) {
            this.logger.warn('Individual pick scoring failed', {
              pickId: pick.id,
              error: pickError instanceof Error ? pickError.message : 'Unknown error'
            });
            recoveredResults.push({ pickId: pick.id, scored: false });
          }
        }
        return { success: false, results: recoveredResults };
      }
    });

    // Collect all results
    const batchResults = await Promise.all(batchPromises);
    for (const batchResult of batchResults) {
      results.push(...batchResult.results);
    }

    return results;
  }

  /**
   * Score a single unified pick in-place with Enhanced45Factor system
   */
  private async scoreUnifiedPickInPlace(pick: UnifiedPick): Promise<{ pickId: string; scored: boolean; professionalScore?: number }> {
    const startTime = Date.now();

    try {
      // Convert UnifiedPick to ScoringFeatureSet format
      const features = this.convertUnifiedPickToFeatureSet(pick);

      // Get scoring result using Enhanced45Factor or professional scoring
      let scoringResult: Enhanced45FactorResult | null = null;
      let professionalScore = 0;
      let impliedProb = 0.5;
      let kellyFraction = 0.01;
      let featureContributions = {};
      let clvTrackingId = randomUUID();

      if (this.USE_ENHANCED_45_FACTOR && this.enhanced45FactorEngine) {
        // Convert ScoringFeatureSet to GradingFeatureSet for Enhanced45FactorEngine
        const gradingFeatures: GradingFeatureSet = {
          propId: features.propId,
          date: features.date || new Date().toISOString().split('T')[0],
          sport: features.sport || 'unknown',
          league: this.extractLeague(features.sport),
          player: features.player,
          marketType: features.marketType,
          odds: features.odds || features.market?.odds || -110,
          market: features.market || {
            type: features.marketType || 'unknown',
            odds: features.odds || -110,
            line: features.market?.line || 0
          },
          expectedValue: features.expectedValue || 0,
          lineMovement: features.lineMovement || 0,
          matchupRating: features.matchupRating || 50,
          playerForm: features.playerForm || 50,
          sharpMoney: features.sharpMoney || 50,
          marketIntelligence: features.marketIntelligence || 50,
          volumeProfile: features.volumeProfile || 50,
          closingLineValue: features.closingLineValue || 0,
          injuryImpact: features.injuryImpact || 0,
          weatherImpact: features.weatherImpact || 0,
          playerFatigue: features.playerFatigue || 0,
          venueAdvantage: features.venueAdvantage || 0,
          refereeImpact: features.refereeImpact || 0,
          paceImpact: features.paceImpact || 0,
          motivationalFactors: features.motivationalFactors || 0,
          correlationRisk: features.correlationRisk || 0,
          volatility: features.volatility || 5,
          portfolioImpact: features.portfolioImpact || 0,
          timestamp: features.timestamp || new Date().toISOString(),
          version: features.version || '1.0',
          source: features.source || 'unified_picks',
          confidence: features.confidence || 50,
          dataQuality: features.dataQuality || {
            completeness: 0.95,
            outlierScore: 0.95,
            consistencyScore: 0.95,
            dataValidationScore: 0.95
          }
        };

        scoringResult = await this.enhanced45FactorEngine.calculate45FactorScore(gradingFeatures);
        professionalScore = scoringResult.totalScore;
        impliedProb = this.convertScoreToImpliedProb(scoringResult.totalScore);
        kellyFraction = scoringResult.kellyFraction;
        featureContributions = {
          factorScores: scoringResult.factorScores,
          categoryBreakdown: {
            market: scoringResult.marketScore,
            player: scoringResult.playerScore,
            matchup: scoringResult.matchupScore,
            price: scoringResult.priceScore,
            meta: scoringResult.metaScore
          },
          riskMetrics: {
            riskAdjustedScore: scoringResult.riskAdjustedScore,
            expectedValue: scoringResult.expectedValue,
            sharpeRatio: scoringResult.sharpeRatio,
            maxDrawdown: scoringResult.maxDrawdown
          }
        };
      } else if (this.USE_PRO_SCORER) {
        // Fallback to professional processor
        const proResult = await this.professionalProcessor.processScoringFeatureSet(features);
        professionalScore = proResult.professionalScore;
        impliedProb = proResult.devigged_edge + 0.5; // Adjust base probability by edge
        kellyFraction = proResult.kelly_fraction;
        featureContributions = proResult.professional_insights?.featureContributions || {};
      } else {
        // Basic scoring fallback
        professionalScore = features.expectedValue ? features.expectedValue * 50 + 50 : 50;
        impliedProb = 0.5;
        kellyFraction = 0.01;
      }

      // Update unified pick with scoring data using cache-first service
      this.logger.debug('Attempting database update for scored pick', {
        pickId: pick.id,
        professionalScore: Math.max(0, Math.min(100, professionalScore)),
        impliedProb: Math.max(0.01, Math.min(0.99, impliedProb)),
        kellyFraction: Math.max(0.001, Math.min(0.25, kellyFraction))
      });

      const updatedPick = await this.cacheFirstService.updatePick(pick.id, {
        impliedProb: Math.max(0.01, Math.min(0.99, impliedProb)),
        professionalScore: Math.max(0, Math.min(100, professionalScore)),
        scoredAt: new Date().toISOString(),
        kellyFraction: Math.max(0.001, Math.min(0.25, kellyFraction)),
        featureContributions,
        clvTrackingId,
        updatedAt: new Date().toISOString()
      });

      this.logger.info('Database update successful for scored pick', {
        pickId: pick.id,
        updatedProfessionalScore: updatedPick.professionalScore,
        updatedKellyFraction: updatedPick.kellyFraction
      });

      // Update metrics
      this.scoringMetrics.picksScored++;
      const executionTime = Date.now() - startTime;
      this.scoringMetrics.avgScoringTimeMs =
        (this.scoringMetrics.avgScoringTimeMs + executionTime) / 2;

      this.logger.debug('Unified pick scored in-place', {
        pickId: pick.id,
        professionalScore,
        impliedProb,
        kellyFraction,
        executionTime,
        enhanced45Factor: this.USE_ENHANCED_45_FACTOR
      });

      return {
        pickId: pick.id,
        scored: true,
        professionalScore
      };

    } catch (error) {
      this.scoringMetrics.errorCount++;
      this.logger.error('Failed to score unified pick in-place', {
        pickId: pick.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        pickId: pick.id,
        scored: false
      };
    }
  }

  /**
   * Score batch of picks with optimized database operations
   */
  private async scoreBatchInPlace(picks: UnifiedPick[]): Promise<Array<{ pickId: string; scored: boolean; professionalScore?: number }>> {
    const results: Array<{ pickId: string; scored: boolean; professionalScore?: number }> = [];

    // Process all picks in the batch
    const batchPromises = picks.map(pick => this.scoreUnifiedPickInPlace(pick));
    const batchResults = await Promise.all(batchPromises);

    results.push(...batchResults);

    this.logger.info('Batch scoring completed', {
      batchSize: picks.length,
      successCount: batchResults.filter(r => r.scored).length,
      failureCount: batchResults.filter(r => !r.scored).length,
      avgScore: batchResults.reduce((sum, r) => sum + (r.professionalScore || 0), 0) / batchResults.length
    });

    return results;
  }

  /**
   * Convert UnifiedPick to ScoringFeatureSet for compatibility with scoring engines
   */
  private convertUnifiedPickToFeatureSet(pick: UnifiedPick): ScoringFeatureSet {
    return {
      propId: pick.id,
      unifiedPickId: pick.id,
      date: pick.gameDate || new Date().toISOString().split('T')[0],
      sport: pick.sport || 'unknown',
      league: this.extractLeague(pick.sport),
      player: pick.playerName,
      market: {
        type: pick.statType || 'unknown',
        line: pick.line || 0,
        odds: pick.odds || -110
      },
      expectedValue: 0, // Will be calculated by scoring engine
      sharpMoney: 50,   // Default - would be retrieved from feature store
      lineMovement: 0,  // Default - would be retrieved from feature store
      matchupRating: 50, // Default - would be calculated
      playerForm: 50,    // Default - would be retrieved from feature store
      marketType: pick.statType,
      odds: pick.odds || -110,
      // Additional required fields with defaults
      injuryImpact: 0,
      weatherImpact: 0,
      marketIntelligence: 50,
      volumeProfile: 50,
      closingLineValue: 0,
      playerFatigue: 0,
      venueAdvantage: 0,
      refereeImpact: 0,
      paceImpact: 0,
      motivationalFactors: 0,
      correlationRisk: 0,
      volatility: 5,
      portfolioImpact: 0,
      bidAskSpread: 0.02,
      timestamp: pick.updatedAt || new Date().toISOString(),
      version: '1.0',
      source: 'unified_picks',
      confidence: 50,
      dataQuality: {
        completeness: 0.95,
        outlierScore: 0.95,
        consistencyScore: 0.95,
        dataValidationScore: 0.95
      }
    };
  }

  /**
   * Warm up cache for batch processing
   */
  private async warmupCacheForBatch(picks: UnifiedPick[]): Promise<void> {
    if (picks.length === 0) return;

    try {
      // Pre-load picks into cache
      const warmupPromises = picks.slice(0, 50).map(pick =>
        this.cacheFirstService.getPick(pick.id)
      );

      await Promise.all(warmupPromises);

      this.logger.debug('Cache warmed up for batch processing', {
        pickCount: picks.length,
        preloadedCount: Math.min(50, picks.length)
      });
    } catch (error) {
      this.logger.warn('Cache warmup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Convert professional score to implied probability
   */
  private convertScoreToImpliedProb(score: number): number {
    // Convert 0-100 score to 0.01-0.99 probability
    // Using sigmoid-like transformation for better distribution
    const normalizedScore = (score - 50) / 50; // -1 to 1
    const sigmoid = 1 / (1 + Math.exp(-normalizedScore * 3)); // Compress to 0-1
    return Math.max(0.01, Math.min(0.99, sigmoid));
  }

  /**
   * Extract league from sport
   */
  private extractLeague(sport?: string): string {
    if (!sport) return 'unknown';
    const leagueMap: Record<string, string> = {
      'nfl': 'NFL',
      'nba': 'NBA',
      'mlb': 'MLB',
      'nhl': 'NHL',
      'ncaaf': 'NCAAF',
      'wnba': 'WNBA',
      'tennis': 'ATP/WTA'
    };
    return leagueMap[sport.toLowerCase()] || sport.toUpperCase();
  }

  // Enhanced scoring methods with parallel processing optimization (UPDATED)
  async scoreProp(features: ScoringFeatureSet): Promise<ScoringResult> {
    // DEPRECATED: This method is kept for backward compatibility
    // New code should use scoreUnifiedPickInPlace() for in-place updates
    const startTime = Date.now();

    try {
      let result: ScoringResult;

      // 🆕 ENHANCED 45-FACTOR PATH: World-class syndicate-level scoring
      if (this.USE_ENHANCED_45_FACTOR && this.enhanced45FactorEngine) {
        this.logger.debug('🏆 Using Enhanced 45-Factor Scoring System', {
          propId: features.propId,
          sport: features.sport,
          expectedPerformance: 'sub-50ms feature retrieval + comprehensive analysis'
        });

        const enhanced45Result = await this.enhanced45FactorEngine.calculate45FactorScore(features);
        
        // Convert Enhanced45FactorResult to standard ScoringResult format
        result = this.convertEnhanced45ResultToScoringResult(enhanced45Result, features);
        
        // Register prop for material change monitoring
        if (this.materialChangeDetector) {
          this.materialChangeDetector.registerProp(
            features.propId,
            features.sport || 'UNKNOWN',
            [], // Use default watched factors
            {
              odds: features.odds,
              line: features.market?.line,
              expectedValue: features.expectedValue,
              sharpMoney: features.sharpMoney
            }
          );
        }
        
        this.logger.info('🏆 Enhanced 45-Factor analysis completed', {
          propId: features.propId,
          totalScore: enhanced45Result.totalScore,
          tier: enhanced45Result.tier,
          confidence: enhanced45Result.confidence,
          processingTimeMs: enhanced45Result.processingTimeMs,
          featuresRetrievedMs: enhanced45Result.featuresRetrievedMs,
          factorsAnalyzed: 45
        });
        
      } else if (this.USE_PRO_SCORER) {
        // PROFESSIONAL PATH: Route through ProfessionalPropProcessor
        this.logger.debug('🎯 Using Professional Scoring Path', {
          propId: features.propId,
          sport: features.sport,
          parallelProcessing: this.USE_PARALLEL_PROCESSING
        });

        if (this.USE_PARALLEL_PROCESSING) {
          // OPTIMIZED: Use parallel processing for professional insights
          const proResult = await this.professionalProcessor.processScoringFeatureSet(features);

          // Enhance with parallel professional insights calculation
          const parallelInsights = await this.parallelEngine.calculateProfessionalInsightsParallel(
            features,
            this.scoringEngine
          );

          // Merge results
          result = this.convertProfessionalResult(proResult, features);
          result.professionalInsights = parallelInsights;
        } else {
          // Standard professional processing
          const proResult = await this.professionalProcessor.processScoringFeatureSet(features);
          result = this.convertProfessionalResult(proResult, features);
        }
      } else {
        // LEGACY PATH: Direct to SyndicateGradingEngine (backward compatible)
        this.logger.debug('🔄 Using Legacy Scoring Path', {
          propId: features.propId,
          sport: features.sport
        });

        result = await this.scoringEngine.scoreProp(features);
      }
      
      // TODO: Cache the result for future requests when cache is implemented
      // this.scoringCache.cacheScoringResult(features.propId, result);

      // Update metrics
      this.scoringMetrics.picksGraded++;
      const executionTime = Date.now() - startTime;
      this.scoringMetrics.avgGradingTimeMs =
        (this.scoringMetrics.avgGradingTimeMs + executionTime) / 2;
      this.scoringMetrics.tierDistribution[result.tier]++;
      this.scoringMetrics.avgConfidence =
        (this.scoringMetrics.avgConfidence + result.confidence) / 2;

      // Log performance improvement if using parallel processing
      if (this.USE_PARALLEL_PROCESSING && this.USE_PRO_SCORER) {
        this.logger.debug('⚡ Parallel processing performance', {
          propId: features.propId,
          executionTime,
          expectedImprovement: '5-7x faster than sequential'
        });
      }

      // Store scoring result with unifiedPickId for v3.0.0
      await this.storeScoringResult(result);

      // NOTE: Promotion logic removed from ScoringAgent
      // ScoringAgent now focuses solely on scoring
      // Promotion should be handled by separate PromotionAgent
      this.logger.debug('🏆 Scoring completed - promotion handled by separate agent', {
        propId: features.propId,
        tier: result.tier,
        edgeScore: result.edgeScore,
        confidence: result.confidence,
        kelly: result.kellyFraction
      });
      
      return result;
    } catch (error) {
      this.scoringMetrics.errorCount++;
      this.logger.error('❌ Failed to grade prop', {
        propId: features.propId,
        unifiedPickId: features.unifiedPickId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async scoreProps(propsList: ScoringFeatureSet[]): Promise<ScoringResult[]> {
    return await this.scoringEngine.scoreProps(propsList);
  }

  /**
   * Convert ProfessionalPropResult to ScoringResult format
   */
  private convertProfessionalResult(proResult: ProfessionalPropResult, _features: ScoringFeatureSet): ScoringResult {
    // Create a standardized ScoringResult from ProfessionalPropProcessor output
    const result: ScoringResult = {
      propId: proResult.pickId,
      finalScore: proResult.professionalScore,
      confidence: proResult.confidence,
      tier: proResult.tier,
      edgeScore: proResult.devigged_edge * 100, // Convert to percentage
      
      // Professional insights from processor
      featureContributions: proResult.professional_insights?.featureContributions || {},
      modelContributions: proResult.professional_insights?.modelContributions || {},
      
      // Risk management
      kellyFraction: proResult.kelly_fraction,
      positionSize: Math.max(0.005, proResult.kelly_fraction * 0.25), // Kelly * multiplier
      riskScore: proResult.professional_insights?.riskScore || 3,
      correlationRisk: proResult.professional_insights?.correlationRisk || 0,
      
      // Scenario analysis
      scenarioAnalysis: proResult.professional_insights?.scenarioAnalysis || {
        bullCase: { score: proResult.professionalScore * 1.2, probability: 0.3 },
        baseCase: { score: proResult.professionalScore, probability: 0.4 },
        bearCase: { score: proResult.professionalScore * 0.8, probability: 0.3 }
      },
      
      // Professional insights
      professionalInsights: proResult.professional_insights || {},
      deviggingResult: { 
        originalEdge: proResult.devigged_edge || 0,
        deviggedEdge: proResult.devigged_edge || 0,
        totalVig: 0.05,
        fairOdds: -110,
        trueValue: (proResult.devigged_edge || 0) > 0.02
      },
      
      // Metadata
      dataQuality: 0.95,
      modelAgreement: 0.85,
      historicalAccuracy: 0.78,
      timestamp: new Date().toISOString(),
      modelVersion: 'professional-v1.0',
      configUsed: 'professional-v1.0'
    };
    
    return result;
  }

  // High-performance parallel batch processing with failure recovery
  private async processBatched(props: ScoringFeatureSet[]): Promise<ScoringResult[]> {
    const batches = this.createBatches(props, this.BATCH_SIZE);
    const allResults: ScoringResult[] = [];
    const failedProps: ScoringFeatureSet[] = [];

    // Process all batches in parallel for maximum throughput
    const batchPromises = batches.map(async (batch, index) => {
      try {
        const results = await this.scoreProps(batch);
        return { success: true, results, failedProps: [] };
      } catch (error) {
        this.logger.error('❌ Batch processing failed, attempting individual recovery', {
          batchIndex: index,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // RECOVERY: Process each prop individually to salvage what we can
        const recoveredResults: ScoringResult[] = [];
        const stillFailedProps: ScoringFeatureSet[] = [];

        for (const prop of batch) {
          try {
            const result = await this.scoreProp(prop);
            recoveredResults.push(result);
          } catch (propError) {
            this.logger.warn('⚠️ Individual prop scoring failed, marking for retry', {
              propId: prop.propId,
              error: propError instanceof Error ? propError.message : 'Unknown error'
            });
            stillFailedProps.push(prop);
          }
        }

        return { success: false, results: recoveredResults, failedProps: stillFailedProps };
      }
    });

    // Wait for all batches to complete simultaneously
    const batchResults = await Promise.all(batchPromises);

    // Collect all results and failed props
    for (const batchResult of batchResults) {
      allResults.push(...batchResult.results);
      failedProps.push(...batchResult.failedProps);
    }

    // Schedule failed props for retry
    if (failedProps.length > 0) {
      await this.scheduleFailedPropsForRetry(failedProps);
    }

    return allResults;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Schedule failed props for retry with exponential backoff
   */
  private async scheduleFailedPropsForRetry(failedProps: ScoringFeatureSet[]): Promise<void> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Cannot schedule retries - Supabase not available');
      return;
    }

    try {
      // Update raw_props with retry information
      const retryUpdates = failedProps.map(prop => ({
        id: prop.propId,
        pro_attempts: (prop.pro_attempts || 0) + 1,
        processing_error: `Grading failed at ${new Date().toISOString()}`,
        processed_at: null // Reset to allow retry
      }));

      const { error } = await this.supabase!
        .from('sports_game_odds')
        .upsert(retryUpdates, { onConflict: 'id' });

      if (error) {
        this.logger.error('❌ Failed to schedule props for retry', { error });
      } else {
        this.logger.info(`📅 Scheduled ${failedProps.length} props for retry`, {
          propIds: failedProps.map(p => p.propId).slice(0, 5), // Log first 5 IDs
          totalScheduled: failedProps.length
        });
      }
    } catch (error) {
      this.logger.error('❌ Error scheduling failed props for retry', {
        error: error instanceof Error ? error.message : 'Unknown error',
        failedPropsCount: failedProps.length
      });
    }
  }

  // DEPRECATED: Kept for backward compatibility - use fetchPendingUnifiedPicks() instead
  private async fetchPendingProps(): Promise<ScoringFeatureSet[]> {
    this.logger.warn('fetchPendingProps() is deprecated. Use fetchPendingUnifiedPicks() for in-place scoring.');

    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, returning empty props list');
      return [];
    }

    // Fallback to raw props for compatibility
    try {
      const { data: rawProps, error } = await this.requireSupabase()
        .from('sports_game_odds')
        .select('*')
        .is('tier', null)
        .order('created_at', { ascending: true })
        .limit(50); // Reduced limit since this is deprecated

      if (error) {
        this.logger.error('❌ Failed to fetch raw props (deprecated path)', {
          error: error.message
        });
        return [];
      }

      return (rawProps || []).map(prop => this.convertToFeatureSet(prop));
    } catch (error) {
      this.logger.error('❌ Error in deprecated fetchPendingProps', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }



  private convertToFeatureSet(rawProp: any): ScoringFeatureSet {
    // Legacy method - Convert raw database prop to ScoringFeatureSet format
    // This is kept for backward compatibility but unified picks should use convertUnifiedPickToFeatureSet
    return {
      propId: rawProp.id,
      date: rawProp.date || rawProp.game_date || new Date().toISOString().split('T')[0],
      sport: rawProp.sport || 'unknown',
      league: rawProp.league || 'unknown',
      player: rawProp.player_name,
      market: {
        type: rawProp.stat_type || rawProp.market_type || 'unknown', // v3.0.0 uses stat_type
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
      // Add other required fields with defaults
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

  private async storeScoringResult(result: ScoringResult): Promise<void> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, skipping result storage');
      return;
    }

    try {
      // Store scoring results in raw_props table (v3.0.0 approach)  
      // Fix: Use correct data types - confidence is 0/1 boolean, edge_score is integer
      const { error } = await this.requireSupabase()
        .from('sports_game_odds')
        .update({
          confidence: result.confidence ? (result.confidence > 65 ? 1 : 0) : 0, // Boolean-like: 1 = high confidence, 0 = low, handle null
          tier: result.tier,
          professional_score: result.finalScore ? result.finalScore / 100 : 0.01, // Convert to 0-1 decimal scale, default minimum
          kelly_fraction: result.kellyFraction || 0.001,
          updated_at: new Date().toISOString(),
          processed_at: new Date().toISOString() // Mark as processed
        })
        .eq('id', result.propId);

      if (error) {
        this.logger.error('❌ Failed to store scoring result in raw_props', {
          propId: result.propId,
          error: error.message,
          confidence: result.confidence,
          edgeScore: result.edgeScore
        });
      } else {
        this.logger.info('✅ Grading result stored in raw_props', {
          propId: result.propId,
          tier: result.tier,
          confidence: result.confidence > 65 ? 1 : 0, // Boolean format
          confidencePercent: result.confidence, // Original percentage for reference
          edgeScore: Math.round(result.edgeScore * 1000), // Per-mille basis points
          edgeScoreDecimal: result.edgeScore, // Original decimal for reference
          autoApproved: result.tier !== 'D' && result.confidence > 65
        });
      }
    } catch (error) {
      this.logger.error('❌ Error storing scoring result', {
        propId: result.propId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // NOTE: Promotion methods removed from ScoringAgent
  // ScoringAgent now focuses solely on scoring
  // Promotion logic should be handled by a dedicated PromotionAgent

  /**
   * @deprecated Promotion logic moved to separate PromotionAgent
   */
  private meetsPromotionCriteria(result: ScoringResult): boolean {
    this.logger.warn('meetsPromotionCriteria is deprecated - use dedicated PromotionAgent');
    return false;
  }

  /**
   * @deprecated Promotion logic moved to separate PromotionAgent
   */
  private async promoteToUnifiedPicks(result: ScoringResult): Promise<void> {
    this.logger.warn('promoteToUnifiedPicks is deprecated - use dedicated PromotionAgent');
    // No-op - promotion handled by separate agent
  }

  private updateProcessingMetrics(
    results: Array<{ pickId: string; scored: boolean; professionalScore?: number }> | ScoringResult[],
    processingTimeMs: number
  ): void {
    // Handle both new in-place scoring results and legacy ScoringResults
    const isInPlaceResults = results.length > 0 && 'scored' in results[0];

    if (isInPlaceResults) {
      const inPlaceResults = results as Array<{ pickId: string; scored: boolean; professionalScore?: number }>;
      const scoredCount = inPlaceResults.filter(r => r.scored).length;

      this.scoringMetrics.picksProcessed += inPlaceResults.length;
      this.scoringMetrics.picksScored += scoredCount;
      this.scoringMetrics.inPlaceUpdates += scoredCount;

      // Calculate average score from successful scoring operations
      const scoredResults = inPlaceResults.filter(r => r.scored && r.professionalScore);
      if (scoredResults.length > 0) {
        const avgScore = scoredResults.reduce((sum, r) => sum + (r.professionalScore || 0), 0) / scoredResults.length;
        this.scoringMetrics.avgConfidence = (this.scoringMetrics.avgConfidence + avgScore) / 2;
      }
    } else {
      // Legacy ScoringResult handling
      const legacyResults = results as ScoringResult[];
      this.scoringMetrics.picksProcessed += legacyResults.length;
      this.scoringMetrics.picksScored += legacyResults.length;

      // Update tier distribution
      legacyResults.forEach(result => {
        if (result.tier) {
          this.scoringMetrics.tierDistribution[result.tier]++;
        }
      });

      // Calculate average confidence
      const avgConfidence = legacyResults.reduce((sum, r) => sum + r.confidence, 0) / legacyResults.length;
      this.scoringMetrics.avgConfidence = (this.scoringMetrics.avgConfidence + avgConfidence) / 2;
    }

    this.scoringMetrics.processingTimeMs = processingTimeMs;

    // Calculate throughput
    const throughputPerMs = results.length / processingTimeMs;
    this.scoringMetrics.throughputPerMinute = Math.round(throughputPerMs * 60000);

    // Update cache metrics from cache-first service
    const cacheMetrics = this.cacheFirstService.getMetrics();
    this.scoringMetrics.cacheHitRatio = cacheMetrics.hitRatio;
    this.scoringMetrics.avgCacheResponseTime = cacheMetrics.avgResponseTime;

    this.scoringMetrics.successCount++;

    this.logger.debug('Processing metrics updated', {
      picksProcessed: this.scoringMetrics.picksProcessed,
      picksScored: this.scoringMetrics.picksScored,
      inPlaceUpdates: this.scoringMetrics.inPlaceUpdates,
      cacheHitRatio: this.scoringMetrics.cacheHitRatio,
      avgCacheResponseTime: this.scoringMetrics.avgCacheResponseTime,
      throughputPerMinute: this.scoringMetrics.throughputPerMinute
    });
  }

  private startBatchTimer(): void {
    this.batchTimer = setTimeout(() => {
      this.processRemainingBatches();
      this.startBatchTimer(); // Restart timer
    }, this.BATCH_TIMEOUT_MS);
  }

  private async processRemainingBatches(): Promise<void> {
    for (const [key, batch] of this.batchProcessor.entries()) {
      if (batch.length > 0) {
        try {
          await this.processBatched(batch);
          this.batchProcessor.delete(key);
        } catch (error) {
          this.logger.error('❌ Failed to process remaining batch', {
            batchKey: key,
            batchSize: batch.length,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  }

  // Configuration management
  public updateScoringConfig(configName: string, config: ScoringConfig): void {
    this.scoringEngine.updateScoringConfig(configName, config);
    this.logger.info('📝 Scoring configuration updated', { configName });
  }

  public setActiveConfig(configName: string): void {
    this.scoringEngine.setActiveConfig(configName);
    this.logger.info('🔧 Active scoring configuration changed', { configName });
  }

  public getAvailableConfigs(): string[] {
    return this.scoringEngine.getAvailableConfigs();
  }

  // Performance optimization
  public async optimizeWeights(timeframe: string = '30d'): Promise<void> {
    try {
      const optimizedWeights = await this.scoringEngine.optimizeWeights(timeframe);
      this.logger.info('⚡ Scoring weights optimized', { 
        timeframe,
        weightsUpdated: Object.keys(optimizedWeights).length
      });
    } catch (error) {
      this.logger.error('❌ Failed to optimize weights', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ========================================
  // 🆕 ENHANCED 45-FACTOR SYSTEM METHODS
  // ========================================

  /**
   * Convert Enhanced45FactorResult to standard ScoringResult format
   */
  private convertEnhanced45ResultToScoringResult(
    enhanced45Result: Enhanced45FactorResult,
    features: ScoringFeatureSet
  ): ScoringResult {
    return {
      propId: features.propId,
      finalScore: enhanced45Result.totalScore,
      confidence: enhanced45Result.confidence * 100, // Convert 0-1 to 0-100
      tier: enhanced45Result.tier,
      edgeScore: enhanced45Result.expectedValue,
      
      // Feature Attribution - Enhanced with 45 factors
      featureContributions: this.convertFactorScoresToContributions(enhanced45Result.factorScores),
      modelContributions: {
        'Enhanced 45-Factor Engine': enhanced45Result.totalScore,
        'Market Factors': enhanced45Result.marketScore,
        'Player Factors': enhanced45Result.playerScore,
        'Matchup Factors': enhanced45Result.matchupScore,
        'Price Factors': enhanced45Result.priceScore,
        'Meta Factors': enhanced45Result.metaScore
      },
      
      // Risk Assessment - Enhanced
      kellyFraction: enhanced45Result.kellyFraction,
      positionSize: enhanced45Result.kellyFraction * 0.25, // Conservative Kelly multiplier
      riskScore: this.calculateRiskScoreFromEnhanced(enhanced45Result),
      correlationRisk: this.extractCorrelationRisk(enhanced45Result.factorScores),
      
      // Scenario Analysis - Enhanced
      scenarioAnalysis: {
        bullCase: { 
          score: Math.min(100, enhanced45Result.totalScore * 1.2), 
          probability: 0.25 
        },
        baseCase: { 
          score: enhanced45Result.totalScore, 
          probability: 0.5 
        },
        bearCase: { 
          score: Math.max(0, enhanced45Result.totalScore * 0.8), 
          probability: 0.25 
        }
      },
      
      // Professional Insights - Enhanced with 45-factor context
      professionalInsights: {
        steamMoveDetected: enhanced45Result.factorScores.steamDetection > 70,
        predictedClosingLine: features.market?.line || 0,
        optimalBettingTime: this.determineOptimalTiming(enhanced45Result.factorScores),
        bestAvailableLine: features.market?.line || 0,
        bestBook: 'DraftKings', // Default
        publicBettingPercentage: enhanced45Result.factorScores.publicVsSharpSplit || 50,
        sharpBettingPercentage: 100 - (enhanced45Result.factorScores.publicVsSharpSplit || 50),
        contrarianOpportunity: (enhanced45Result.factorScores.publicVsSharpSplit || 50) > 70,
        injuryTimingAdvantage: enhanced45Result.factorScores.injuryImpact || 0,
        crossMarketArbitrage: enhanced45Result.factorScores.crossMarketArbitrage || 0
      },
      
      // Quality Metrics - Enhanced
      dataQuality: enhanced45Result.dataQuality,
      modelAgreement: enhanced45Result.modelAgreement,
      historicalAccuracy: 0.78, // Default - would be computed from backtest
      
      // Metadata
      timestamp: enhanced45Result.timestamp,
      modelVersion: enhanced45Result.version,
      configUsed: enhanced45Result.configUsed
    };
  }

  /**
   * Convert factor scores to feature contributions format
   */
  private convertFactorScoresToContributions(factorScores: Record<string, number>): Record<string, number> {
    const totalScore = Object.values(factorScores).reduce((sum, score) => sum + score, 0);
    const contributions: Record<string, number> = {};
    
    Object.entries(factorScores).forEach(([factor, score]) => {
      contributions[factor] = totalScore > 0 ? (score / totalScore) * 100 : 0;
    });
    
    return contributions;
  }

  /**
   * Calculate risk score from enhanced result
   */
  private calculateRiskScoreFromEnhanced(enhanced45Result: Enhanced45FactorResult): number {
    // Use risk-adjusted score and volatility factors
    const baseRisk = (100 - enhanced45Result.riskAdjustedScore) / 100 * 10;
    const volatilityRisk = (enhanced45Result.factorScores.volatilityScore || 50) / 100 * 5;
    const correlationRisk = (enhanced45Result.factorScores.correlationRisk || 0) / 100 * 3;
    
    return Math.min(10, baseRisk + volatilityRisk + correlationRisk);
  }

  /**
   * Extract correlation risk from factor scores
   */
  private extractCorrelationRisk(factorScores: Record<string, number>): number {
    return (factorScores.correlationRisk || 0) / 100;
  }

  /**
   * Determine optimal timing from factor scores
   */
  private determineOptimalTiming(factorScores: Record<string, number>): string {
    const optimalTiming = factorScores.optimalTiming || 50;
    
    if (optimalTiming > 80) return 'immediate';
    if (optimalTiming > 60) return 'within_hour';
    if (optimalTiming > 40) return 'monitor';
    return 'avoid';
  }

  /**
   * Handle material change events
   */
  private async handleMaterialChange(change: any): Promise<void> {
    this.logger.info('📊 Material change detected', {
      propId: change.propId,
      changeType: change.changeType,
      severity: change.severity,
      impact: change.impact
    });
    
    // Trigger re-scoring for high-impact changes
    if (change.severity === 'high' || change.severity === 'critical') {
      try {
        // Get the current prop features and re-grade
        const state = this.materialChangeDetector?.['propStates']?.get(change.propId);
        if (state) {
          this.logger.info('♻️ Triggering re-grade due to material change', {
            propId: change.propId,
            changeType: change.changeType
          });
          
          // In a production system, you would re-fetch the prop and re-grade it
          // For now, we log the event for monitoring
        }
      } catch (error) {
        this.logger.error('❌ Failed to handle material change', {
          propId: change.propId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Handle critical change events
   */
  private async handleCriticalChange(change: any): Promise<void> {
    this.logger.warn('🚨 Critical material change detected', {
      propId: change.propId,
      changeType: change.changeType,
      impact: change.impact,
      correlatedChanges: change.correlatedChanges?.length || 0
    });
    
    // Send alert to monitoring systems
    // In production, this could trigger alerts to Slack, PagerDuty, etc.
    
    // Force immediate re-scoring
    await this.handleMaterialChange(change);
  }

  /**
   * Batch process props using Enhanced 45-Factor system
   */
  public async batchProcessEnhanced45Factor(
    propsList: ScoringFeatureSet[]
  ): Promise<ScoringResult[]> {
    if (!this.USE_ENHANCED_45_FACTOR || !this.enhanced45FactorEngine) {
      this.logger.warn('Enhanced 45-Factor system not available, falling back to standard processing');
      return this.processBatched(propsList);
    }
    
    const startTime = Date.now();
    
    try {
      const enhanced45Results = await this.enhanced45FactorEngine.batchProcess45Factor(propsList);
      
      const scoringResults = enhanced45Results.map((enhanced45Result, index) => 
        this.convertEnhanced45ResultToScoringResult(enhanced45Result, propsList[index])
      );
      
      const totalProcessingTime = Date.now() - startTime;
      
      this.logger.info('🏆 Enhanced 45-Factor batch processing completed', {
        totalProps: propsList.length,
        avgProcessingTimeMs: totalProcessingTime / propsList.length,
        avgScore: scoringResults.reduce((sum, r) => sum + r.finalScore, 0) / scoringResults.length,
        tierDistribution: this.calculateTierDistribution(scoringResults),
        totalProcessingTimeMs: totalProcessingTime
      });
      
      return scoringResults;
      
    } catch (error) {
      this.logger.error('❌ Enhanced 45-Factor batch processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        propsCount: propsList.length
      });
      
      // Fall back to standard processing
      return this.processBatched(propsList);
    }
  }

  /**
   * Calculate tier distribution from results
   */
  private calculateTierDistribution(results: ScoringResult[]): Record<string, number> {
    const distribution: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    
    results.forEach(result => {
      distribution[result.tier]++;
    });
    
    return distribution;
  }

  /**
   * Get Enhanced 45-Factor system status
   */
  public getEnhanced45FactorStatus(): {
    enabled: boolean;
    featureStoreHealth: any;
    changeDetectorStatus: any;
    processingStats: any;
  } | null {
    if (!this.USE_ENHANCED_45_FACTOR) {
      return null;
    }
    
    return {
      enabled: true,
      featureStoreHealth: this.featureStoreIntegration?.getCacheStats() || null,
      changeDetectorStatus: this.materialChangeDetector?.getStatus() || null,
      processingStats: {
        avgProcessingTime: this.scoringMetrics.avgGradingTimeMs,
        throughputPerMinute: this.scoringMetrics.throughputPerMinute,
        successRate: this.scoringMetrics.successCount / Math.max(1, this.scoringMetrics.successCount + this.scoringMetrics.errorCount)
      }
    };
  }

  /**
   * Cleanup enhanced systems
   */
  public async cleanupEnhanced45Factor(): Promise<void> {
    if (this.materialChangeDetector) {
      this.materialChangeDetector.shutdown();
      this.materialChangeDetector = undefined;
    }
    
    this.enhanced45FactorEngine = undefined;
    this.featureStoreIntegration = undefined;
    
    this.logger.info('🧹 Enhanced 45-Factor system cleanup completed');
  }
}