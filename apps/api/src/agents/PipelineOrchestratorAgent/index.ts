import { randomUUID } from 'crypto';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult, BaseMetrics } from '../BaseAgent/types';
import { ScoringCoordinatorAgent } from '../ScoringCoordinatorAgent';
import { PromotionAgent } from '../PromotionAgent';
import { HealthMonitorAgent } from '../HealthMonitorAgent';
import { requireSupabase } from '../../utils/supabaseUtils';

export interface PipelineOrchestratorMetrics extends BaseMetrics {
  propsDetected: number;
  batchesProcessed: number;
  totalPropsProcessed: number;
  averageBatchSize: number;
  averageProcessingTimeMs: number;
  queueDepth: number;
  backpressureEvents: number;
  circuitBreakerTrips: number;
  pipelineUptime: number;
}

export interface PipelineConfig extends BaseAgentConfig {
  batchSize: number;
  maxConcurrentBatches: number;
  pollIntervalMs: number;
  maxQueueDepth: number;
  circuitBreakerThreshold: number;
  backpressureThreshold: number;
  healthCheckIntervalMs: number;
}

/**
 * Pipeline Orchestrator Agent
 *
 * Responsibilities:
 * - Monitor raw_props table for new entries
 * - Trigger processing workflows in coordinated batches
 * - Handle backpressure and circuit breaker patterns
 * - Coordinate with other agents in the swarm
 * - Maintain pipeline health and performance metrics
 */
export class PipelineOrchestratorAgent extends BaseAgent {
  protected metrics: PipelineOrchestratorMetrics;
  protected config: PipelineConfig;
  private scoringCoordinator: ScoringCoordinatorAgent;
  private promotionAgent: PromotionAgent;
  private healthMonitor: HealthMonitorAgent;

  // Pipeline state management
  private processingQueue: Set<string> = new Set();
  private circuitBreakerOpen = false;
  private lastProcessedTimestamp: string | null = null;
  private pollingTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;

  // Performance tracking
  private batchStartTimes: Map<string, number> = new Map();
  private recentProcessingTimes: number[] = [];
  private readonly MAX_RECENT_TIMES = 100;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    this.config = {
      ...config,
      batchSize: parseInt(process.env.PIPELINE_BATCH_SIZE || '50'),
      maxConcurrentBatches: parseInt(process.env.PIPELINE_MAX_CONCURRENT || '5'),
      pollIntervalMs: parseInt(process.env.PIPELINE_POLL_INTERVAL || '30000'), // 30 seconds
      maxQueueDepth: parseInt(process.env.PIPELINE_MAX_QUEUE_DEPTH || '1000'),
      circuitBreakerThreshold: parseInt(process.env.PIPELINE_CIRCUIT_BREAKER_THRESHOLD || '10'),
      backpressureThreshold: parseInt(process.env.PIPELINE_BACKPRESSURE_THRESHOLD || '500'),
      healthCheckIntervalMs: parseInt(process.env.PIPELINE_HEALTH_CHECK_INTERVAL || '60000') // 1 minute
    };

    this.metrics = {
      agentName: this.config.name,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0,
      propsDetected: 0,
      batchesProcessed: 0,
      totalPropsProcessed: 0,
      averageBatchSize: 0,
      averageProcessingTimeMs: 0,
      queueDepth: 0,
      backpressureEvents: 0,
      circuitBreakerTrips: 0,
      pipelineUptime: 0
    };

    // Initialize coordinated agents
    this.scoringCoordinator = new ScoringCoordinatorAgent(config, deps);
    this.promotionAgent = new PromotionAgent(config, deps);
    this.healthMonitor = new HealthMonitorAgent(config, deps);
  }

  async initialize(): Promise<void> {
    this.logger.info('🎛️ Initializing Pipeline Orchestrator Agent', {
      batchSize: this.config.batchSize,
      maxConcurrentBatches: this.config.maxConcurrentBatches,
      pollIntervalMs: this.config.pollIntervalMs
    });

    // Verify database access
    if (!this.hasSupabase()) {
      throw new Error('Supabase client required for Pipeline Orchestrator');
    }

    // Test connectivity to required tables
    const requiredTables = ['raw_props', 'unified_picks', 'agent_health'];
    for (const table of requiredTables) {
      try {
        const { error } = await this.requireSupabase()
          .from(table)
          .select('count')
          .limit(1);
        if (error) {
          this.logger.warn(`⚠️ Table ${table} connectivity issue: ${error.message}`);
        } else {
          this.logger.info(`✅ Pipeline table ${table} accessible`);
        }
      } catch (err) {
        this.logger.error(`❌ Failed to access table ${table}`, {
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    // Initialize coordinated agents
    await this.scoringCoordinator.initialize();
    await this.promotionAgent.initialize();
    await this.healthMonitor.initialize();

    // Get last processed timestamp for resume capability
    await this.loadLastProcessedTimestamp();

    // Start monitoring timers
    this.startPolling();
    this.startHealthChecks();

    this.logger.info('✅ Pipeline Orchestrator Agent initialized successfully');
  }

  async process(): Promise<void> {
    const startTime = Date.now();
    this.logger.debug('🔄 Pipeline orchestrator processing cycle starting');

    try {
      // Check circuit breaker
      if (this.circuitBreakerOpen) {
        this.logger.warn('⚡ Circuit breaker open, skipping processing cycle');
        await this.checkCircuitBreakerRecovery();
        return;
      }

      // Check backpressure
      if (this.processingQueue.size > this.config.backpressureThreshold) {
        this.metrics.backpressureEvents++;
        this.logger.warn('🚧 Backpressure detected, throttling processing', {
          queueDepth: this.processingQueue.size,
          threshold: this.config.backpressureThreshold
        });
        await this.handleBackpressure();
        return;
      }

      // Detect new props to process
      const newProps = await this.detectNewProps();

      if (newProps.length === 0) {
        this.logger.debug('📭 No new props detected for processing');
        return;
      }

      this.metrics.propsDetected += newProps.length;
      this.logger.info(`📊 Detected ${newProps.length} new props for processing`, {
        queueDepth: this.processingQueue.size,
        maxConcurrent: this.config.maxConcurrentBatches
      });

      // Create batches for processing
      const batches = this.createProcessingBatches(newProps);

      // Process batches with concurrency control
      await this.processBatchesConcurrently(batches);

      this.logger.info(`✅ Pipeline processing cycle completed`, {
        propsDetected: newProps.length,
        batchesCreated: batches.length,
        processingTimeMs: Date.now() - startTime
      });

    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error('❌ Pipeline orchestrator processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Consider opening circuit breaker
      await this.evaluateCircuitBreaker();
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up Pipeline Orchestrator Agent');

    // Stop timers
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Wait for all processing to complete
    await this.waitForProcessingCompletion();

    // Cleanup coordinated agents
    await this.scoringCoordinator.cleanup();
    await this.promotionAgent.cleanup();
    await this.healthMonitor.cleanup();

    // Save state
    await this.saveLastProcessedTimestamp();

    this.logger.info('✅ Pipeline Orchestrator Agent cleanup completed');
  }

  protected async collectMetrics(): Promise<PipelineOrchestratorMetrics> {
    return {
      ...this.metrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
      queueDepth: this.processingQueue.size,
      averageProcessingTimeMs: this.getAverageProcessingTime()
    };
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const checks: Array<{ service: string; status: string; error?: string; details?: any }> = [];

    // Database connectivity
    if (this.hasSupabase()) {
      try {
        const { count } = await this.requireSupabase()
          .from('sports_game_odds')
          .select('count')
          .single();
        checks.push({
          service: 'database',
          status: 'healthy',
          details: { rawPropsCount: count }
        });
      } catch (error) {
        checks.push({
          service: 'database',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Coordinated agents health
    const coordinatorHealth = await this.scoringCoordinator.checkHealth();
    checks.push({
      service: 'scoringCoordinator',
      status: coordinatorHealth.status,
      details: coordinatorHealth.details
    });

    const promotionHealth = await this.promotionAgent.checkHealth();
    checks.push({
      service: 'promotionAgent',
      status: promotionHealth.status,
      details: promotionHealth.details
    });

    const monitorHealth = await this.healthMonitor.checkHealth();
    checks.push({
      service: 'healthMonitor',
      status: monitorHealth.status,
      details: monitorHealth.details
    });

    // Pipeline performance checks
    const avgProcessingTime = this.getAverageProcessingTime();
    const performanceHealthy = avgProcessingTime < 30000 && this.metrics.errorCount < 10;

    checks.push({
      service: 'pipelinePerformance',
      status: performanceHealthy ? 'healthy' : 'degraded',
      details: {
        avgProcessingTimeMs: avgProcessingTime,
        queueDepth: this.processingQueue.size,
        circuitBreakerOpen: this.circuitBreakerOpen,
        backpressureEvents: this.metrics.backpressureEvents
      }
    });

    const isHealthy = checks.every(check => check.status === 'healthy');

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      details: { checks, metrics: this.metrics }
    };
  }

  // Private implementation methods

  private async detectNewProps(): Promise<any[]> {
    if (!this.hasSupabase()) {
      return [];
    }

    try {
      let query = this.requireSupabase()
        .from('sports_game_odds')
        .select('*')
        .is('processed_at', null) // Only unprocessed props
        .order('created_at', { ascending: true })
        .limit(this.config.batchSize * this.config.maxConcurrentBatches);

      // Resume from last processed timestamp if available
      if (this.lastProcessedTimestamp) {
        query = query.gt('created_at', this.lastProcessedTimestamp);
      }

      const { data: props, error } = await query;

      if (error) {
        this.logger.error('❌ Failed to detect new props', { error: error.message });
        return [];
      }

      return props || [];
    } catch (error) {
      this.logger.error('❌ Error detecting new props', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  private createProcessingBatches(props: any[]): any[][] {
    const batches: any[][] = [];
    for (let i = 0; i < props.length; i += this.config.batchSize) {
      batches.push(props.slice(i, i + this.config.batchSize));
    }
    return batches;
  }

  private async processBatchesConcurrently(batches: any[][]): Promise<void> {
    const semaphore = new Array(this.config.maxConcurrentBatches).fill(null);
    const promises: Promise<void>[] = [];

    for (const batch of batches) {
      const promise = this.processSingleBatch(batch);
      promises.push(promise);

      // Limit concurrency
      if (promises.length >= this.config.maxConcurrentBatches) {
        await Promise.race(promises);
        promises.splice(promises.findIndex(p => p === promise), 1);
      }
    }

    // Wait for all remaining batches
    await Promise.all(promises);
  }

  private async processSingleBatch(batch: any[]): Promise<void> {
    const batchId = randomUUID();
    const startTime = Date.now();
    this.batchStartTimes.set(batchId, startTime);

    try {
      this.logger.info(`🎯 Processing batch ${batchId}`, {
        batchSize: batch.length,
        propIds: batch.slice(0, 3).map(p => p.id) // Log first 3 IDs
      });

      // Mark props as being processed
      const propIds = batch.map(p => p.id);
      this.processingQueue = new Set([...this.processingQueue, ...propIds]);

      // 1. Score props through ScoringCoordinator
      const scoringResults = await this.scoringCoordinator.scoreBatch(batch);

      // 2. Promote qualifying props through PromotionAgent
      const promotionResults = await this.promotionAgent.evaluateAndPromote(scoringResults);

      // 3. Update metrics
      this.updateBatchMetrics(batchId, batch.length, startTime);

      // 4. Mark props as processed
      await this.markPropsAsProcessed(propIds);

      // 5. Remove from processing queue
      propIds.forEach(id => this.processingQueue.delete(id));

      this.logger.info(`✅ Batch ${batchId} completed`, {
        processingTimeMs: Date.now() - startTime,
        scored: scoringResults.length,
        promoted: promotionResults.promoted.length
      });

    } catch (error) {
      this.logger.error(`❌ Batch ${batchId} processing failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        batchSize: batch.length
      });

      // Remove from processing queue on failure
      batch.forEach(p => this.processingQueue.delete(p.id));
      throw error;
    } finally {
      this.batchStartTimes.delete(batchId);
    }
  }

  private async markPropsAsProcessed(propIds: string[]): Promise<void> {
    if (!this.hasSupabase() || propIds.length === 0) {
      return;
    }

    try {
      const { error } = await this.requireSupabase()
        .from('sports_game_odds')
        .update({
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', propIds);

      if (error) {
        this.logger.error('❌ Failed to mark props as processed', {
          error: error.message,
          propIds: propIds.slice(0, 5) // Log first 5 IDs
        });
      }
    } catch (error) {
      this.logger.error('❌ Error marking props as processed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        propIds: propIds.length
      });
    }
  }

  private updateBatchMetrics(batchId: string, batchSize: number, startTime: number): void {
    const processingTime = Date.now() - startTime;

    // Update recent processing times
    this.recentProcessingTimes.push(processingTime);
    if (this.recentProcessingTimes.length > this.MAX_RECENT_TIMES) {
      this.recentProcessingTimes.shift();
    }

    // Update metrics
    this.metrics.batchesProcessed++;
    this.metrics.totalPropsProcessed += batchSize;
    this.metrics.averageBatchSize = this.metrics.totalPropsProcessed / this.metrics.batchesProcessed;
    this.metrics.averageProcessingTimeMs = this.getAverageProcessingTime();
    this.metrics.queueDepth = this.processingQueue.size;
    this.metrics.successCount++;
  }

  private getAverageProcessingTime(): number {
    if (this.recentProcessingTimes.length === 0) return 0;
    return this.recentProcessingTimes.reduce((sum, time) => sum + time, 0) / this.recentProcessingTimes.length;
  }

  private async handleBackpressure(): Promise<void> {
    this.logger.info('🚧 Implementing backpressure controls', {
      queueDepth: this.processingQueue.size,
      threshold: this.config.backpressureThreshold
    });

    // Wait for queue to reduce
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Could implement additional backpressure strategies:
    // - Increase batch processing delays
    // - Reduce batch sizes temporarily
    // - Alert operators about high load
  }

  private async evaluateCircuitBreaker(): Promise<void> {
    if (this.metrics.errorCount >= this.config.circuitBreakerThreshold) {
      this.circuitBreakerOpen = true;
      this.metrics.circuitBreakerTrips++;

      this.logger.warn('⚡ Circuit breaker opened due to excessive errors', {
        errorCount: this.metrics.errorCount,
        threshold: this.config.circuitBreakerThreshold
      });

      // Set timer to attempt recovery
      setTimeout(() => {
        this.checkCircuitBreakerRecovery();
      }, 60000); // Try recovery after 1 minute
    }
  }

  private async checkCircuitBreakerRecovery(): Promise<void> {
    if (this.circuitBreakerOpen) {
      // Reset error count and attempt to close circuit breaker
      this.metrics.errorCount = Math.floor(this.metrics.errorCount / 2);

      if (this.metrics.errorCount < this.config.circuitBreakerThreshold / 2) {
        this.circuitBreakerOpen = false;
        this.logger.info('⚡ Circuit breaker closed - attempting recovery');
      }
    }
  }

  private async waitForProcessingCompletion(): Promise<void> {
    const maxWaitMs = 30000; // 30 seconds max wait
    const startTime = Date.now();

    while (this.processingQueue.size > 0 && (Date.now() - startTime) < maxWaitMs) {
      this.logger.info(`⏳ Waiting for ${this.processingQueue.size} props to complete processing`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.processingQueue.size > 0) {
      this.logger.warn(`⚠️ Force shutdown with ${this.processingQueue.size} props still processing`);
    }
  }

  private startPolling(): void {
    this.pollingTimer = setInterval(async () => {
      try {
        await this.process();
      } catch (error) {
        this.logger.error('❌ Polling cycle error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, this.config.pollIntervalMs);
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        await this.healthMonitor.recordServiceHealth('pipeline-orchestrator', health);
      } catch (error) {
        this.logger.error('❌ Health check error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, this.config.healthCheckIntervalMs);
  }

  private async loadLastProcessedTimestamp(): Promise<void> {
    // Implementation would load from persistent storage
    // For now, start from current time
    this.lastProcessedTimestamp = new Date().toISOString();
  }

  private async saveLastProcessedTimestamp(): Promise<void> {
    // Implementation would save to persistent storage
    this.logger.info('💾 Saving pipeline state', {
      lastProcessedTimestamp: this.lastProcessedTimestamp
    });
  }

  // Public interface methods

  public async pausePipeline(): Promise<void> {
    this.logger.info('⏸️ Pausing pipeline processing');
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  public async resumePipeline(): Promise<void> {
    this.logger.info('▶️ Resuming pipeline processing');
    this.startPolling();
  }

  public getPipelineMetrics(): PipelineOrchestratorMetrics {
    return { ...this.metrics };
  }

  public getQueueStatus(): {
    queueDepth: number;
    circuitBreakerOpen: boolean;
    averageProcessingTime: number;
    backpressureActive: boolean;
  } {
    return {
      queueDepth: this.processingQueue.size,
      circuitBreakerOpen: this.circuitBreakerOpen,
      averageProcessingTime: this.getAverageProcessingTime(),
      backpressureActive: this.processingQueue.size > this.config.backpressureThreshold
    };
  }
}