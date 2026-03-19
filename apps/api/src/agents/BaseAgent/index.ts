import { EventEmitter } from 'events';

import { SupabaseClient } from '@supabase/supabase-js';

import { tracer, tracedLogger } from '../../monitoring/distributed-tracing';
import { healthChecker, HealthCheck } from '../../monitoring/enhanced-health-checks';
import { circuitBreaker } from '../../services/enhanced-circuit-breaker';

import { validateBaseAgentConfig, createBaseAgentConfig } from './config';
import {
  BaseAgentConfig,
  BaseMetrics,
  BaseAgentDependencies,
  AgentStatus,
  Logger,
  ErrorHandler,
} from './types';

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
    return tracedLogger;
  }

  protected get errorHandler(): ErrorHandler | undefined {
    return this.deps.errorHandler;
  }

  private status: AgentStatus = 'idle';
  protected metrics!: BaseMetrics;
  private healthCheckInterval?: NodeJS.Timeout | undefined;
  private metricsInterval?: NodeJS.Timeout | undefined;
  // UTRP-R6 DEFECT-35: Scheduled processing interval — periodic calls to run() when schedule='enabled'
  private _scheduledProcessInterval?: NodeJS.Timeout | undefined;
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
          err: error instanceof Error ? error.message : String(error),
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
      memoryUsageMb: 0,
    };

    // Set up error handling
    this.on('error', error => {
      this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;
      if (this.deps.errorHandler) {
        this.deps.errorHandler.handleError(error, {
          agentName: this.config.name,
          status: this.status,
          context: 'BaseAgent',
        });
      }
    });
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract initialize(): Promise<void>;
  protected abstract process(): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  protected abstract checkHealth(): Promise<HealthCheckResult>;

  // Enhanced health check that includes dependency validation
  public async getEnhancedHealth(): Promise<{
    agent: HealthCheckResult;
    dependencies: HealthCheck[];
    overall: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    try {
      // Get agent-specific health
      const agentHealth = await this.checkHealth();

      // Get dependency health checks
      const dependencies: HealthCheck[] = [];

      // Check Supabase if agent uses it
      if (this.hasSupabase()) {
        const supabaseHealth = healthChecker.getDependencyHealth('supabase');
        if (supabaseHealth) {
          dependencies.push(supabaseHealth);
        }
      }

      // Check circuit breaker status for services this agent might use
      const circuitBreakerHealth = circuitBreaker.getHealthStatus();
      const relevantServices = circuitBreakerHealth.services.filter(
        s => s.name.includes('openai') || s.name.includes('discord') || s.name.includes('supabase')
      );

      // Add circuit breaker states as health checks
      relevantServices.forEach(service => {
        dependencies.push({
          name: `circuit_breaker_${service.name}`,
          status: service.healthy ? 'healthy' : 'degraded',
          critical: false,
          lastCheck: new Date().toISOString(),
          metadata: {
            circuit_state: service.state,
            failure_rate: service.failureRate,
          },
        });
      });

      // Determine overall health
      const criticalDependenciesUnhealthy =
        dependencies.filter(d => d.critical && d.status === 'unhealthy').length > 0;
      const anyDependenciesUnhealthy =
        dependencies.filter(d => d.status === 'unhealthy').length > 0;
      const agentUnhealthy = agentHealth.status === 'unhealthy';

      let overall: 'healthy' | 'degraded' | 'unhealthy';
      if (agentUnhealthy || criticalDependenciesUnhealthy) {
        overall = 'unhealthy';
      } else if (anyDependenciesUnhealthy || agentHealth.status === 'degraded') {
        overall = 'degraded';
      } else {
        overall = 'healthy';
      }

      return {
        agent: agentHealth,
        dependencies,
        overall,
      };
    } catch (error) {
      this.logger.error('Enhanced health check failed', {
        agentName: this.config.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        agent: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          details: { error: 'Health check system failure' },
        },
        dependencies: [],
        overall: 'unhealthy',
      };
    }
  }
  protected abstract collectMetrics(): Promise<BaseMetrics>;

  // Register agent with health check system
  private registerAgentHealthCheck(): void {
    const agentName = this.config.name.toLowerCase().replace(/agent$/, '');

    healthChecker.registerDependency({
      name: `agent_${agentName}`,
      critical: true,
      timeout: 5000,
      checkInterval: 30000, // 30 seconds
      healthCheckFn: async () => {
        try {
          const startTime = Date.now();
          const health = await this.checkHealth();

          return {
            healthy: health.status === 'healthy',
            responseTime: Date.now() - startTime,
            error: health.status !== 'healthy' ? JSON.stringify(health.details) : undefined,
            metadata: {
              agentStatus: this.status,
              metrics: this.metrics,
              ...health.details,
            },
          };
        } catch (error) {
          return {
            healthy: false,
            error: error instanceof Error ? error.message : 'Agent health check failed',
          };
        }
      },
    });

    this.logger.debug('Agent registered with health check system', {
      agentName: this.config.name,
      healthCheckName: `agent_${agentName}`,
    });
  }

  // Public lifecycle methods
  public async start(): Promise<void> {
    try {
      // Register with health check system
      this.registerAgentHealthCheck();
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

      // UTRP-R6 DEFECT-35: Start processing loop if configured and schedule is enabled
      const processingIntervalSeconds = (this.config as any).processing?.intervalSeconds;
      if (processingIntervalSeconds && this.config.schedule !== 'disabled') {
        this._scheduledProcessInterval = setInterval(() => {
          this.run().catch(err =>
            this.logger.error(`${this.config.name} processing loop error:`, {
              err: err instanceof Error ? err.message : String(err),
            })
          );
        }, processingIntervalSeconds * 1000);
        this.logger.info(
          `${this.config.name} processing loop started (interval: ${processingIntervalSeconds}s)`
        );
      }

      this.status = 'running';
      this.logger.info(`${this.config.name} started successfully`);
    } catch (error) {
      this.status = 'error';
      this.logger.error(`Failed to start ${this.config.name}:`, {
        error: error instanceof Error ? error.message : String(error),
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
      if (this._scheduledProcessInterval) {
        clearInterval(this._scheduledProcessInterval);
        this._scheduledProcessInterval = undefined;
      }

      // Run cleanup
      await this.cleanup();

      this.status = 'idle';
      this.logger.info(`${this.config.name} stopped successfully`);
    } catch (error) {
      this.status = 'error';
      this.logger.error(`Failed to stop ${this.config.name}:`, {
        error: error instanceof Error ? error.message : String(error),
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
        processingTimeMs: processingTime,
      });
    } catch (error) {
      this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;
      this.logger.error(`${this.config.name} process failed:`, {
        error: error instanceof Error ? error.message : String(error),
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
        err: error instanceof Error ? error.message : String(error),
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
        err: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Record health check results
  private async recordHealth(health: HealthCheckResult): Promise<void> {
    try {
      if (this.deps.supabase) {
        await this.deps.supabase.from('agent_health').insert([
          {
            agent: this.config.name,
            status: health.status,
            details: health.details,
            timestamp: health.timestamp || new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      this.logger.error('Failed to record health check:', {
        err: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Record metrics
  private async recordMetrics(metrics: BaseMetrics): Promise<void> {
    try {
      if (this.deps.supabase) {
        await this.deps.supabase.from('agent_metrics').insert([
          {
            agent: this.config.name,
            ...metrics,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      this.logger.error('Failed to record metrics:', {
        err: error instanceof Error ? error.message : String(error),
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

  // Tracing helper methods
  public getTraceId(): string | undefined {
    return tracer.getCurrentTraceId();
  }

  public getSpanId(): string | undefined {
    return tracer.getCurrentSpanId();
  }

  public addTraceEvent(name: string, attributes?: Record<string, any>): void {
    tracer.addEvent(name, attributes);
  }

  public addTraceTags(tags: Record<string, any>): void {
    tracer.addTags(tags);
  }

  // Helper method for wrapping operations with tracing
  protected async traceOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    tags?: Record<string, any>
  ): Promise<T> {
    return tracer.runInSpan(operation, fn, this.config.name, tags);
  }
}
