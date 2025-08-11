import { randomUUID } from 'crypto';

import { GradingFeatureSet } from '../../types/GradingFeatureSet';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult, BaseMetrics } from '../BaseAgent/types';
import { ProfessionalPropProcessor, ProfessionalPropResult } from '../../services/ProfessionalPropProcessor';

import { SyndicateGradingEngine, GradingResult, ScoringConfig } from './scoring/gradingEngine';
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

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    
    // Initialize feature flags from environment
    this.USE_PRO_SCORER = process.env.USE_PRO_SCORER === 'true';
    this.SCORING_DEBUG = process.env.SCORING_DEBUG === 'true';
    
    this.gradingEngine = new SyndicateGradingEngine();
    this.professionalProcessor = ProfessionalPropProcessor.getInstance();
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
      throughputPerMinute: 0
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('🎯 Initializing GradingAgent with ML scoring engine for v3.0.0 unified database');
    this.logger.info(`🔀 Grading path: ${this.USE_PRO_SCORER ? 'PROFESSIONAL' : 'LEGACY'} (USE_PRO_SCORER=${this.USE_PRO_SCORER})`);
    this.logger.info(`📊 Debug logging: ${this.SCORING_DEBUG ? 'ENABLED' : 'DISABLED'} (SCORING_DEBUG=${this.SCORING_DEBUG})`);
    
    // Verify database access
    if (!this.hasSupabase()) {
      throw new Error('Supabase client required for GradingAgent');
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
        processingTimeMs: Date.now() - startTime
      });
      
    } catch (error) {
      this.gradingMetrics.errorCount++;
      this.logger.error('❌ GradingAgent processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
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
        await this.requireSupabase().from('raw_props').select('count').limit(1);
        checks.push({ service: 'database', status: 'healthy' });
      } catch (error) {
        checks.push({ 
          service: 'database', 
          status: 'unhealthy', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    // Grading engine health
    try {
      const configs = this.gradingEngine.getAvailableConfigs();
      checks.push({ 
        service: 'gradingEngine', 
        status: configs.length > 0 ? 'healthy' : 'degraded',
        details: { availableConfigs: configs.length }
      });
    } catch (error) {
      checks.push({ 
        service: 'gradingEngine', 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Performance metrics check
    const errorRate = this.gradingMetrics.errorCount / Math.max(1, this.gradingMetrics.picksProcessed);
    const performanceHealthy = errorRate < 0.05 && this.gradingMetrics.avgGradingTimeMs < 5000;
    
    checks.push({
      service: 'performance',
      status: performanceHealthy ? 'healthy' : 'degraded',
      details: {
        errorRate: Math.round(errorRate * 100) / 100,
        avgGradingTime: this.gradingMetrics.avgGradingTimeMs,
        throughput: this.gradingMetrics.throughputPerMinute
      }
    });
    
    const isHealthy = checks.every(check => check.status === 'healthy');
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      details: { checks, metrics: this.gradingMetrics }
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
      
      if (this.USE_PRO_SCORER) {
        // PROFESSIONAL PATH: Route through ProfessionalPropProcessor
        this.logger.debug('🎯 Using Professional Scoring Path', { 
          propId: features.propId, 
          sport: features.sport 
        });
        
        const proResult = await this.professionalProcessor.processGradingFeatureSet(features);
        
        // Convert ProfessionalPropResult to GradingResult format
        result = this.convertProfessionalResult(proResult, features);
      } else {
        // LEGACY PATH: Direct to SyndicateGradingEngine (backward compatible)
        this.logger.debug('🔄 Using Legacy Scoring Path', { 
          propId: features.propId, 
          sport: features.sport 
        });
        
        result = await this.gradingEngine.gradeProp(features);
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
          kelly: result.kellyFraction
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
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async gradeProps(propsList: GradingFeatureSet[]): Promise<GradingResult[]> {
    return await this.gradingEngine.gradeProps(propsList);
  }

  /**
   * Convert ProfessionalPropResult to GradingResult format
   */
  private convertProfessionalResult(proResult: ProfessionalPropResult, features: GradingFeatureSet): GradingResult {
    // Create a standardized GradingResult from ProfessionalPropProcessor output
    const result: GradingResult = {
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
          error: error instanceof Error ? error.message : 'Unknown error'
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

  private async fetchPendingProps(): Promise<GradingFeatureSet[]> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, returning empty props list');
      return [];
    }

    if (this.USE_PRO_SCORER) {
      // PROFESSIONAL PATH: Query unprocessed raw_props (processed_at IS NULL)
      const { data: rawProps, error } = await this.requireSupabase()
        .from('raw_props')
        .select('*')
        .is('processed_at', null)  // Props that haven't been professionally processed yet
        .order('created_at', { ascending: true })
        .limit(200); // Reasonable limit for processing

      if (error) {
        this.logger.error('❌ Failed to fetch unprocessed props for professional grading', {
          error: error.message
        });
        return [];
      }

      this.logger.info(`🎯 Found ${rawProps?.length || 0} props for professional processing`);
      return rawProps?.map(prop => this.convertToFeatureSet(prop)) || [];

    } else {
      // LEGACY PATH: Grade props from raw_props that haven't been grading_status yet
      const { data: rawProps, error } = await this.requireSupabase()
        .from('raw_props')
        .select('*')
        .is('tier', null)  // Props that haven't been grading_status yet (tier is null)
        .or('promoted_to_picks.is.null,promoted_to_picks.eq.false')  // Props not yet promoted (null or false)
        .order('created_at', { ascending: true })
        .limit(200); // Reasonable limit for processing

      if (error) {
        this.logger.error('❌ Failed to fetch pending props for legacy grading', {
          error: error.message
        });
        return [];
      }

      return rawProps?.map(prop => this.convertToFeatureSet(prop)) || [];
    }
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
        odds: unifiedPick.prediction === 'over' ? rawProp.over_odds : rawProp.under_odds || 100
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
        dataValidationScore: 0.95
      }
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

  private async storeGradingResult(result: GradingResult): Promise<void> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, skipping result storage');
      return;
    }

    try {
      // Store grading results in raw_props table (v3.0.0 approach)  
      // Fix: Use correct data types - confidence is 0/1 boolean, edge_score is integer
      const { error } = await this.requireSupabase()
        .from('raw_props')
        .update({
          confidence: result.confidence > 65 ? 1 : 0, // Boolean-like: 1 = high confidence, 0 = low
          tier: result.tier,
          edge_score: Math.round(result.edgeScore * 1000), // Convert to integer (per-mille basis points)
          auto_approved: result.tier !== 'D' && result.confidence > 65,
          updated_at: new Date().toISOString(),
          promoted_to_picks: false // Mark as not yet promoted
        })
        .eq('id', result.propId);

      if (error) {
        this.logger.error('❌ Failed to store grading result in raw_props', {
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
      this.logger.error('❌ Error storing grading result', {
        propId: result.propId,
        error: error instanceof Error ? error.message : 'Unknown error'
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
      // Get the original prop data from raw_props
      const { data: prop } = await this.requireSupabase()
        .from('raw_props')
        .select('*')
        .eq('id', result.propId)
        .single();

      if (!prop) {
        this.logger.warn('⚠️ Original prop not found for promotion', {
          propId: result.propId
        });
        return;
      }

      // Get a default user_id for system-grading_status picks
      const { data: systemUser } = await this.requireSupabase()
        .from('users')
        .select('id')
        .limit(1)
        .single();

      if (!systemUser) {
        this.logger.error('❌ No users found in database for promotion');
        return;
      }

      // Create the pick selection text
      const pickSide = prop.line > 0 ? 'over' : 'under';
      const selection = `${prop.player_name} ${prop.stat_type} ${pickSide} ${Math.abs(prop.line)}`;

      // Insert into unified_picks with actual v3.0.0 schema
      const { error } = await this.requireSupabase()
        .from('unified_picks')
        .insert({
          id: randomUUID(),
          user_id: systemUser.id,
          pick_type: 'parlay', // Valid pick_type from schema analysis
          selection: selection,
          odds: prop.odds || prop.over_odds || -110,
          stake: result.positionSize * 100, // Convert position size to dollar stake
          potential_payout: (result.positionSize * 100) * (1 + Math.abs(result.kellyFraction)),
          player_name: prop.player_name,
          stat_type: prop.stat_type,
          line: prop.line,
          over_odds: prop.over_odds,
          under_odds: prop.under_odds,
          sport: prop.sport || 'Unknown',
          game_date: prop.game_date,
          confidence: result.confidence,
          tier_when_placed: result.tier,
          kelly_bet_size: result.kellyFraction,
          created_at: new Date().toISOString()
        });

      if (error) {
        this.logger.error('❌ Failed to promote prop to unified_picks', {
          propId: result.propId,
          error: error.message
        });
      } else {
        this.logger.info('✅ Prop promoted to unified_picks', {
          propId: result.propId,
          tier: result.tier,
          score: result.finalScore
        });

        // Mark raw_props as promoted
        await this.requireSupabase()
          .from('raw_props')
          .update({ 
            promoted_to_picks: true,
            promoted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', result.propId);
      }
    } catch (error) {
      this.logger.error('❌ Error promoting prop to unified_picks', {
        propId: result.propId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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
            error: error instanceof Error ? error.message : 'Unknown error'
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
        weightsUpdated: Object.keys(optimizedWeights).length
      });
    } catch (error) {
      this.logger.error('❌ Failed to optimize weights', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}