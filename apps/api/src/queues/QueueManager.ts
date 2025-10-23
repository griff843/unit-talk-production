import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger, createLogger } from '../utils/logger';
import { performance } from 'perf_hooks';

export interface QueueConfig {
  name: string;
  concurrency: number;
  defaultJobOptions?: {
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
    attempts?: number;
    backoff?: {
      type: string;
      delay: number;
    };
  };
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  avgProcessingTime: number;
  throughput: number;
}

export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  // Note: QueueScheduler removed in newer bullmq versions
  private events: Map<string, QueueEvents> = new Map();
  private logger: Logger;
  private redis: Redis;
  private metricsInterval: NodeJS.Timer | null = null;

  constructor(redisUrl: string) {
    this.logger = createLogger('QueueManager');
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  /**
   * Initialize a queue with worker
   */
  async createQueue<T = any>(
    config: QueueConfig,
    processor: (job: Job<T>) => Promise<any>
  ): Promise<Queue<T>> {
    const { name, concurrency, defaultJobOptions } = config;

    // Create queue
    const queue = new Queue<T>(name, {
      connection: this.redis.duplicate(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        ...defaultJobOptions,
      },
    });

    // Note: QueueScheduler no longer needed in newer bullmq versions

    // Create worker
    const worker = new Worker<T>(
      name,
      async (job) => {
        const start = performance.now();
        try {
          const result = await processor(job);
          const duration = performance.now() - start;
          
          // Update metrics
          await this.updateJobMetrics(name, duration, 'completed');
          
          return result;
        } catch (error) {
          const duration = performance.now() - start;
          await this.updateJobMetrics(name, duration, 'failed');
          throw error;
        }
      },
      {
        connection: this.redis.duplicate(),
        concurrency,
      }
    );

    // Create events listener
    const events = new QueueEvents(name, {
      connection: this.redis.duplicate(),
    });

    // Set up event listeners
    this.setupEventListeners(name, worker, events);

    // Store references
    this.queues.set(name, queue);
    this.workers.set(name, worker);
    // Note: scheduler removed from newer bullmq versions
    this.events.set(name, events);

    this.logger.info(`Queue ${name} created with concurrency ${concurrency}`);

    return queue;
  }

  /**
   * Set up event listeners for a queue
   */
  private setupEventListeners(name: string, worker: Worker, events: QueueEvents): void {
    worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed in queue ${name}`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed in queue ${name}:`, err);
    });

    worker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled in queue ${name}`);
    });

    events.on('waiting', ({ jobId }) => {
      this.logger.debug(`Job ${jobId} waiting in queue ${name}`);
    });

    events.on('delayed', ({ jobId, delay }) => {
      this.logger.debug(`Job ${jobId} delayed by ${delay}ms in queue ${name}`);
    });
  }

  /**
   * Add job to queue
   */
  async addJob<T = any>(
    queueName: string,
    data: T,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
      backoff?: any;
      jobId?: string;
    }
  ): Promise<Job<T>> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add('process', data, options);
    this.logger.debug(`Job ${job.id} added to queue ${queueName}`);
    
    return job;
  }

  /**
   * Add bulk jobs
   */
  async addBulkJobs<T = any>(
    queueName: string,
    jobs: Array<{ data: T; opts?: any }>
  ): Promise<Job<T>[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobsToAdd = jobs.map(({ data, opts }) => ({
      name: 'process',
      data,
      opts,
    }));

    const addedJobs = await queue.addBulk(jobsToAdd);
    this.logger.info(`${addedJobs.length} jobs added to queue ${queueName}`);
    
    return addedJobs;
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    // Get processing time metrics
    const metrics = await this.getProcessingMetrics(queueName);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      avgProcessingTime: metrics.avgTime,
      throughput: metrics.throughput,
    };
  }

  /**
   * Get all queue metrics
   */
  async getAllMetrics(): Promise<Record<string, QueueMetrics>> {
    const metrics: Record<string, QueueMetrics> = {};

    for (const queueName of this.queues.keys()) {
      metrics[queueName] = await this.getQueueMetrics(queueName);
    }

    return metrics;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    const worker = this.workers.get(queueName);

    if (!queue || !worker) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    await worker.pause();
    
    this.logger.info(`Queue ${queueName} paused`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    const worker = this.workers.get(queueName);

    if (!queue || !worker) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    await worker.resume();
    
    this.logger.info(`Queue ${queueName} resumed`);
  }

  /**
   * Clean completed/failed jobs
   */
  async cleanQueue(
    queueName: string,
    grace: number = 0,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<string[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const cleaned = await queue.clean(grace, 1000, status);
    this.logger.info(`Cleaned ${cleaned.length} ${status} jobs from queue ${queueName}`);
    
    return cleaned;
  }

  /**
   * Drain a queue (remove all jobs)
   */
  async drainQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.drain();
    this.logger.warn(`Queue ${queueName} drained`);
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection(intervalMs: number = 60000): void {
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.getAllMetrics();
        
        // Log metrics
        for (const [queueName, queueMetrics] of Object.entries(metrics)) {
          this.logger.info(`Queue ${queueName} metrics:`, queueMetrics);
          
          // Export to Prometheus or other monitoring
          // This would integrate with the metrics system
        }
      } catch (error) {
        this.logger.error('Metrics collection error:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop metrics collection
   */
  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval as NodeJS.Timeout);
      this.metricsInterval = null;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down queue manager...');
    
    this.stopMetricsCollection();

    // Close all workers
    for (const [name, worker] of this.workers) {
      await worker.close();
      this.logger.info(`Worker ${name} closed`);
    }

    // Note: Schedulers no longer needed in newer bullmq versions

    // Close all event listeners
    for (const [name, events] of this.events) {
      await events.close();
      this.logger.info(`Events ${name} closed`);
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.info(`Queue ${name} closed`);
    }

    // Close Redis connection
    await this.redis.quit();
    
    this.logger.info('Queue manager shutdown complete');
  }

  /**
   * Update job processing metrics
   */
  private async updateJobMetrics(
    queueName: string,
    duration: number,
    status: 'completed' | 'failed'
  ): Promise<void> {
    const key = `metrics:${queueName}:${status}`;
    const timestamp = Date.now();
    
    // Store in Redis for aggregation
    await this.redis.zadd(key, timestamp, `${duration}:${timestamp}`);
    
    // Keep only last hour of data
    const hourAgo = timestamp - 3600000;
    await this.redis.zremrangebyscore(key, 0, hourAgo);
  }

  /**
   * Get processing metrics
   */
  private async getProcessingMetrics(
    queueName: string
  ): Promise<{ avgTime: number; throughput: number }> {
    const key = `metrics:${queueName}:completed`;
    const now = Date.now();
    const minuteAgo = now - 60000;
    
    // Get last minute of data
    const data = await this.redis.zrangebyscore(key, minuteAgo, now);
    
    if (data.length === 0) {
      return { avgTime: 0, throughput: 0 };
    }
    
    let totalTime = 0;
    for (const entry of data) {
      const [duration] = entry.split(':');
      totalTime += parseFloat(duration);
    }
    
    return {
      avgTime: totalTime / data.length,
      throughput: data.length, // jobs per minute
    };
  }
}

// Queue definitions for the Unit Talk platform
export const QUEUE_DEFINITIONS = {
  ingestion: {
    name: 'prop-ingestion',
    concurrency: 10,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 1000,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  },
  scoring: {
    name: 'prop-scoring',
    concurrency: 5,
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 500,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  },
  alerts: {
    name: 'alert-processing',
    concurrency: 20,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: 'fixed',
        delay: 1000,
      },
    },
  },
  analytics: {
    name: 'analytics-processing',
    concurrency: 3,
    defaultJobOptions: {
      removeOnComplete: 10,
      removeOnFail: 100,
      attempts: 1,
    },
  },
};