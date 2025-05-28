import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { ErrorHandler, ErrorHandlerConfig } from '../utils/errorHandling';
import { 
  AgentConfig, 
  AgentStatus, 
  HealthStatus,
  validateConfig,
  validateHealth 
} from '../types/shared';
import { Metrics } from '../monitoring/metrics';
import { EventEmitter } from 'events';

export abstract class BaseAgent extends EventEmitter {
  protected readonly logger: Logger;
  protected readonly errorHandler: ErrorHandler;
  protected readonly metrics: Metrics;
  
  protected status: AgentStatus = 'idle';
  protected healthCheckInterval?: NodeJS.Timer;
  protected metricsInterval?: NodeJS.Timer;
  protected retryQueue: Map<string, RetryOperation> = new Map();

  constructor(
    protected readonly name: string,
    protected readonly config: AgentConfig,
    protected readonly supabase: SupabaseClient,
    errorConfig: ErrorHandlerConfig
  ) {
    super();
    this.logger = new Logger(name);
    this.errorHandler = ErrorHandler.getInstance(supabase, errorConfig);
    this.metrics = new Metrics(name, config.metricsConfig);

    // Validate config on initialization
    validateConfig(config);
  }

  // --- Lifecycle Methods ---
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing agent');
      await this.validateDependencies();
      await this.setupHealthCheck();
      await this.setupMetrics();
      await this.initializeResources();
      this.status = 'ready';
      this.logger.info('Agent initialized successfully');
    } catch (error) {
      await this.handleError(error, 'initialization');
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      this.logger.info('Starting agent');
      await this.startProcessing();
      this.status = 'running';
      this.logger.info('Agent started successfully');
    } catch (error) {
      await this.handleError(error, 'startup');
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping agent');
      await this.stopProcessing();
      await this.cleanup();
      this.status = 'stopped';
      this.logger.info('Agent stopped successfully');
    } catch (error) {
      await this.handleError(error, 'shutdown');
      throw error;
    }
  }

  // --- Health & Metrics ---
  protected async setupHealthCheck(): Promise<void> {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        await this.reportHealth(health);
      } catch (error) {
        await this.handleError(error, 'health check');
      }
    }, this.config.healthCheckIntervalMs);
  }

  protected async setupMetrics(): Promise<void> {
    await this.metrics.initialize();
    
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        await this.reportMetrics(metrics);
      } catch (error) {
        await this.handleError(error, 'metrics collection');
      }
    }, this.config.metricsConfig.interval);
  }

  // --- Error Handling ---
  protected async handleError(error: Error, context: string): Promise<void> {
    await this.errorHandler.handleError(error, {
      agent: this.name,
      operation: context,
      status: this.status
    });

    this.emit('error', { error, context });

    if (this.shouldEnterErrorState(error)) {
      this.status = 'error';
      await this.stop();
    }
  }

  protected shouldEnterErrorState(error: Error): boolean {
    // Implement based on error severity and type
    return false;
  }

  // --- Retry Logic ---
  protected async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    key: string
  ): Promise<T> {
    const retryOp = {
      operation,
      context,
      attempts: 0,
      maxAttempts: this.config.retryConfig.maxAttempts
    };

    this.retryQueue.set(key, retryOp);

    try {
      return await this.executeWithRetry(key);
    } finally {
      this.retryQueue.delete(key);
    }
  }

  private async executeWithRetry(key: string): Promise<any> {
    const op = this.retryQueue.get(key);
    if (!op) throw new Error('Retry operation not found');

    while (op.attempts < op.maxAttempts) {
      try {
        op.attempts++;
        return await op.operation();
      } catch (error) {
        if (op.attempts === op.maxAttempts) {
          await this.handleError(error, `${op.context} (final retry)`);
          throw error;
        }

        this.logger.warn(`Retry attempt ${op.attempts} for ${op.context}`, { error });
        await new Promise(resolve => setTimeout(resolve, 
          Math.min(
            this.config.retryConfig.backoffMs * Math.pow(2, op.attempts - 1),
            this.config.retryConfig.maxBackoffMs
          )
        ));
      }
    }
  }

  // --- Abstract Methods ---
  protected abstract validateDependencies(): Promise<void>;
  protected abstract initializeResources(): Promise<void>;
  protected abstract startProcessing(): Promise<void>;
  protected abstract stopProcessing(): Promise<void>;
  protected abstract checkHealth(): Promise<HealthStatus>;
  protected abstract collectMetrics(): Promise<Record<string, any>>;

  // --- Cleanup ---
  protected async cleanup(): Promise<void> {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    await this.metrics.shutdown();
  }

  // --- Helpers ---
  private async reportHealth(health: HealthStatus): Promise<void> {
    await this.supabase.from('agent_health').insert({
      agent: this.name,
      status: health.status,
      details: health,
      timestamp: new Date().toISOString()
    });
  }

  private async reportMetrics(metrics: Record<string, any>): Promise<void> {
    await this.supabase.from('agent_metrics').insert({
      agent: this.name,
      metrics,
      timestamp: new Date().toISOString()
    });
  }
}

interface RetryOperation {
  operation: () => Promise<any>;
  context: string;
  attempts: number;
  maxAttempts: number;
} 