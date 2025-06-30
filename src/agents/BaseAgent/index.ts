import { EventEmitter } from 'events';
import {
  BaseAgentConfig,
  BaseMetrics,
  BaseAgentDependencies,
  AgentStatus,
  Logger,
  ErrorHandler
} from './types';
import { validateBaseAgentConfig, createBaseAgentConfig } from './config';
import { SupabaseClient } from '@supabase/supabase-js';

export type { BaseAgentConfig, BaseAgentDependencies } from './types';
export { createBaseAgentConfig } from './config';

// Define HealthCheckResult interface
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Production-grade BaseAgent with enhanced lifecycle management
 * Combines the robustness of the main repo with the clean architecture of the droid repo
 */
export abstract class BaseAgent extends EventEmitter {
  protected readonly config: BaseAgentConfig;
  protected readonly deps: BaseAgentDependencies;

  // Expose commonly used dependencies as protected properties
  protected get supabase(): SupabaseClient | undefined {
    return this.deps.supabase;
  }

  protected get logger(): Logger {
    return this.deps.logger;
  }

  protected get errorHandler(): ErrorHandler | undefined {
    return this.deps.errorHandler;
  }

  private status: AgentStatus = 'idle';
  protected metrics!: BaseMetrics;
  private healthCheckInterval?: NodeJS.Timeout | undefined;
  private metricsInterval?: NodeJS.Timeout | undefined;
  protected processLoopActive = false;

  constructor(config: BaseAgentConfig | any, deps: BaseAgentDependencies) {
    super();

    this.deps = deps;

    // Validate and fix config using factory function
    try {
      this.config = validateBaseAgentConfig(config);
    } catch (error) {
      // If validation fails, use factory to create proper config
      if (deps?.logger) {
        deps.logger.warn('Config validation failed, using factory to create proper config', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      this.config = createBaseAgentConfig(config);
    }

    // Initialize metrics
    this.metrics = {
      agentName: this.config.name,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0
    };

    // Set up error handling
    this.on('error', (error) => {
      this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;
      if (this.deps.errorHandler) {
        this.deps.errorHandler.handleError(error, {
          agentName: this.config.name,
          status: this.status,
          context: 'BaseAgent'
        });
      }
    });
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract initialize(): Promise<void>;
  protected abstract process(): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  protected abstract checkHealth(): Promise<HealthCheckResult>;
  protected abstract collectMetrics(): Promise<BaseMetrics>;

  // Public lifecycle methods
  public async start(): Promise<void> {
    try {
      this.status = 'starting';
      this.logger.info(`Starting ${this.config.name}...`);

      await this.initialize();

      // Start health checks if enabled
      if (this.config.health?.enabled) {
        this.healthCheckInterval = setInterval(
          () => this.runHealthCheck(),
          (this.config.health.interval || 30) * 1000
        );
      }

      // Start metrics collection if enabled
      if (this.config.metrics?.enabled) {
        this.metricsInterval = setInterval(
          () => this.runMetricsCollection(),
          (this.config.metrics.interval || 60) * 1000
        );
      }

      this.status = 'running';
      this.logger.info(`${this.config.name} started successfully`);
    } catch (error) {
      this.status = 'error';
      this.logger.error(`Failed to start ${this.config.name}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      this.status = 'stopping';
      this.logger.info(`Stopping ${this.config.name}...`);

      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }

      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = undefined;
      }

      // Stop process loop
      this.processLoopActive = false;

      // Run cleanup
      await this.cleanup();

      this.status = 'idle';
      this.logger.info(`${this.config.name} stopped successfully`);
    } catch (error) {
      this.status = 'error';
      this.logger.error(`Failed to stop ${this.config.name}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Add the run method that agents are expecting
  public async run(): Promise<void> {
    try {
      this.processLoopActive = true;
      this.logger.info(`Running ${this.config.name} process...`);
      
      const startTime = Date.now();
      await this.process();
      const processingTime = Date.now() - startTime;
      
      this.metrics.processingTimeMs = processingTime;
      this.metrics.successCount = (this.metrics.successCount || 0) + 1;
      
      this.logger.info(`${this.config.name} process completed`, {
        processingTimeMs: processingTime
      });
    } catch (error) {
      this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;
      this.logger.error(`${this.config.name} process failed:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Health check runner
  private async runHealthCheck(): Promise<void> {
    try {
      const health = await this.checkHealth();
      this.status = health.status === 'healthy' ? 'running' : 'degraded';
      await this.recordHealth(health);
    } catch (error) {
      this.logger.error('Health check failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.status = 'error';
    }
  }

  // Metrics collection runner
  private async runMetricsCollection(): Promise<void> {
    try {
      this.metrics = await this.collectMetrics();
      this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
      await this.recordMetrics(this.metrics);
    } catch (error) {
      this.logger.error('Metrics collection failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Record health check results
  private async recordHealth(health: HealthCheckResult): Promise<void> {
    try {
      if (this.deps.supabase) {
        await this.deps.supabase.from('agent_health').insert([{
          agent: this.config.name,
          status: health.status,
          details: health.details,
          timestamp: health.timestamp || new Date().toISOString()
        }]);
      }
    } catch (error) {
      this.logger.error('Failed to record health check:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Record metrics
  private async recordMetrics(metrics: BaseMetrics): Promise<void> {
    try {
      if (this.deps.supabase) {
        await this.deps.supabase.from('agent_metrics').insert([{
          agent: this.config.name,
          ...metrics,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      this.logger.error('Failed to record metrics:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Getters for status and metrics
  public getStatus(): AgentStatus {
    return this.status;
  }

  public getMetrics(): BaseMetrics {
    return { ...this.metrics };
  }

  public getConfig(): BaseAgentConfig {
    return { ...this.config };
  }

  // Helper method to safely access supabase
  protected requireSupabase(): SupabaseClient {
    if (!this.supabase) {
      throw new Error(`${this.config.name}: Supabase client is required but not provided`);
    }
    return this.supabase as SupabaseClient;
  }

  // Helper method to check if supabase is available
  protected hasSupabase(): boolean {
    return !!this.supabase;
  }
}