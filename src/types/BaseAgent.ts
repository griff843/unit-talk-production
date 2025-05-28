import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { AgentConfig, AgentStatus, AgentMetrics, HealthCheckResult } from './agent';

export abstract class BaseAgent {
  protected readonly supabase: SupabaseClient;
  protected readonly logger: Logger;
  protected readonly config: AgentConfig;
  protected status: AgentStatus = 'idle';
  protected metrics: AgentMetrics = {
    successCount: 0,
    warningCount: 0,
    errorCount: 0,
    status: 'idle',
    agentName: '',
    timestamp: new Date().toISOString()
  };
  protected healthCheckInterval?: NodeJS.Timeout;
  protected metricsInterval?: NodeJS.Timeout;

  constructor(dependencies: BaseAgentDependencies) {
    this.supabase = dependencies.supabase;
    this.logger = dependencies.logger || new Logger(this.constructor.name);
    this.config = dependencies.config;
  }

  protected abstract validateDependencies(): Promise<void>;
  protected abstract initializeResources(): Promise<void>;
  protected abstract process(): Promise<void>;
  protected abstract healthCheck(): Promise<HealthCheckResult>;
  protected abstract collectMetrics(): Promise<AgentMetrics>;

  protected async runHealthCheck(): Promise<void> {
    try {
      const health = await this.healthCheck();
      this.status = health.status;
      await this.recordHealth(health);
    } catch (error) {
      this.logger.error('Health check failed:', { error: error instanceof Error ? error.message : String(error) });
      this.status = 'unhealthy';
    }
  }

  protected async runMetricsCollection(): Promise<void> {
    try {
      this.metrics = await this.collectMetrics();
      await this.recordMetrics(this.metrics);
    } catch (error) {
      this.logger.error('Metrics collection failed:', { error: error instanceof Error ? error.message : String(error) });
      this.metrics.status = 'unhealthy';
    }
  }

  private async recordHealth(health: HealthCheckResult): Promise<void> {
    try {
      await this.supabase.from('agent_health').insert([{
        agent: this.config.name,
        status: health.status,
        details: health.details,
        timestamp: health.timestamp || new Date().toISOString()
      }]);
    } catch (error) {
      this.logger.error('Failed to record health check:', { error: error instanceof Error ? error.message : String(error) });
      this.status = 'unhealthy';
    }
  }

  private async recordMetrics(metrics: AgentMetrics): Promise<void> {
    try {
      await this.supabase.from('agent_metrics').insert([{
        agent: this.config.name,
        ...metrics,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      this.logger.error('Failed to record metrics:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  public async start(): Promise<void> {
    try {
      await this.validateDependencies();
      await this.initializeResources();

      // Start health checks
      if (this.config.healthCheckInterval) {
        this.healthCheckInterval = setInterval(
          () => this.runHealthCheck(),
          this.config.healthCheckInterval
        );
      }

      // Start metrics collection
      if (this.config.metricsConfig?.interval) {
        this.metricsInterval = setInterval(
          () => this.runMetricsCollection(),
          this.config.metricsConfig.interval
        );
      }

      this.status = 'healthy';
      this.logger.info(`${this.config.name} started successfully`);
    } catch (error) {
      this.status = 'unhealthy';
      this.logger.error(`Failed to start ${this.config.name}:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
      if (this.metricsInterval) clearInterval(this.metricsInterval);
      await this.cleanup();
      this.status = 'idle';
      this.logger.info(`${this.config.name} stopped successfully`);
    } catch (error) {
      this.logger.error(`Failed to stop ${this.config.name}:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  protected abstract cleanup(): Promise<void>;
}

export interface BaseAgentDependencies {
  supabase: SupabaseClient;
  logger?: Logger;
  config: AgentConfig;
} 