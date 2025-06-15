// src/agents/BaseAgent/index.ts - Enhanced Production BaseAgent

import { EventEmitter } from 'events';
import {
  BaseAgentConfigSchema,
  BaseAgentConfig,
  BaseMetrics,
  HealthStatus,
  BaseAgentDependencies,
  AgentStatus,
  Logger,
  ErrorHandler
} from './types';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Production-grade BaseAgent with enhanced lifecycle management
 * Combines the robustness of the main repo with the clean architecture of the droid repo
 */
export abstract class BaseAgent extends EventEmitter {
  protected readonly config: BaseAgentConfig;
  protected readonly deps: BaseAgentDependencies;

  // Expose commonly used dependencies as protected properties
  protected get supabase(): SupabaseClient {
    return this.deps.supabase;
  }

  protected get logger(): Logger {
    return this.deps.logger;
  }

  protected get errorHandler(): ErrorHandler {
    return this.deps.errorHandler;
  }

  private status: AgentStatus = 'idle';
  protected metrics: BaseMetrics;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private processLoopActive = false;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super();

    // Validate config using Zod schema
    this.config = BaseAgentConfigSchema.parse(config);
    this.deps = deps;

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
      this.metrics.errorCount++;
      if (this.deps.errorHandler) {
        this.deps.errorHandler.handleError(error, {
          agentName: this.config.name,
          status: this.status,
          context: 'BaseAgent'
        });
      }
    });
  }

  // Abstract methods that child classes must implement
  protected abstract initialize(): Promise<void>;
  protected abstract process(): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  protected abstract collectMetrics(): Promise<BaseMetrics>;
  public abstract checkHealth(): Promise<HealthStatus>;

  /**
   * Start the agent with enhanced lifecycle management
   */
  public async start(): Promise<void> {
    if (this.status !== 'idle') {
      this.logger.warn(`Agent ${this.config.name} already started or in transition`);
      return;
    }

    try {
      this.status = 'initializing';
      this.emit('statusChange', this.status);
      this.logger.info(`Starting agent: ${this.config.name}`);

      await this.initialize();

      this.status = 'running';
      this.emit('statusChange', this.status);
      this.logger.info(`Agent ${this.config.name} started successfully`);

      // Start background processes
      this.startBackgroundProcesses();

      // Start processing loop if enabled
      if (this.config.schedule) {
        this.processLoopActive = true;
        void this.safeProcessLoop();
      }

    } catch (error) {
      this.status = 'error';
      this.emit('statusChange', this.status);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the agent gracefully
   */
  public async stop(): Promise<void> {
    if (this.status !== 'running') {
      this.logger.warn(`Agent ${this.config.name} not running`);
      return;
    }

    try {
      this.status = 'stopping';
      this.emit('statusChange', this.status);
      this.logger.info(`Stopping agent: ${this.config.name}`);

      // Stop background processes
      this.processLoopActive = false;
      this.stopBackgroundProcesses();

      await this.cleanup();

      this.status = 'stopped';
      this.emit('statusChange', this.status);
      this.logger.info(`Agent ${this.config.name} stopped successfully`);

    } catch (error) {
      this.status = 'error';
      this.emit('statusChange', this.status);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Run a single execution cycle (for manual/scheduled execution)
   */
  public async run(): Promise<void> {
    if (this.status !== 'idle' && this.status !== 'stopped') {
      throw new Error(`Cannot run agent ${this.config.name} in status: ${this.status}`);
    }

    try {
      this.status = 'initializing';
      this.emit('statusChange', this.status);
      
      await this.initialize();
      
      this.status = 'running';
      this.emit('statusChange', this.status);
      
      const startTime = Date.now();
      await this.process();
      
      // Update processing time
      this.metrics.processingTimeMs = Date.now() - startTime;
      this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
      this.metrics.successCount++;
      
      // Collect final metrics
      this.metrics = { ...this.metrics, ...(await this.collectMetrics()) };
      
      this.status = 'stopping';
      this.emit('statusChange', this.status);
      
      await this.cleanup();
      
      this.status = 'stopped';
      this.emit('statusChange', this.status);
      
    } catch (error) {
      this.status = 'error';
      this.emit('statusChange', this.status);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Safe processing loop with error handling
   */
  private async safeProcessLoop(): Promise<void> {
    while (this.processLoopActive && this.status === 'running') {
      const startTime = Date.now();
      
      try {
        await this.process();
        this.metrics.successCount++;
      } catch (error) {
        this.metrics.errorCount++;
        this.emit('error', error);

        // Implement exponential backoff on errors
        if (this.config.retry) {
          const backoffMs = Math.min(
            this.config.retry.backoffMs * Math.pow(2, this.metrics.errorCount),
            this.config.retry.maxBackoffMs
          );
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }

      // Update metrics
      this.metrics.processingTimeMs = Date.now() - startTime;
      this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;

      // Wait for next cycle
      const intervalMs = this.config.metrics.interval * 1000;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * Start background monitoring processes
   */
  private startBackgroundProcesses(): void {
    // Health check interval
    if (this.config.health && this.config.health.enabled) {
      this.healthCheckInterval = setInterval(async () => {
        try {
          const health = await this.checkHealth();
          this.emit('healthCheck', health);
        } catch (error) {
          this.emit('error', error);
        }
      }, this.config.health.interval * 1000);
    }

    // Metrics collection interval
    if (this.config.metrics.enabled) {
      this.metricsInterval = setInterval(async () => {
        try {
          this.metrics = { ...this.metrics, ...(await this.collectMetrics()) };
          this.emit('metrics', this.metrics);
        } catch (error) {
          this.emit('error', error);
        }
      }, this.config.metrics.interval * 1000);
    }
  }

  /**
   * Stop background monitoring processes
   */
  private stopBackgroundProcesses(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  // Public getters
  public getStatus(): AgentStatus {
    return this.status;
  }

  public getMetrics(): BaseMetrics {
    return { ...this.metrics };
  }

  public getConfig(): BaseAgentConfig {
    return { ...this.config };
  }

  /**
   * Force a health check
   */
  public async performHealthCheck(): Promise<HealthStatus> {
    try {
      return await this.checkHealth();
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Force metrics collection
   */
  public async performMetricsCollection(): Promise<BaseMetrics> {
    try {
      this.metrics = { ...this.metrics, ...(await this.collectMetrics()) };
      return this.getMetrics();
    } catch (error) {
      this.emit('error', error);
      return this.getMetrics();
    }
  }
}