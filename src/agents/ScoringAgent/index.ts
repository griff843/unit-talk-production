// src/agents/ScoringAgent/index.ts
import 'dotenv/config';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, AgentMetrics, HealthCheckResult } from '../BaseAgent/types';
import { scorePropEdge } from '../../logic/scoring/edgeScoring';
import { PropObject } from '../../types/propTypes';

export default class ScoringAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🚀 ScoringAgent initializing...');
    // Any initialization logic here
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 ScoringAgent cleanup complete');
    // Any cleanup logic here
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
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
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
        error: error instanceof Error ? error.message : 'Unknown error'
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
        const result = scorePropEdge(prop);

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
}