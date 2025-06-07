import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentDependencies, AgentMetrics, HealthCheckResult } from '../BaseAgent/types';
import { Logger } from '../../utils/logger';
import { gradeAndPromoteFinalPicks } from './gradeForFinalPicks';
import { gradePick } from './scoring/edgeScore';
import { startMetricsServer } from '../../services/metricsServer';

startMetricsServer(9002);

export class GradingAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    // Initialize agent-specific properties here
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
    const { data: gradingStats } = await this.supabase
      .from('picks')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return {
      ...this.metrics,
      agentName: this.config.name,
      successCount: (gradingStats || []).filter(s => s.status === 'graded').length,
      warningCount: (gradingStats || []).filter(s => s.status === 'pending').length,
      errorCount: (gradingStats || []).filter(s => s.status === 'failed').length
    };
  }

  public async checkHealth(): Promise<HealthCheckResult> {
    try {
      const { error } = await this.supabase
        .from('picks')
        .select('id')
        .limit(1);

      if (error) {
        throw error;
      }

      return {
        status: 'healthy',
        details: {
          database: 'connected',
          metrics: 'enabled'
        }
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  gradeAndPromoteFinalPicks().then(() => {
    console.log('GradingAgent complete');
  });

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }
}