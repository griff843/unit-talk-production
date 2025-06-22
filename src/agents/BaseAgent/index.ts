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
import { validateBaseAgentConfig } from './config';

export type { BaseAgentConfig, BaseAgentDependencies } from './types';
export { createBaseAgentConfig } from './config';
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

  constructor(config: BaseAgentConfig | any, deps: BaseAgentDependencies) {
    super();

    // Validate and fix config using factory function
    try {
      this.config = BaseAgentConfigSchema.parse(config);
    } catch (error) {
      // If validation fails, use factory to create proper config
      if (deps?.logger) {
        deps.logger.warn('Config validation failed, using factory to create proper config', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      this.config = validateBaseAgentConfig(config);
    }

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

      // Start process loop if schedule is defined
      if (this.config.schedule) {
        this.processLoopActive = true;
        this.safeProcessLoop().catch(error => {
          this.logger.error('Process loop failed', {
          error: error instanceof Error ? error.message : String(error)
        });
          this.emit('error', error);
        });
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
    if (this.status === 'stopped' || this.status === 'stopping') {
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
        this.metrics.processingTimeMs = Date.now() - startTime;

      } catch (error) {
        this.metrics.errorCount++;
        this.logger.error('Process cycle failed', {
          error: error instanceof Error ? error.message : String(error)
        });

        // Implement exponential backoff on errors
        const backoffMs = Math.min(
          this.config.retry?.backoffMs || 1000,
          this.config.retry?.maxBackoffMs || 30000
        );
        await this.sleep(backoffMs);
      }

      // Update memory usage
      this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;

      // Wait for next cycle (simple interval for now, could be enhanced with cron)
      await this.sleep(5000); // 5 second default interval
    }
  }

  /**
   * Start background processes (health checks, metrics collection)
   */
  private startBackgroundProcesses(): void {
    // Health check interval
    if (this.config.health?.enabled && this.config.health.interval) {
      this.healthCheckInterval = setInterval(async () => {
        try {
          const health = await this.checkHealth();
          this.emit('healthCheck', health);
        } catch (error) {
          this.logger.error('Health check failed', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }, this.config.health.interval * 1000);
    }

    // Metrics collection interval
    if (this.config.metrics?.enabled && this.config.metrics.interval) {
      this.metricsInterval = setInterval(async () => {
        try {
          this.metrics = { ...this.metrics, ...(await this.collectMetrics()) };
          this.emit('metrics', this.metrics);
        } catch (error) {
          this.logger.error('Metrics collection failed', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }, this.config.metrics.interval * 1000);
    }
  }

  /**
   * Stop background processes
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

  /**
   * Get current agent status
   */
  public getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get current metrics
   */
  public getMetrics(): BaseMetrics {
    return { ...this.metrics };
  }

  /**
   * Get agent configuration
   */
  public getConfig(): BaseAgentConfig {
    return { ...this.config };
  }

  /**
   * Utility method for sleeping
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle commands (can be overridden by child classes)
   */
  public async handleCommand(command: any): Promise<any> {
    this.logger.info(`Received command: ${command.type}`, command);

    switch (command.type) {
      case 'START':
        await this.start();
        return { success: true, message: 'Agent started' };

      case 'STOP':
        await this.stop();
        return { success: true, message: 'Agent stopped' };

      case 'STATUS':
        return {
          success: true,
          data: {
            status: this.status,
            metrics: this.metrics,
            config: this.config
          }
        };

      case 'HEALTH_CHECK':
        const health = await this.checkHealth();
        return { success: true, data: health };

      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }
  }
}