import { EventEmitter } from 'events';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandling';
import { 
  AgentStatus, 
  HealthCheckResult,
  AgentConfig,
  AgentCommand,
  BaseAgentDependencies,
  AgentMetrics
} from '../../types/agent';
import { 
  RetryConfig,
  MetricsConfig,
  AlertConfig
} from '../../types/shared';
import { validateConfig } from '../../utils/config';

export { BaseAgentDependencies };

export abstract class BaseAgent extends EventEmitter {
  protected readonly logger: Logger;
  protected readonly metrics: AgentMetrics;
  protected readonly config: AgentConfig;
  protected readonly supabase: SupabaseClient;
  
  protected status: AgentStatus = 'healthy';
  protected healthCheckInterval?: NodeJS.Timeout;
  protected metricsInterval?: NodeJS.Timeout;
  protected retryQueue: Map<string, RetryOperation> = new Map();
  protected isRunning: boolean = false;

  constructor(dependencies: BaseAgentDependencies) {
    super();
    this.logger = dependencies.logger || new Logger(this.constructor.name);
    this.supabase = dependencies.supabase;
    this.config = dependencies.config;
    this.metrics = {
      agentName: this.config.name,
      status: 'healthy',
      successCount: 0,
      errorCount: 0,
      warningCount: 0
    };
  }

  public abstract initialize(): Promise<void>;
  public abstract cleanup(): Promise<void>;
  public abstract checkHealth(): Promise<HealthCheckResult>;

  protected abstract validateDependencies(): Promise<void>;
  protected abstract initializeResources(): Promise<void>;
  protected abstract process(): Promise<void>;
  protected abstract healthCheck(): Promise<HealthCheckResult>;
  protected abstract collectMetrics(): Promise<AgentMetrics>;

  protected async startHealthCheck(intervalMs: number = 60000): Promise<void> {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        this.status = health.status;
        this.emit('health', health);
      } catch (error) {
        this.status = 'unhealthy';
        if (error instanceof Error) {
          this.logger.error('Health check failed:', error);
        }
      }
    }, intervalMs);
  }

  protected async startMetricsCollection(intervalMs: number = 60000): Promise<void> {
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.emit('metrics', metrics);
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error('Metrics collection failed:', error);
        }
      }
    }, intervalMs);
  }

  protected async stopHealthCheck(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  protected async stopMetricsCollection(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  public abstract handleCommand(command: AgentCommand): Promise<void>;

  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Agent is already running');
    }

    try {
      this.isRunning = true;
      await this.initialize();
      
      while (this.isRunning) {
        try {
          await this.process();
          this.metrics.successCount++;
        } catch (error) {
          this.metrics.errorCount++;
          if (error instanceof Error) {
            await this.handleError(error, 'processing');
          }
        }
      }
    } finally {
      await this.stop();
    }
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    await this.stopHealthCheck();
    await this.stopMetricsCollection();
    await this.cleanup();
  }

  protected async handleError(error: Error, context: string): Promise<void> {
    this.logger.error(`Error in ${context}:`, error);
    this.metrics.errorCount++;
    this.emit('error', { error, context });
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    key: string,
    retryConfig?: RetryConfig
  ): Promise<T> {
    const config = retryConfig || {
      maxAttempts: this.config.maxRetries || 3,
      backoffMs: 1000,
      maxBackoffMs: 30000
    };

    let attempt = 0;
    
    while (attempt < config.maxAttempts) {
      try {
        attempt++;
        return await operation();
      } catch (error) {
        if (attempt === config.maxAttempts || !(error instanceof Error)) {
          throw error;
        }

        const backoff = Math.min(
          config.backoffMs * Math.pow(2, attempt - 1),
          config.maxBackoffMs
        );
        
        this.logger.warn(`Retry attempt ${attempt} for ${context}`, { error });
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }

    throw new Error(`Max retry attempts (${config.maxAttempts}) reached for ${context}`);
  }

  public getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  public getHealth(): Promise<HealthCheckResult> {
    return this.healthCheck();
  }
}

interface RetryOperation {
  operation: () => Promise<any>;
  context: string;
  attempts: number;
  maxAttempts: number;
}

interface BaseConfig {
  enabled: boolean;
  version: string;
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  healthCheckIntervalMs: number;
  retryConfig: RetryConfig;
  metricsConfig: MetricsConfig;
  alertConfig: AlertConfig;
  metricsEnabled: boolean;
} 