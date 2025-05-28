import { EventEmitter } from 'events';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger';
import { Metrics } from '../../monitoring/metrics';
import { AlertManager } from '../../monitoring/alerts';
import { validateOrThrow } from '../../types/validation';
import { BaseConfigSchema, MetricSchema, AlertSchema } from '../../types/validation';
import { 
  AgentStatus, 
  HealthStatus,
  RetryConfig,
  MetricsConfig,
  AlertConfig 
} from '../../types/shared';
import {
  AgentContext,
  BaseAgentConfig,
  BaseMetrics,
  ErrorHandlerConfig,
} from './types';

export abstract class BaseAgent extends EventEmitter {
  protected readonly logger: Logger;
  protected readonly metrics: Metrics;
  protected readonly alertManager: AlertManager;
  
  protected status: AgentStatus = 'idle';
  protected healthCheckInterval?: NodeJS.Timer;
  protected metricsInterval?: NodeJS.Timer;
  protected retryQueue: Map<string, RetryOperation> = new Map();
  protected context: AgentContext;
  private isRunning: boolean = false;

  constructor(
    protected readonly name: string,
    protected readonly config: BaseConfig,
    protected readonly supabase: SupabaseClient,
    errorConfig: ErrorHandlerConfig
  ) {
    super();
    this.logger = new Logger(name, config.logLevel);
    this.metrics = new Metrics(name, config.metricsConfig);
    this.alertManager = AlertManager.getInstance(supabase, config.alertConfig);
    
    this.context = {
      config,
      supabase,
      errorConfig,
      metrics: this.initializeMetrics(),
      logger: console, // Will be replaced with proper logger
    };
  }

  private initializeMetrics(): BaseMetrics {
    return {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0,
    };
  }

  // --- Lifecycle Methods ---
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing agent', { name: this.name, version: this.config.version });
      
      // Validate configuration
      await validateOrThrow(BaseConfigSchema, this.config, 'agent configuration');
      
      // Initialize components
      await this.initializeComponents();
      
      // Setup monitoring
      await this.setupMonitoring();
      
      // Initialize agent-specific resources
      await this.initializeResources();
      
      this.status = 'ready';
      this.logger.info('Agent initialized successfully');
      
      // Emit initialization complete event
      this.emit('initialized', { 
        agent: this.name, 
        status: this.status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      await this.handleError(error, 'initialization');
      throw error;
    }
  }

  private async initializeComponents(): Promise<void> {
    // Initialize metrics
    await this.metrics.initialize();
    
    // Initialize alert manager
    await this.alertManager.initialize();
    
    // Validate dependencies
    await this.validateDependencies();
  }

  private async setupMonitoring(): Promise<void> {
    // Setup health checks
    this.healthCheckInterval = setInterval(
      () => this.runHealthCheck(),
      this.config.healthCheckIntervalMs
    );

    // Setup metrics collection
    this.metricsInterval = setInterval(
      () => this.collectAndReportMetrics(),
      this.config.metricsConfig.interval
    );
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Agent is already running');
    }

    try {
      this.isRunning = true;
      await this.initialize();
      
      // Start health checks
      if (this.context.config.metricsEnabled) {
        this.startHealthChecks();
      }

      // Main processing loop
      while (this.isRunning) {
        const startTime = Date.now();
        
        try {
          await this.process();
          this.context.metrics.successCount++;
        } catch (error) {
          this.context.metrics.errorCount++;
          await this.handleError(error);
        }

        this.context.metrics.totalProcessed++;
        this.context.metrics.processingTimeMs = Date.now() - startTime;
        this.context.metrics.lastRunAt = new Date();
        this.context.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
      }
    } catch (error) {
      this.context.logger.error('Fatal error in agent:', error);
      throw error;
    } finally {
      await this.stop();
    }
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    this.stopHealthChecks();
    await this.cleanup();
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        this.emit('health', health);
      } catch (error) {
        this.context.logger.error('Health check failed:', error);
      }
    }, 60000); // Every minute
  }

  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  // --- Error Handling ---
  protected async handleError(error: Error, context: string): Promise<void> {
    this.logger.error(`Error in ${context}:`, error);
    
    // Track error metric
    this.metrics.trackError(context, error.name);
    
    // Create alert for critical errors
    if (this.shouldCreateAlert(error)) {
      await this.alertManager.createAlert({
        severity: 'error',
        message: `Error in ${this.name}: ${error.message}`,
        source: this.name,
        timestamp: new Date().toISOString(),
        metadata: { context, error: error.stack }
      });
    }

    // Emit error event
    this.emit('error', { error, context });

    // Check if we should enter error state
    if (this.shouldEnterErrorState(error)) {
      this.status = 'error';
      await this.stop();
    }
  }

  protected shouldCreateAlert(error: Error): boolean {
    // Implement based on error type and severity
    return true;
  }

  protected shouldEnterErrorState(error: Error): boolean {
    // Implement based on error severity
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
        const startTime = Date.now();
        const result = await op.operation();
        
        // Track successful operation
        this.metrics.trackOperation(op.context, 'success');
        this.metrics.trackDuration(op.context, Date.now() - startTime);
        
        return result;
      } catch (error) {
        // Track failed attempt
        this.metrics.trackOperation(op.context, 'failure');
        
        if (op.attempts === op.maxAttempts) {
          await this.handleError(error, `${op.context} (final retry)`);
          throw error;
        }

        this.logger.warn(`Retry attempt ${op.attempts} for ${op.context}`, { error });
        
        // Calculate backoff
        const backoff = Math.min(
          this.config.retryConfig.backoffMs * Math.pow(2, op.attempts - 1),
          this.config.retryConfig.maxBackoffMs
        );
        
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  }

  // --- Health & Metrics ---
  private async runHealthCheck(): Promise<void> {
    try {
      const health = await this.healthCheck();
      await this.reportHealth(health);
    } catch (error) {
      await this.handleError(error, 'health check');
    }
  }

  private async collectAndReportMetrics(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      await this.reportMetrics(metrics);
    } catch (error) {
      await this.handleError(error, 'metrics collection');
    }
  }

  // --- Abstract Methods ---
  protected abstract validateDependencies(): Promise<void>;
  protected abstract initializeResources(): Promise<void>;
  protected abstract process(): Promise<void>;
  protected abstract healthCheck(): Promise<HealthStatus>;
  protected abstract collectMetrics(): Promise<Record<string, any>>;

  // --- Cleanup ---
  protected async cleanup(): Promise<void> {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    await this.metrics.shutdown();
    await this.alertManager.shutdown();
  }

  public getMetrics(): BaseMetrics {
    return { ...this.context.metrics };
  }

  public getHealth(): Promise<HealthStatus> {
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