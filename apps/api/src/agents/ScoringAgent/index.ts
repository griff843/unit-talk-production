// src/agents/ScoringAgent/index.ts
import 'dotenv/config';
import { scorePropEdge } from '../../logic/scoring/edgeScoring';
import { PropObject } from '../../types/propTypes';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, AgentMetrics, HealthCheckResult } from '../BaseAgent/types';
import { OnlineScoringService, ScoringRequest } from '../../ml/OnlineScoringService';
import { FeatureStore } from '../../ml/FeatureStore';
import { RedisCache } from '../../services/cache/RedisCache';

export default class ScoringAgent extends BaseAgent {
  private mlScoringService: OnlineScoringService | null = null;
  private featureStore: FeatureStore | null = null;
  private cache: RedisCache | null = null;
  private shadowModeEnabled: boolean;
  private deploymentStage: string;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    
    // Shadow mode configuration from environment
    this.shadowModeEnabled = process.env.ML_SHADOW_MODE_ENABLED === 'true';
    this.deploymentStage = process.env.ML_DEPLOYMENT_STAGE || 'stage1'; // stage1 (shadow), stage2 (canary), stage3 (production)
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🚀 ScoringAgent initializing...', {
      shadowModeEnabled: this.shadowModeEnabled,
      deploymentStage: this.deploymentStage
    });
    
    // Initialize ML scoring service if shadow mode is enabled
    if (this.shadowModeEnabled && this.hasSupabase()) {
      try {
        // Initialize Redis cache
        this.cache = new RedisCache({
          url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
          ttl: {
            playerMetadata: 300,
            teamMetadata: 300, 
            oddsLines: 300,
            gameSchedules: 300,
            userProfiles: 300,
            default: 300,
          },
          maxRetries: 3,
          retryDelay: 1000,
        });

        // Initialize feature store
        this.featureStore = new FeatureStore(this.requireSupabase(), this.cache);

        // Initialize ML scoring service
        this.mlScoringService = new OnlineScoringService(
          this.requireSupabase(),
          this.cache,
          this.featureStore,
          {
            modelPath: process.env.ML_MODEL_PATH || './ml/models',
            maxLatencyMs: parseInt(process.env.ML_MAX_LATENCY_MS || '20'),
            batchSize: parseInt(process.env.ML_BATCH_SIZE || '10'),
            circuitBreakerThreshold: parseInt(process.env.ML_CIRCUIT_BREAKER_THRESHOLD || '5'),
            fallbackToHeuristic: true,
            cacheEnabled: true,
            cacheTtlMs: parseInt(process.env.ML_CACHE_TTL_MS || '300000'), // 5 minutes
          }
        );

        await this.mlScoringService.initialize();
        this.logger.info('✅ ML Shadow Mode initialized successfully');

      } catch (error) {
        this.logger.warn('⚠️ Failed to initialize ML Shadow Mode:', error);
        // Continue without ML shadow mode
        this.shadowModeEnabled = false;
      }
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 ScoringAgent cleanup starting...');
    
    // Cleanup ML scoring service
    if (this.mlScoringService) {
      await this.mlScoringService.shutdown();
    }
    
    // Cleanup cache connection
    if (this.cache) {
      await this.cache.disconnect();
    }
    
    this.logger.info('✅ ScoringAgent cleanup complete');
  }

  public async checkHealth(): Promise<HealthCheckResult> {
    try {
      if (!this.hasSupabase()) {
        return {
          status: 'unhealthy',
          details: { error: 'Supabase client not available' }
        };
      }

      // Test database connection
      const { error } = await this.requireSupabase()
        .from('raw_props')
        .select('id')
        .limit(1);

      if (error) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          details: { database: error.message }
        };
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: { database: 'connected' }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: { err: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  protected async collectMetrics(): Promise<AgentMetrics> {
    try {
      if (!this.hasSupabase()) {
        return {
          ...this.metrics,
          errorCount: 1,
          successCount: 0,
        };
      }

      // Get scoring statistics from the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: scoringStats } = await this.requireSupabase()
        .from('raw_props')
        .select('edge_score, tier, updated_at')
        .gte('updated_at', oneHourAgo);

      const totalProcessed = scoringStats?.length || 0;
      const successCount = scoringStats?.filter(s => s.edge_score !== null).length || 0;
      const errorCount = totalProcessed - successCount;

      const baseMetrics = this.metrics || {
        agentName: this.config.name,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        processingTimeMs: 0,
        memoryUsageMb: 0
      };

      return {
        agentName: this.config.name,
        successCount,
        errorCount,
        warningCount: 0,
        processingTimeMs: baseMetrics.processingTimeMs || 0,
        memoryUsageMb: baseMetrics.memoryUsageMb || 0
      };
    } catch (error) {
      this.logger.error('Failed to collect metrics', {
        err: error instanceof Error ? error.message : 'Unknown error'
      });
      const baseMetrics = this.metrics || {
        agentName: this.config.name,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        processingTimeMs: 0,
        memoryUsageMb: 0
      };

      return {
        ...baseMetrics,
        agentName: this.config.name,
        successCount: 0,
        errorCount: 1,
        warningCount: 0,
        processingTimeMs: baseMetrics.processingTimeMs || 0,
        memoryUsageMb: baseMetrics.memoryUsageMb || 0
      };
    }
  }

  protected async process(): Promise<void> {
    const logger = this.logger;

    logger.info("🔍 Scanning raw_props for props needing scoring...");

    if (!this.hasSupabase()) {
      logger.error("❌ Supabase client not available, cannot fetch props");
      return;
    }

    const { data: propsToScore, error } = await this.requireSupabase()
      .from("raw_props")
      .select("*")
      .is("edge_score", null)
      .limit(100);

    if (error) {
      logger.error("❌ Failed to fetch props:", {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }

    if (!propsToScore || propsToScore.length === 0) {
      logger.info("✅ No unscored props found. Exiting.");
      return;
    }

    logger.info(`📊 Scoring ${propsToScore.length} props...`);

    let successCount = 0;
    let errorCount = 0;

    for (const rawProp of propsToScore) {
      try {
        const prop = rawProp as PropObject;
        
        // Run production heuristic scoring
        const result = scorePropEdge(prop);

        // Run ML shadow scoring if enabled (parallel, non-blocking)
        if (this.shadowModeEnabled && this.mlScoringService) {
          this.runShadowMLScoring(prop, result).catch(error => {
            logger.warn('⚠️ Shadow ML scoring failed (non-blocking):', { 
              propId: rawProp.id, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          });
        }

        const update = {
          edge_score: result.edge_score,
          tier: result.tier,
          context_tags: result.context_tags,
          edge_breakdown: result.edge_breakdown,
          is_postable: ["S", "A"].includes(result.tier),
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await this.requireSupabase()
          .from("raw_props")
          .update(update)
          .eq("id", rawProp.id);

        if (updateError) {
          throw updateError;
        }

        if (["S", "A"].includes(result.tier)) {
          logger.info(`🚀 Promoting ${prop['player_name']} (${prop['market_type']}) to daily_picks`);

          const insert = {
            ...prop,
            ...update,
            source: prop['source'] || "SGO",
            approved: true,
            created_at: new Date().toISOString(),
            promoted_by: "ScoringAgent",
          };

          const { error: insertError } = await this.requireSupabase()
            .from("daily_picks")
            .insert([insert]);

          if (insertError) {
            logger.warn(`⚠️ Failed to promote prop ID ${rawProp.id} to daily_picks:`, { error: insertError });
          }
        }

        successCount++;
      } catch (err) {
        errorCount++;
        logger.error(`❌ Failed to process prop ID ${rawProp.id}:`, {
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    logger.info(`✅ Scoring completed: ${successCount} successful, ${errorCount} errors`);
  }

  /**
   * Run ML scoring in shadow mode (parallel, non-blocking)
   * Logs predictions to ml_shadow_predictions table for validation
   */
  private async runShadowMLScoring(prop: PropObject, heuristicResult: any): Promise<void> {
    if (!this.mlScoringService || !this.hasSupabase()) {
      return;
    }

    try {
      const startTime = Date.now();

      // Extract features from prop for ML scoring
      const features = this.extractMLFeatures(prop);

      // Create ML scoring request
      const scoringRequest: ScoringRequest = {
        propId: prop.id?.toString() || `prop_${Date.now()}`,
        features,
        requireLatency: 20, // 20ms max for shadow mode
      };

      // Get ML prediction
      const mlResponse = await this.mlScoringService.score(scoringRequest);
      
      const predictionLatency = Date.now() - startTime;

      // Log shadow prediction to database for validation
      await this.logShadowPrediction({
        propId: scoringRequest.propId,
        rawPropId: prop.id as string,
        mlPrediction: mlResponse.prediction,
        mlConfidence: mlResponse.confidence,
        heuristicPrediction: heuristicResult.edge_score,
        modelVersion: mlResponse.modelVersion,
        modelFeatures: mlResponse.features,
        predictionLatencyMs: predictionLatency,
        fromCache: mlResponse.fromCache,
        fallbackUsed: mlResponse.fallbackUsed,
        productionScore: heuristicResult.edge_score,
        productionTier: heuristicResult.tier,
        sport: prop.sport as string,
        marketType: prop.market_type as string,
        playerName: prop.player_name as string,
        gameDate: prop.game_date ? new Date(prop.game_date as string) : null,
      });

      this.logger.debug('🔍 Shadow ML prediction logged', {
        propId: scoringRequest.propId,
        mlPrediction: mlResponse.prediction,
        heuristicScore: heuristicResult.edge_score,
        discrepancy: Math.abs(mlResponse.prediction - heuristicResult.edge_score),
        latencyMs: predictionLatency,
        fromCache: mlResponse.fromCache,
      });

    } catch (error) {
      // Log shadow prediction error
      await this.logShadowPredictionError(prop, error);
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Extract ML features from prop object
   */
  private extractMLFeatures(prop: PropObject): Record<string, any> {
    return {
      // Market features
      line: prop.line,
      over_odds: prop.over_odds,
      under_odds: prop.under_odds,
      
      // Player features
      player_name: prop.player_name,
      position: prop.position,
      team: prop.team,
      
      // Game context
      opponent: prop.opponent,
      home_away: prop.home_away,
      game_date: prop.game_date,
      
      // Market type
      market_type: prop.market_type,
      stat_type: prop.stat_type,
      
      // Sport
      sport: prop.sport,
      league: prop.league,
      
      // Additional context
      weather: prop.weather,
      injury_status: prop.injury_status,
      
      // Timing features
      created_at: prop.created_at,
      updated_at: prop.updated_at,
      
      // Any additional numeric features that might exist
      season_avg: (prop as any).season_avg,
      last_5_avg: (prop as any).last_5_avg,
      vs_opponent_avg: (prop as any).vs_opponent_avg,
      home_vs_away_diff: (prop as any).home_vs_away_diff,
    };
  }

  /**
   * Log shadow prediction to database
   */
  private async logShadowPrediction(data: {
    propId: string;
    rawPropId: string;
    mlPrediction: number;
    mlConfidence: number;
    heuristicPrediction: number;
    modelVersion: string;
    modelFeatures: Record<string, any>;
    predictionLatencyMs: number;
    fromCache: boolean;
    fallbackUsed: boolean;
    productionScore: number;
    productionTier: string;
    sport: string;
    marketType: string;
    playerName: string;
    gameDate: Date | null;
  }): Promise<void> {
    try {
      const { error } = await this.requireSupabase()
        .rpc('log_shadow_prediction', {
          p_prop_id: data.propId,
          p_raw_prop_id: data.rawPropId,
          p_ml_prediction: data.mlPrediction,
          p_ml_confidence: data.mlConfidence,
          p_heuristic_prediction: data.heuristicPrediction,
          p_model_version: data.modelVersion,
          p_model_features: data.modelFeatures,
          p_feature_values: data.modelFeatures, // Same as model_features for now
          p_prediction_latency_ms: data.predictionLatencyMs,
          p_from_cache: data.fromCache,
          p_fallback_used: data.fallbackUsed,
          p_production_score: data.productionScore,
          p_production_tier: data.productionTier,
          p_environment: this.deploymentStage === 'stage1' ? 'shadow' : 
                         this.deploymentStage === 'stage2' ? 'canary' : 'production',
          p_deployment_stage: this.deploymentStage,
          p_sport: data.sport,
          p_market_type: data.marketType,
          p_player_name: data.playerName,
          p_game_date: data.gameDate?.toISOString(),
        });

      if (error) {
        this.logger.error('❌ Failed to log shadow prediction:', error);
      }
    } catch (error) {
      this.logger.error('❌ Error logging shadow prediction:', error);
    }
  }

  /**
   * Log shadow prediction error
   */
  private async logShadowPredictionError(prop: PropObject, error: any): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';

      await this.requireSupabase()
        .rpc('log_shadow_prediction', {
          p_prop_id: prop.id?.toString() || `error_prop_${Date.now()}`,
          p_raw_prop_id: prop.id as string,
          p_ml_prediction: 0,
          p_ml_confidence: 0,
          p_heuristic_prediction: 0,
          p_model_version: 'error',
          p_model_features: {},
          p_feature_values: {},
          p_prediction_latency_ms: 0,
          p_from_cache: false,
          p_fallback_used: true,
          p_environment: 'shadow',
          p_deployment_stage: this.deploymentStage,
          p_sport: prop.sport as string,
          p_market_type: prop.market_type as string,
          p_player_name: prop.player_name as string,
          p_error_message: errorMessage,
          p_error_type: errorType,
        });
    } catch (logError) {
      this.logger.error('❌ Failed to log shadow prediction error:', logError);
    }
  }
}