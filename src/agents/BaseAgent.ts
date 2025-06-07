import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandling';
import { HealthCheckResult, AgentStatus, AgentConfig, AgentCommand, BaseAgentDependencies } from '../types/agent';
import { validateBaseConfig } from '../utils/config';
import { Metrics } from '../types/shared';

export abstract class BaseAgent {
  protected supabase: SupabaseClient;
  protected config: AgentConfig;
  protected logger: Logger;
  protected errorHandler: ErrorHandler;
  protected healthCheckInterval: NodeJS.Timeout | null = null;
  protected metricsInterval: NodeJS.Timeout | null = null;
  protected metrics: Metrics = {
    errorCount: 0,
    warningCount: 0,
    successCount: 0
  };

  constructor({ supabase, config, errorHandler, logger }: BaseAgentDependencies) {
    this.supabase = supabase;
    this.config = config;
    this.errorHandler = errorHandler || new ErrorHandler(config.name, supabase);
    this.logger = logger || new Logger(config.name);

    validateBaseConfig(config);
  }

  protected async runHealthCheck(): Promise<void> {
    try {
      const health = await this.checkHealth();
      const logStatus = health.status === 'idle' ? 'healthy' : health.status as 'healthy' | 'unhealthy';
      this.logger.logHealth(this.config.name, logStatus, health.details);
    } catch (error) {
      this.logger.error('Health check failed:', { error });
    }
  }

  protected async runMetricsCollection(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      this.logger.info('Metrics collected', { metrics, agent: this.config.name });
    } catch (error) {
      this.logger.error('Metrics collection failed:', { error });
    }
  }

  public async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Agent disabled, not starting');
      return;
    }

    try {
      await this.initialize();
      
      if (this.config.healthCheckInterval) {
        this.healthCheckInterval = setInterval(
          () => this.runHealthCheck(),
          this.config.healthCheckInterval
        );
      }

      if (this.config.metricsConfig?.interval) {
        this.metricsInterval = setInterval(
          () => this.runMetricsCollection(),
          this.config.metricsConfig.interval
        );
      }

      this.logger.info('Agent started successfully');
    } catch (error) {
      this.logger.error('Failed to start agent:', { error });
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = null;
      }

      await this.cleanup();
      this.logger.info('Agent stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop agent:', { error });
      throw error;
    }
  }

  protected abstract initialize(): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  protected abstract checkHealth(): Promise<HealthCheckResult>;
  protected abstract collectMetrics(): Promise<Metrics>;
  public abstract handleCommand(command: AgentCommand): Promise<void>;
} 