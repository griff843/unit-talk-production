/* eslint-disable max-lines, max-lines-per-function, complexity, no-undef, no-return-await, no-unused-vars, max-depth, @typescript-eslint/no-unused-vars */
import { randomUUID } from 'crypto';

// SPRINT-044Q: rawPropsWriter imports removed — all compatibility wrappers deleted
import { lifecycleInsert } from '../../lib/lifecycle';
import {
  ProfessionalPropProcessor,
  ProfessionalPropResult,
} from '../../services/ProfessionalPropProcessor';
import { ProjectionEngine, getProjectionEngine } from '../../services/projections';
import { GradingFeatureSet } from '../../types/GradingFeatureSet';
import { BaseAgent } from '../BaseAgent';
import {
  BaseAgentConfig,
  BaseAgentDependencies,
  HealthCheckResult,
  BaseMetrics,
} from '../BaseAgent/types';

import { SyndicateGradingEngine, GradingResult, ScoringConfig } from './scoring/gradingEngine';

import type { Tier } from './scoring/TierScale';
// import { Pick, GradeResult } from './types';
// import { PerformanceAnalyzer } from './scoring/performanceAnalyzer';
// import { RiskManager } from './scoring/riskManager';

interface GradingMetrics extends BaseMetrics {
  picksProcessed: number;
  picksGraded: number;
  avgGradingTimeMs: number;
  tierDistribution: Record<string, number>;
  avgConfidence: number;
  promotedToFinal: number;
  rejectedPicks: number;
  batchSize: number;
  throughputPerMinute: number;
}

export class GradingAgent extends BaseAgent {
  private gradingEngine: SyndicateGradingEngine;
  private professionalProcessor: ProfessionalPropProcessor;
  private projectionEngine: ProjectionEngine;
  // private performanceAnalyzer: PerformanceAnalyzer;
  // private riskManager: RiskManager;
  private gradingMetrics: GradingMetrics;
  private batchProcessor: Map<string, GradingFeatureSet[]> = new Map();
  private readonly BATCH_SIZE = 200; // Increased for better parallel processing
  private readonly BATCH_TIMEOUT_MS = 10000; // Reduced to 10 seconds for faster processing
  private batchTimer?: NodeJS.Timeout;

  // Feature flags
  private readonly USE_PRO_SCORER: boolean;
  private readonly SCORING_DEBUG: boolean;
  private readonly USE_PROJECTIONS: boolean;
  // SPRINT-044D: Data source for grading input (raw_props or provider_offers)
  private readonly GRADING_DATA_SOURCE: string;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    // Initialize feature flags from environment
    this.USE_PRO_SCORER = process.env.USE_PRO_SCORER === 'true';
    this.SCORING_DEBUG = process.env.SCORING_DEBUG === 'true';
    this.USE_PROJECTIONS = process.env.USE_PROJECTIONS !== 'false'; // Enabled by default
    this.GRADING_DATA_SOURCE = process.env.GRADING_DATA_SOURCE || 'provider_offers';

    this.gradingEngine = new SyndicateGradingEngine();
    this.professionalProcessor = ProfessionalPropProcessor.getInstance();
    this.projectionEngine = getProjectionEngine(deps.supabase);
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

    this.gradingMetrics = {
      ...this.metrics,
      picksProcessed: 0,
      picksGraded: 0,
      avgGradingTimeMs: 0,
      tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
      avgConfidence: 0,
      promotedToFinal: 0,
      rejectedPicks: 0,
      batchSize: this.BATCH_SIZE,
      throughputPerMinute: 0,
    };
  }

  async initialize(): Promise<void> {
    this.logger.info(
      '🎯 Initializing GradingAgent with ML scoring engine for v3.0.0 unified database'
    );
    this.logger.info(
      `🔀 Grading path: ${this.USE_PRO_SCORER ? 'PROFESSIONAL' : 'LEGACY'} (USE_PRO_SCORER=${this.USE_PRO_SCORER})`
    );
    this.logger.info(
      `📊 Debug logging: ${this.SCORING_DEBUG ? 'ENABLED' : 'DISABLED'} (SCORING_DEBUG=${this.SCORING_DEBUG})`
    );
    this.logger.info(
      `📈 Projection Engine: ${this.USE_PROJECTIONS ? 'ENABLED' : 'DISABLED'} (USE_PROJECTIONS=${this.USE_PROJECTIONS})`
    );

    // Verify database access
    if (!this.hasSupabase()) {
      throw new Error('Supabase client required for GradingAgent');
    }

    // Test database connectivity for v3.0.0 unified tables only
    // SPRINT-044P: provider_offers is now the default grading source
    const requiredTables = ['provider_offers', 'unified_picks', 'users'];

    for (const table of requiredTables) {
      try {
        const { error } = await this.requireSupabase().from(table).select('id').limit(1);

        if (error) {
          this.logger.warn(`⚠️ Table ${table} access check failed: ${error.message}`);
        } else {
          this.logger.info(`✅ v3.0.0 table ${table} accessible`);
        }
      } catch (err) {
        this.logger.error(`❌ Failed to access v3.0.0 table ${table}`, {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Initialize batch processing timer
    this.startBatchTimer();

    this.logger.info('✅ GradingAgent initialized successfully for v3.0.0 unified database');
  }

  async process(): Promise<void> {
    const startTime = Date.now();
    this.logger.info('🔄 Starting GradingAgent processing cycle');

    try {
      // Fetch pending props for grading
      const pendingProps = await this.fetchPendingProps();

      if (pendingProps.length === 0) {
        this.logger.debug('📭 No pending props found for grading');
        return;
      }

      this.logger.info(`📊 Processing ${pendingProps.length} pending props`);

      // Process in batches for better performance
      const batchResults = await this.processBatched(pendingProps);

      // Update metrics
      this.updateProcessingMetrics(batchResults, Date.now() - startTime);

      this.logger.info(`✅ Grading cycle completed`, {
        totalProcessed: pendingProps.length,
        promoted: batchResults.filter(r => r.tier !== 'D').length,
        avgScore: batchResults.reduce((sum, r) => sum + r.finalScore, 0) / batchResults.length,
        processingTimeMs: Date.now() - startTime,
      });
    } catch (error) {
      this.gradingMetrics.errorCount++;
      this.logger.error('❌ GradingAgent processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up GradingAgent');

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Process any remaining batches
    await this.processRemainingBatches();

    this.logger.info('✅ GradingAgent cleanup completed');
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const checks = [];

    // Database connectivity
    if (this.hasSupabase()) {
      try {
        await this.requireSupabase().from('provider_offers').select('count').limit(1);
        checks.push({ service: 'database', status: 'healthy' });
      } catch (error) {
        checks.push({
          service: 'database',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Grading engine health
    try {
      const configs = this.gradingEngine.getAvailableConfigs();
      checks.push({
        service: 'gradingEngine',
        status: configs.length > 0 ? 'healthy' : 'degraded',
        details: { availableConfigs: configs.length },
      });
    } catch (error) {
      checks.push({
        service: 'gradingEngine',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Performance metrics check
    const errorRate =
      this.gradingMetrics.errorCount / Math.max(1, this.gradingMetrics.picksProcessed);
    const performanceHealthy = errorRate < 0.05 && this.gradingMetrics.avgGradingTimeMs < 5000;

    checks.push({
      service: 'performance',
      status: performanceHealthy ? 'healthy' : 'degraded',
      details: {
        errorRate: Math.round(errorRate * 100) / 100,
        avgGradingTime: this.gradingMetrics.avgGradingTimeMs,
        throughput: this.gradingMetrics.throughputPerMinute,
      },
    });

    const isHealthy = checks.every(check => check.status === 'healthy');

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      details: { checks, metrics: this.gradingMetrics },
    };
  }

  async collectMetrics(): Promise<GradingMetrics> {
    this.gradingMetrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
    return { ...this.gradingMetrics };
  }

  // Enhanced grading methods
  async gradeProp(features: GradingFeatureSet): Promise<GradingResult> {
    const startTime = Date.now();

    try {
      let result: GradingResult;

      // Phase 2: Get projection edge BEFORE grading for independent fair value comparison
      let projectionEdge: number | null = null;
      let projectionConfidence: number | null = null;

      if (this.USE_PROJECTIONS && features.player && features.marketType && features.date) {
        try {
          const projection = await this.projectionEngine.getProjection(
            features.player,
            features.marketType,
            { sport: features.sport, date: features.date }
          );

          if (projection) {
            // Calculate edge: (our projection - market line) / market line
            const marketLine = features.market?.line || 0;
            if (marketLine > 0) {
              projectionEdge = ((projection.projectedLine ?? 0) - marketLine) / marketLine;
              projectionConfidence = projection.confidence;

              this.logger.debug('📈 Projection edge calculated', {
                propId: features.propId,
                player: features.player,
                statType: features.marketType,
                ourProjection: projection.projectedLine,
                marketLine: marketLine,
                projectionEdge: Math.round(projectionEdge * 1000) / 10 + '%',
                confidence: projection.confidence,
              });
            }
          }
        } catch (projError) {
          this.logger.debug('⚠️ Projection lookup failed (non-critical)', {
            propId: features.propId,
            error: projError instanceof Error ? projError.message : 'Unknown error',
          });
        }
      }

      if (this.USE_PRO_SCORER) {
        // PROFESSIONAL PATH: Route through ProfessionalPropProcessor
        this.logger.debug('🎯 Using Professional Scoring Path', {
          propId: features.propId,
          sport: features.sport,
        });

        const proResult = await this.professionalProcessor.processGradingFeatureSet(features);

        // Convert ProfessionalPropResult to GradingResult format
        result = this.convertProfessionalResult(proResult, features);
      } else {
        // LEGACY PATH: Direct to SyndicateGradingEngine (backward compatible)
        this.logger.debug('🔄 Using Legacy Scoring Path', {
          propId: features.propId,
          sport: features.sport,
        });

        result = await this.gradingEngine.gradeProp(features);
      }

      // Phase 2: Apply projection edge adjustment to final score
      if (projectionEdge !== null && projectionConfidence !== null) {
        // Store projection data in result
        result.projectionEdge = projectionEdge;
        result.projectionConfidence = projectionConfidence;

        // Significant edge adjustment (>5% edge with >60% confidence)
        if (Math.abs(projectionEdge) > 0.05 && projectionConfidence > 0.6) {
          const edgeAdjustment = projectionEdge > 0 ? 10 : -10;
          result.finalScore += edgeAdjustment;

          // Recalculate tier if score changed significantly
          if (edgeAdjustment > 0 && result.tier === 'B') {
            result.tier = 'A';
          } else if (edgeAdjustment < 0 && result.tier === 'A') {
            result.tier = 'B';
          }

          this.logger.info('📈 Projection edge applied to grading', {
            propId: features.propId,
            projectionEdge: Math.round(projectionEdge * 100) + '%',
            scoreAdjustment: edgeAdjustment,
            newScore: result.finalScore,
            newTier: result.tier,
          });
        }
      }

      // Update metrics
      this.gradingMetrics.picksGraded++;
      this.gradingMetrics.avgGradingTimeMs =
        (this.gradingMetrics.avgGradingTimeMs + (Date.now() - startTime)) / 2;
      this.gradingMetrics.tierDistribution[result.tier]++;
      this.gradingMetrics.avgConfidence =
        (this.gradingMetrics.avgConfidence + result.confidence) / 2;

      // Store grading result with unifiedPickId for v3.0.0
      await this.storeGradingResult(result);

      // PROFESSIONAL SHARP BETTING PROMOTION CRITERIA
      // Only promote top 1-3% of props with exceptional edge and confidence
      const shouldPromote = this.meetsPromotionCriteria(result);

      if (shouldPromote) {
        await this.promoteToUnifiedPicks(result);
        this.gradingMetrics.promotedToFinal++;
        this.logger.info('🏆 Sharp pick promoted', {
          propId: features.propId,
          tier: result.tier,
          edgeScore: result.edgeScore,
          confidence: result.confidence,
          kelly: result.kellyFraction,
        });
      } else {
        this.gradingMetrics.rejectedPicks++;
      }

      return result;
    } catch (error) {
      this.gradingMetrics.errorCount++;
      this.logger.error('❌ Failed to grade prop', {
        propId: features.propId,
        unifiedPickId: features.unifiedPickId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async gradeProps(propsList: GradingFeatureSet[]): Promise<GradingResult[]> {
    return await this.gradingEngine.gradeProps(propsList);
  }

  // SPRINT-042C: Workflow-critical orchestration methods
  // Called by gradingAndScoringWorkflow via GradingAgentActivitiesImpl

  /**
   * Fetch ungraded props for a league, grade each, return top-tier results.
   * Called by gradingAndScoringWorkflow via Temporal activities.
   */
  async gradeNewProps(params: {
    league: string;
    isLiveMode: boolean;
    cycleCount: number;
  }): Promise<{ league: string; topTierProps: any[]; gradedCount: number }> {
    const { league, isLiveMode } = params;

    if (!this.hasSupabase()) {
      this.logger.warn('Supabase not available for gradeNewProps');
      return { league, topTierProps: [], gradedCount: 0 };
    }

    const limit = isLiveMode ? 500 : 200;

    // SPRINT-046: provider_offers is the only grading source (raw_props branch removed)
    const { data: offers, error } = await this.requireSupabase()
      .from('provider_offers')
      .select('*')
      .is('graded_at', null)
      .ilike('sport_key', `%${league.toLowerCase()}%`)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      this.logger.error('Failed to fetch provider_offers for gradeNewProps', {
        error: error.message,
        league,
      });
      return { league, topTierProps: [], gradedCount: 0 };
    }

    if (!offers || offers.length === 0) {
      this.logger.debug(`No ungraded provider_offers found for ${league}`);
      return { league, topTierProps: [], gradedCount: 0 };
    }

    this.logger.info(`Grading ${offers.length} provider_offers for ${league}`);

    const topTierProps: GradingResult[] = [];
    let gradedCount = 0;

    for (const offer of offers) {
      try {
        const features = this.convertProviderOfferToFeatureSet(offer);
        const result = await this.gradeProp(features);
        gradedCount++;

        // Mark as graded (sets graded_at on provider_offers)
        await this.storeGradingResult(result);

        if (['S', 'A', 'B'].includes(result.tier)) {
          topTierProps.push(result);
        }
      } catch (err) {
        this.logger.debug('Failed to grade provider_offer', {
          offerId: offer.id,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    this.logger.info(
      `Graded ${gradedCount} provider_offers for ${league}, ${topTierProps.length} top-tier`
    );
    return { league, topTierProps, gradedCount };
  }

  /**
   * Score top-tier picks with portfolio-level analysis.
   */
  async scoreTopTierPicks(params: {
    gradedProps: any[];
    league: string;
    cycleCount: number;
  }): Promise<{ league: string; scoredPicks: any[]; scoreCount: number }> {
    const { gradedProps, league, cycleCount } = params;

    const scoredPicks = gradedProps.map(prop => ({
      ...prop,
      scoredAt: new Date().toISOString(),
      cycleCount,
      portfolioScore: prop.finalScore * (prop.confidence / 100),
    }));

    // Sort by portfolio score descending
    scoredPicks.sort((a, b) => (b.portfolioScore || 0) - (a.portfolioScore || 0));

    this.logger.info(`Scored ${scoredPicks.length} top-tier picks for ${league}`);
    return { league, scoredPicks, scoreCount: scoredPicks.length };
  }

  /**
   * Persist scored picks to unified_picks via lifecycle adapter.
   */
  async updateUnifiedPicks(params: {
    scoringResults: any[];
    cycleCount: number;
    timestamp: Date;
  }): Promise<void> {
    const { scoringResults } = params;

    for (const leagueResult of scoringResults) {
      const picks = leagueResult.scoredPicks || [];

      for (const pick of picks) {
        if (this.meetsPromotionCriteria(pick)) {
          try {
            await this.promoteToUnifiedPicks(pick);
          } catch (err) {
            this.logger.error('Failed to promote pick in updateUnifiedPicks', {
              propId: pick.propId,
              error: err instanceof Error ? err.message : 'Unknown',
            });
          }
        }
      }
    }
  }

  /**
   * Get recently created unified_picks for downstream notification.
   */
  async getNewUnifiedPicks(params: { cycleCount: number }): Promise<any[]> {
    if (!this.hasSupabase()) {
      return [];
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data, error } = await this.requireSupabase()
      .from('unified_picks')
      .select('*')
      .gte('created_at', tenMinutesAgo)
      .or('posted_to_discord.is.null,posted_to_discord.eq.false')
      .limit(50);

    if (error) {
      this.logger.error('Failed to fetch new unified picks', { error: error.message });
      return [];
    }

    return data || [];
  }

  /**
   * Convert ProfessionalPropResult to GradingResult format
   */
  private convertProfessionalResult(
    proResult: ProfessionalPropResult,
    features: GradingFeatureSet
  ): GradingResult {
    const insights = proResult.professional_insights || {};

    const result: GradingResult = {
      propId: proResult.pickId,
      finalScore: proResult.professionalScore,
      confidence: proResult.confidence,
      tier: proResult.tier as Tier,
      edgeScore: proResult.devigged_edge * 100,

      featureContributions: (insights.featureContributions as Record<string, number>) || {},
      modelContributions: (insights.modelContributions as Record<string, number>) || {},

      kellyFraction: proResult.kelly_fraction,
      positionSize: Math.max(0.005, proResult.kelly_fraction * 0.25),
      riskScore: (insights.riskScore as number) || 3,
      correlationRisk: (insights.correlationRisk as number) || 0,

      scenarioAnalysis: (insights.scenarioAnalysis as GradingResult['scenarioAnalysis']) || {
        bullCase: { score: proResult.professionalScore * 1.2, probability: 0.3 },
        baseCase: { score: proResult.professionalScore, probability: 0.4 },
        bearCase: { score: proResult.professionalScore * 0.8, probability: 0.3 },
      },

      professionalInsights: {
        steamMoveDetected: false,
        predictedClosingLine: features.market?.line || 0,
        optimalBettingTime: 'professional',
        bestAvailableLine: features.market?.line || 0,
        bestBook: features.book || 'Unknown',
        publicBettingPercentage: 50,
        sharpBettingPercentage: 50,
        contrarianOpportunity: false,
        injuryTimingAdvantage: 0,
        crossMarketArbitrage: 0,
      },
      deviggingResult: {
        originalEdge: proResult.devigged_edge || 0,
        deviggedEdge: proResult.devigged_edge || 0,
        totalVig: 0.05,
        fairOdds: -110,
        trueValue: (proResult.devigged_edge || 0) > 0.02,
      },

      dataQuality: 0.95,
      modelAgreement: 0.85,
      historicalAccuracy: 0.78,
      timestamp: new Date().toISOString(),
      modelVersion: 'professional-v1.0',
      configUsed: 'professional-v1.0',
    };

    return result;
  }

  // High-performance parallel batch processing for instantaneous grading
  private async processBatched(props: GradingFeatureSet[]): Promise<GradingResult[]> {
    const batches = this.createBatches(props, this.BATCH_SIZE);

    // Process all batches in parallel for maximum throughput
    const batchPromises = batches.map(async (batch, index) => {
      try {
        return await this.gradeProps(batch);
      } catch (error) {
        this.logger.error('❌ Batch processing failed', {
          batchIndex: index,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return []; // Return empty array for failed batch
      }
    });

    // Wait for all batches to complete simultaneously
    const batchResults = await Promise.all(batchPromises);

    // Flatten results from all batches
    return batchResults.flat();
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  // SPRINT-046: raw_props branches removed — provider_offers is the only grading source
  private async fetchPendingProps(): Promise<GradingFeatureSet[]> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, returning empty props list');
      return [];
    }

    return this.fetchPendingProviderOffers();
  }

  // SPRINT-044D: Fetch ungraded offers from provider_offers (V3 canonical source)
  private async fetchPendingProviderOffers(): Promise<GradingFeatureSet[]> {
    const { data: offers, error } = await this.requireSupabase()
      .from('provider_offers')
      .select('*')
      .is('graded_at', null)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      this.logger.error('❌ Failed to fetch ungraded provider_offers', {
        error: error.message,
      });
      return [];
    }

    this.logger.info(`🎯 Found ${offers?.length || 0} provider_offers for grading`);
    return offers?.map(offer => this.convertProviderOfferToFeatureSet(offer)) || [];
  }

  // SPRINT-044D: Map provider_offers row to GradingFeatureSet
  private convertProviderOfferToFeatureSet(offer: any): GradingFeatureSet {
    const commenceDate = offer.commence_time
      ? new Date(offer.commence_time).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    return {
      propId: offer.id,
      date: commenceDate,
      sport: offer.sport_key || 'unknown',
      league: offer.sport_key || 'unknown',
      player: offer.provider_participant_id || 'unknown',
      market: {
        type: offer.provider_market_key || 'unknown',
        line: offer.line || 0,
        odds: offer.over_odds || offer.under_odds || 100,
      },
      expectedValue: 0,
      sharpMoney: 50,
      lineMovement: 0,
      matchupRating: 50,
      playerForm: 50,
      marketType: offer.provider_market_key,
      odds: offer.over_odds || offer.under_odds,
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
      timestamp: offer.snapshot_at || offer.created_at || new Date().toISOString(),
      version: '1.0',
      source: 'provider_offers',
      confidence: 50,
      dataQuality: {
        completeness: 0.95,
        outlierScore: 0.95,
        consistencyScore: 0.95,
        dataValidationScore: 0.95,
      },
    };
  }

  private convertUnifiedPickToFeatureSet(unifiedPick: any): GradingFeatureSet {
    // Convert unified pick (with raw_props relation) to GradingFeatureSet format for v3.0.0
    const rawProp = unifiedPick.raw_props;

    return {
      propId: rawProp.id, // Use raw_prop ID for grading identification
      unifiedPickId: unifiedPick.id, // Track the unified pick ID for updates
      date: rawProp.game_date || new Date().toISOString().split('T')[0],
      sport: rawProp.sport || unifiedPick.sport || 'unknown',
      league: rawProp.league || 'unknown',
      player: rawProp.player_name,
      market: {
        type: rawProp.stat_type || 'unknown', // v3.0.0 uses stat_type instead of market_type
        line: rawProp.line || 0,
        odds: unifiedPick.prediction === 'over' ? rawProp.over_odds : rawProp.under_odds || 100,
      },
      // Use existing pick confidence or default to 50
      expectedValue: unifiedPick.confidence * 0.01 || 0, // Convert confidence to EV approximation
      sharpMoney: 50, // Default - could be enhanced with market data
      lineMovement: 0, // Default - could be enhanced with line tracking
      matchupRating: 50, // Default - could be enhanced with matchup analysis
      playerForm: 50, // Default - could be enhanced with player performance data
      marketType: rawProp.stat_type,
      odds: unifiedPick.prediction === 'over' ? rawProp.over_odds : rawProp.under_odds,
      // Add other required fields with defaults
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
      timestamp: unifiedPick.created_at || new Date().toISOString(),
      version: '1.0',
      source: 'unified_picks',
      confidence: unifiedPick.confidence || 50,
      dataQuality: {
        completeness: 0.95,
        outlierScore: 0.95,
        consistencyScore: 0.95,
        dataValidationScore: 0.95,
      },
    };
  }

  private convertToFeatureSet(rawProp: any): GradingFeatureSet {
    // Legacy method - Convert raw database prop to GradingFeatureSet format
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
        odds: rawProp.odds || 100,
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
        dataValidationScore: rawProp.data_validation_score || 0.95,
      },
    };
  }

  private async storeGradingResult(result: GradingResult): Promise<void> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, skipping result storage');
      return;
    }

    try {
      // SPRINT-044Q: provider_offers is now the sole grading storage path
      const { error } = await this.requireSupabase()
        .from('provider_offers')
        .update({ graded_at: new Date().toISOString() })
        .eq('id', result.propId);

      if (error) {
        this.logger.error('❌ Failed to mark provider_offer as graded', {
          propId: result.propId,
          error: error.message,
        });
      } else {
        this.logger.info('✅ Grading result stored (provider_offers)', {
          propId: result.propId,
          tier: result.tier,
          edgeScore: Math.round(result.edgeScore * 1000),
        });
      }
    } catch (error) {
      this.logger.error('❌ Error storing grading result', {
        propId: result.propId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private meetsPromotionCriteria(result: GradingResult): boolean {
    // PROFESSIONAL SHARP BETTING PROMOTION STANDARDS
    // These criteria ensure only the most profitable picks are promoted

    // Rule 1: Edge Score Threshold (minimum 8% edge)
    const MIN_EDGE_SCORE = 800; // 800 basis points = 8% edge
    if (result.edgeScore < MIN_EDGE_SCORE) {
      return false;
    }

    // Rule 2: Ultra-High Confidence Requirement (85%+)
    const MIN_CONFIDENCE = 85; // 85% confidence minimum
    if (result.confidence < MIN_CONFIDENCE) {
      return false;
    }

    // Rule 3: Tier Requirements (S-tier or exceptional A-tier only)
    if (result.tier === 'S') {
      // S-tier props need minimum edge and confidence (already checked above)
      return true;
    } else if (result.tier === 'A') {
      // A-tier props need exceptional edge (12%+) and confidence (90%+)
      return result.edgeScore >= 1200 && result.confidence >= 90;
    } else {
      // B, C, D tier props are never promoted
      return false;
    }
  }

  private async promoteToUnifiedPicks(result: GradingResult): Promise<void> {
    if (!this.hasSupabase()) {
      return;
    }

    try {
      // SPRINT-044I: Route promotion via provider_offers canonical path
      // SPRINT-044Q: raw_props else branch removed (was dead code after 044P default flip)
      await this.promoteFromProviderOffer(result);
    } catch (error) {
      this.logger.error('❌ Error promoting prop to unified_picks', {
        propId: result.propId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * SPRINT-044I: Promote a graded provider_offer to unified_picks.
   * Fetches enrichment data from provider_offers + participants + canonical_events + markets.
   * No raw_props dependency — all context sourced from canonical V3 tables.
   */
  private async promoteFromProviderOffer(result: GradingResult): Promise<void> {
    const supabase = this.requireSupabase();

    // Fetch provider_offer with canonical JOINs (verified live in 044I planning)
    const { data: offer, error: offerError } = await supabase
      .from('provider_offers')
      .select(
        `id, line, over_odds, under_odds, provider_market_key, snapshot_at,
        participants(id, name, meta),
        canonical_events(id, sport, league, scheduled_at),
        markets(stat_type, canonical_key)`
      )
      .eq('id', result.propId)
      .single();

    if (offerError || !offer) {
      this.logger.warn('⚠️ Provider offer not found for promotion', {
        propId: result.propId,
        error: offerError?.message,
      });
      return;
    }

    // Get system user for attribution (same as raw_props path)
    const { data: systemUser } = await supabase.from('users').select('id').limit(1).single();

    if (!systemUser) {
      this.logger.error('❌ No users found in database for promotion');
      return;
    }

    // Extract fields from canonical JOINs
    const participant = offer.participants as any;
    const event = offer.canonical_events as any;
    const market = offer.markets as any;

    const playerName = participant?.meta?.names?.display || participant?.name || 'Unknown Player';
    const statType =
      market?.stat_type ||
      this.extractStatTypeFromMarketKey(offer.provider_market_key) ||
      'unknown';
    const sport = event?.league || event?.sport || 'Unknown';
    const gameDate = event?.scheduled_at
      ? new Date(event.scheduled_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Build pick payload (identical structure to raw_props path)
    const pickSide = (offer.line || 0) > 0 ? 'over' : 'under';
    const selection = `${playerName} ${statType} ${pickSide} ${Math.abs(offer.line || 0)}`;

    const pickId = randomUUID();
    const pickData = {
      id: pickId,
      user_id: systemUser.id,
      selection: selection,
      odds: offer.over_odds || offer.under_odds || -110,
      stake: result.positionSize * 100,
      payout_amount: result.positionSize * 100 * (1 + Math.abs(result.kellyFraction)),
      player_name: playerName,
      stat_type: statType,
      line: offer.line,
      sport: sport,
      game_date: gameDate,
      confidence: result.confidence,
      tier: result.tier,
      kelly_fraction: result.kellyFraction,
      promotion_band: result.promotionBand || null,
      created_at: new Date().toISOString(),
    };

    const { success, error: lifecycleError } = await lifecycleInsert(supabase, pickData as any, {
      writerRole: 'promoter',
    });

    if (!success) {
      this.logger.error('❌ Failed to promote provider_offer to unified_picks', {
        propId: result.propId,
        error: lifecycleError,
      });
    } else {
      this.logger.info('✅ Provider offer promoted to unified_picks', {
        propId: result.propId,
        pickId: pickId,
        playerName,
        statType,
        sport,
        tier: result.tier,
        score: result.finalScore,
        source: 'provider_offers',
      });
    }
  }

  /**
   * SPRINT-044I: Extract stat_type from provider_market_key.
   * SGO format: "assists-DONOVAN_MITCHELL_1_NBA-game-ou" → "assists"
   * Canonical format: "game_rebounds-PLAYER-1q-ou" → "game_rebounds"
   */
  private extractStatTypeFromMarketKey(marketKey: string | null): string | null {
    if (!marketKey) return null;
    const firstSegment = marketKey.split('-')[0];
    return firstSegment || null;
  }

  private updateProcessingMetrics(results: GradingResult[], processingTimeMs: number): void {
    this.gradingMetrics.picksProcessed += results.length;
    this.gradingMetrics.processingTimeMs = processingTimeMs;

    // Calculate throughput
    const throughputPerMs = results.length / processingTimeMs;
    this.gradingMetrics.throughputPerMinute = Math.round(throughputPerMs * 60000);

    this.gradingMetrics.successCount++;
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
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
  }

  // Configuration management
  public updateScoringConfig(configName: string, config: ScoringConfig): void {
    this.gradingEngine.updateScoringConfig(configName, config);
    this.logger.info('📝 Scoring configuration updated', { configName });
  }

  public setActiveConfig(configName: string): void {
    this.gradingEngine.setActiveConfig(configName);
    this.logger.info('🔧 Active scoring configuration changed', { configName });
  }

  public getAvailableConfigs(): string[] {
    return this.gradingEngine.getAvailableConfigs();
  }

  // Performance optimization
  public async optimizeWeights(timeframe: string = '30d'): Promise<void> {
    try {
      const optimizedWeights = await this.gradingEngine.optimizeWeights(timeframe);
      this.logger.info('⚡ Scoring weights optimized', {
        timeframe,
        weightsUpdated: Object.keys(optimizedWeights).length,
      });
    } catch (error) {
      this.logger.error('❌ Failed to optimize weights', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
