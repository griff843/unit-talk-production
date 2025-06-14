import 'dotenv/config';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, AgentMetrics, HealthCheckResult } from '../BaseAgent/types';
import { startMetricsServer } from '../../services/metricsServer';
import { finalEdgeScore } from '../../logic/scoring/edgeScoring';
import { EDGE_CONFIG } from '../../logic/config/edgeConfig';
import { analyzeMarketResistance } from '../../logic/enrichment/marketResistance';
import { AlertAgent } from '../AlertAgent';

export class GradingAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  public async __test__initialize(): Promise<void> {
    return this.initialize();
  }

  public async __test__collectMetrics(): Promise<AgentMetrics> {
    return this.collectMetrics();
  }

  public async __test__checkHealth(): Promise<HealthCheckResult> {
    return this.checkHealth();
  }

  protected async collectMetrics(): Promise<AgentMetrics> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: gradingStats } = await this.supabase
        .from('picks')
        .select('status, created_at')
        .gte('created_at', oneHourAgo);

      return {
        ...this.metrics,
        agentName: this.config.name,
        successCount: (gradingStats || []).filter(s => s.status === 'graded').length,
        warningCount: (gradingStats || []).filter(s => s.status === 'pending').length,
        errorCount: (gradingStats || []).filter(s => s.status === 'failed').length
      };
    } catch (error) {
      this.logger.error('Failed to collect metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        ...this.metrics,
        agentName: this.config.name,
        successCount: 0,
        errorCount: 1,
        warningCount: 0
      };
    }
  }

  public async checkHealth(): Promise<HealthCheckResult> {
    try {
      const { error } = await this.supabase
        .from('picks')
        .select('id')
        .limit(1);

      if (error) throw error;

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: {
          database: 'connected',
          metrics: 'enabled',
        },
      };
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  protected async process(): Promise<void> {
    const startTime = Date.now();
    this.logger.info('🎯 Starting grading process...');

    const { data: picks, error } = await this.supabase
      .from('daily_picks')
      .select('*')
      .is('edge_score', null)
      .eq('play_status', 'pending')
      .limit(100);

    if (error) {
      this.logger.error('Failed to fetch picks for grading', {
        error: error.message,
        code: error.code
      });
      throw error;
    }

    if (!picks || picks.length === 0) {
      this.logger.info('✅ No picks found for grading');
      return;
    }

    this.logger.info(`📊 Found ${picks.length} picks to grade`);

    for (const pick of picks) {
      try {
        const result = finalEdgeScore(pick, EDGE_CONFIG);
        const { score, tier, tags, breakdown, postable, solo_lock } = result;

        const marketData = await analyzeMarketResistance(pick);

        const { error: updateError } = await this.supabase
          .from('daily_picks')
          .update({
            edge_score: score,
            tier,
            tags,
            edge_breakdown: breakdown,
            postable,
            solo_lock,
            ...marketData,
            updated_at: new Date().toISOString()
          })
          .eq('id', pick.id);

        if (updateError) {
          throw updateError;
        }

        if (marketData.sharp_fade) {
          await this.agentBus.publish('alert_triggered', {
            type: 'market_fade',
            pick_id: pick.id,
            edge_score: score,
            line_move_pct: marketData.line_move_pct,
            ...pick
          });
        }

        if (['S', 'A'].includes(tier)) {
          const { error: insertError } = await this.supabase
            .from('final_picks')
            .insert([{
              ...pick,
              edge_score: score,
              tier,
              tags,
              edge_breakdown: breakdown,
              postable,
              solo_lock,
              promoted_at: new Date().toISOString(),
              promoted_by: 'GradingAgent'
            }]);

          if (insertError) {
            this.logger.warn(`⚠️ Failed to promote pick [${pick.id}] to final_picks`, {
              error: insertError.message,
              pickId: pick.id
            });
          } else {
            this.logger.info(`🚀 Promoted pick [${pick.id}] to final_picks - Tier: ${tier}`);
          }
        }

        this.logger.info(`✅ Graded pick [${pick.id}] - Score: ${score}, Tier: ${tier}`);
      } catch (err) {
        this.logger.error(`❌ Error grading pick [${pick.id}]`, {
          error: err instanceof Error ? err.message : 'Unknown error',
          pickId: pick.id,
          stack: err instanceof Error ? err.stack : undefined
        });
      }
    }

    const processingTime = Date.now() - startTime;
    this.logger.info(`Completed grading ${picks.length} picks in ${processingTime}ms`);
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🚀 GradingAgent initializing...');
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 GradingAgent cleanup complete');
  }

  public async startMetricsServer(): Promise<void> {
    const port = this.config.metrics?.port || 9003;
    startMetricsServer(port);
    this.logger.info(`📊 Metrics server started on port ${port}`);
  }
}
