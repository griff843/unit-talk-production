/**
 * Dead Letter Queue Implementation for Unit Talk Platform
 * Handles failed operations and provides recovery mechanisms
 */

export interface DeadLetterMessage<T = any> {
  id: string;
  payload: T;
  originalQueue: string;
  reason: string;
  error: string;
  attempts: number;
  maxAttempts: number;
  firstFailedAt: Date;
  lastFailedAt: Date;
  metadata: Record<string, any>;
}

export interface DLQConfig {
  maxRetentionDays: number;
  batchSize: number;
  processingIntervalMs: number;
  enableAutoRetry: boolean;
  maxAutoRetryAttempts: number;
  autoRetryIntervalMs: number;
}

export interface DLQStats {
  totalMessages: number;
  messagesByQueue: Record<string, number>;
  messagesByReason: Record<string, number>;
  oldestMessage: Date | null;
  newestMessage: Date | null;
  processingRate: number;
  recoveryRate: number;
}

/**
 * Dead Letter Queue for handling failed operations
 */
export class DeadLetterQueue<T = any> {
  private messages = new Map<string, DeadLetterMessage<T>>();
  private processingInterval: NodeJS.Timeout | null = null;
  private stats: DLQStats = {
    totalMessages: 0,
    messagesByQueue: {},
    messagesByReason: {},
    oldestMessage: null,
    newestMessage: null,
    processingRate: 0,
    recoveryRate: 0,
  };

  private readonly config: DLQConfig;
  private readonly retryHandlers = new Map<string, (message: DeadLetterMessage<T>) => Promise<boolean>>();

  constructor(config: Partial<DLQConfig> = {}) {
    this.config = {
      maxRetentionDays: config.maxRetentionDays ?? 30,
      batchSize: config.batchSize ?? 100,
      processingIntervalMs: config.processingIntervalMs ?? 300000, // 5 minutes
      enableAutoRetry: config.enableAutoRetry ?? true,
      maxAutoRetryAttempts: config.maxAutoRetryAttempts ?? 3,
      autoRetryIntervalMs: config.autoRetryIntervalMs ?? 3600000, // 1 hour
    };

    if (this.config.enableAutoRetry) {
      this.startAutoRetryProcessor();
    }
  }

  /**
   * Add a message to the dead letter queue
   */
  add(
    payload: T,
    originalQueue: string,
    reason: string,
    error: string,
    attempts: number = 1,
    maxAttempts: number = 3,
    metadata: Record<string, any> = {}
  ): string {
    const id = this.generateId();
    const now = new Date();

    const message: DeadLetterMessage<T> = {
      id,
      payload,
      originalQueue,
      reason,
      error,
      attempts,
      maxAttempts,
      firstFailedAt: now,
      lastFailedAt: now,
      metadata,
    };

    this.messages.set(id, message);
    this.updateStats();

    console.log(`[DLQ] Added message ${id} from queue ${originalQueue}: ${reason}`);
    return id;
  }

  /**
   * Get a message by ID
   */
  get(id: string): DeadLetterMessage<T> | null {
    return this.messages.get(id) || null;
  }

  /**
   * Get messages with optional filtering
   */
  getMessages(filter?: {
    queue?: string;
    reason?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'firstFailedAt' | 'lastFailedAt' | 'attempts';
    sortOrder?: 'asc' | 'desc';
  }): DeadLetterMessage<T>[] {
    let messages = Array.from(this.messages.values());

    // Apply filters
    if (filter?.queue) {
      messages = messages.filter(msg => msg.originalQueue === filter.queue);
    }

    if (filter?.reason) {
      messages = messages.filter(msg => msg.reason === filter.reason);
    }

    // Sort messages
    const sortBy = filter?.sortBy || 'lastFailedAt';
    const sortOrder = filter?.sortOrder || 'desc';
    
    messages.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      let comparison = 0;
      if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = (aValue as number) - (bValue as number);
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const offset = filter?.offset || 0;
    const limit = filter?.limit || messages.length;
    
    return messages.slice(offset, offset + limit);
  }

  /**
   * Remove a message from the DLQ
   */
  remove(id: string): boolean {
    const removed = this.messages.delete(id);
    if (removed) {
      this.updateStats();
      console.log(`[DLQ] Removed message ${id}`);
    }
    return removed;
  }

  /**
   * Remove multiple messages
   */
  removeBatch(ids: string[]): number {
    let removedCount = 0;
    for (const id of ids) {
      if (this.messages.delete(id)) {
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.updateStats();
      console.log(`[DLQ] Removed ${removedCount} messages`);
    }
    
    return removedCount;
  }

  /**
   * Register a retry handler for a specific queue
   */
  registerRetryHandler(
    queueName: string,
    handler: (message: DeadLetterMessage<T>) => Promise<boolean>
  ): void {
    this.retryHandlers.set(queueName, handler);
    console.log(`[DLQ] Registered retry handler for queue: ${queueName}`);
  }

  /**
   * Manually retry a specific message
   */
  async retryMessage(id: string): Promise<boolean> {
    const message = this.messages.get(id);
    if (!message) {
      return false;
    }

    const handler = this.retryHandlers.get(message.originalQueue);
    if (!handler) {
      console.warn(`[DLQ] No retry handler registered for queue: ${message.originalQueue}`);
      return false;
    }

    try {
      console.log(`[DLQ] Retrying message ${id} from queue ${message.originalQueue}`);
      const success = await handler(message);
      
      if (success) {
        this.messages.delete(id);
        this.updateStats();
        console.log(`[DLQ] Successfully recovered message ${id}`);
        return true;
      } else {
        message.attempts++;
        message.lastFailedAt = new Date();
        console.log(`[DLQ] Retry failed for message ${id}, attempts: ${message.attempts}`);
        return false;
      }
    } catch (error) {
      message.attempts++;
      message.lastFailedAt = new Date();
      message.error = error instanceof Error ? error.message : String(error);
      console.error(`[DLQ] Retry error for message ${id}:`, error);
      return false;
    }
  }

  /**
   * Retry messages in batch
   */
  async retryBatch(filter?: {
    queue?: string;
    reason?: string;
    maxAge?: number; // in hours
    limit?: number;
  }): Promise<{ attempted: number; succeeded: number; failed: number }> {
    let messages = this.getMessages({
      ...(filter?.queue !== undefined && { queue: filter.queue }),
      ...(filter?.reason !== undefined && { reason: filter.reason }),
      limit: filter?.limit || this.config.batchSize,
    });

    // Filter by age if specified
    if (filter?.maxAge) {
      const maxAgeMs = filter.maxAge * 60 * 60 * 1000;
      const cutoffTime = new Date(Date.now() - maxAgeMs);
      messages = messages.filter(msg => msg.lastFailedAt >= cutoffTime);
    }

    let attempted = 0;
    let succeeded = 0;
    let failed = 0;

    for (const message of messages) {
      attempted++;
      const success = await this.retryMessage(message.id);
      if (success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    console.log(`[DLQ] Batch retry completed: ${succeeded}/${attempted} succeeded`);
    return { attempted, succeeded, failed };
  }

  /**
   * Clean up old messages
   */
  cleanup(maxAgeHours?: number): number {
    const maxAge = maxAgeHours || (this.config.maxRetentionDays * 24);
    const cutoffTime = new Date(Date.now() - (maxAge * 60 * 60 * 1000));
    
    const toRemove: string[] = [];
    
    for (const [id, message] of this.messages.entries()) {
      if (message.firstFailedAt < cutoffTime) {
        toRemove.push(id);
      }
    }

    const removedCount = this.removeBatch(toRemove);
    console.log(`[DLQ] Cleanup removed ${removedCount} old messages`);
    
    return removedCount;
  }

  /**
   * Get DLQ statistics
   */
  getStats(): DLQStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Export messages for analysis or backup
   */
  exportMessages(format: 'json' | 'csv' = 'json'): string {
    const messages = Array.from(this.messages.values());
    
    if (format === 'csv') {
      const headers = [
        'id', 'originalQueue', 'reason', 'attempts', 'maxAttempts', 
        'firstFailedAt', 'lastFailedAt', 'error'
      ];
      
      const csvLines = [headers.join(',')];
      
      for (const message of messages) {
        const row = [
          message.id,
          message.originalQueue,
          message.reason,
          message.attempts,
          message.maxAttempts,
          message.firstFailedAt.toISOString(),
          message.lastFailedAt.toISOString(),
          `"${message.error.replace(/"/g, '""')}"` // Escape quotes
        ];
        csvLines.push(row.join(','));
      }
      
      return csvLines.join('\n');
    } else {
      return JSON.stringify(messages, null, 2);
    }
  }

  /**
   * Start automatic retry processor
   */
  private startAutoRetryProcessor(): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(async () => {
      try {
        await this.processAutoRetries();
      } catch (error) {
        console.error('[DLQ] Auto retry processor error:', error);
      }
    }, this.config.processingIntervalMs);

    console.log('[DLQ] Started auto retry processor');
  }

  /**
   * Stop automatic retry processor
   */
  stopAutoRetryProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('[DLQ] Stopped auto retry processor');
    }
  }

  /**
   * Process automatic retries
   */
  private async processAutoRetries(): Promise<void> {
    const cutoffTime = new Date(Date.now() - this.config.autoRetryIntervalMs);
    
    const eligibleMessages = Array.from(this.messages.values()).filter(message => 
      message.attempts < this.config.maxAutoRetryAttempts &&
      message.lastFailedAt <= cutoffTime
    );

    if (eligibleMessages.length === 0) {
      return;
    }

    console.log(`[DLQ] Processing ${eligibleMessages.length} eligible messages for auto retry`);

    for (const message of eligibleMessages.slice(0, this.config.batchSize)) {
      await this.retryMessage(message.id);
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    const messages = Array.from(this.messages.values());
    
    this.stats.totalMessages = messages.length;
    this.stats.messagesByQueue = {};
    this.stats.messagesByReason = {};
    
    let oldest: Date | null = null;
    let newest: Date | null = null;
    
    for (const message of messages) {
      // Count by queue
      this.stats.messagesByQueue[message.originalQueue] = 
        (this.stats.messagesByQueue[message.originalQueue] || 0) + 1;
      
      // Count by reason
      this.stats.messagesByReason[message.reason] = 
        (this.stats.messagesByReason[message.reason] || 0) + 1;
      
      // Track oldest and newest
      if (!oldest || message.firstFailedAt < oldest) {
        oldest = message.firstFailedAt;
      }
      if (!newest || message.lastFailedAt > newest) {
        newest = message.lastFailedAt;
      }
    }
    
    this.stats.oldestMessage = oldest;
    this.stats.newestMessage = newest;
  }

  /**
   * Generate unique message ID
   */
  private generateId(): string {
    return `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown the DLQ
   */
  shutdown(): void {
    this.stopAutoRetryProcessor();
    console.log('[DLQ] Shutdown completed');
  }
}

/**
 * Global Dead Letter Queue registry
 */
export class DLQRegistry {
  private static instance: DLQRegistry;
  private queues = new Map<string, DeadLetterQueue>();

  static getInstance(): DLQRegistry {
    if (!DLQRegistry.instance) {
      DLQRegistry.instance = new DLQRegistry();
    }
    return DLQRegistry.instance;
  }

  getQueue<T = any>(name: string, config?: Partial<DLQConfig>): DeadLetterQueue<T> {
    if (!this.queues.has(name)) {
      this.queues.set(name, new DeadLetterQueue<T>(config));
    }
    return this.queues.get(name)! as DeadLetterQueue<T>;
  }

  getAllStats(): Record<string, DLQStats> {
    const stats: Record<string, DLQStats> = {};
    
    this.queues.forEach((queue, name) => {
      stats[name] = queue.getStats();
    });

    return stats;
  }

  shutdown(): void {
    this.queues.forEach(queue => queue.shutdown());
    this.queues.clear();
  }
}