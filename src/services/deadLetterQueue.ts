import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { z } from 'zod';
import { EventEmitter } from 'events';

export const DeadLetterSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  operation: z.string(),
  payload: z.unknown(),
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
    code: z.string().optional(),
  }),
  retry_count: z.number().int(),
  max_retries: z.number().int(),
  next_retry: z.string().datetime().optional(),
  status: z.enum(['pending', 'retrying', 'failed', 'resolved']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DeadLetter = z.infer<typeof DeadLetterSchema>;

export interface DLQConfig {
  maxRetries: number;
  initialRetryDelayMs: number;
  maxRetryDelayMs: number;
  processingIntervalMs: number;
}



export class DeadLetterQueue extends EventEmitter {
  private static instance: DeadLetterQueue;
  private readonly logger: Logger;
  private processingInterval?: NodeJS.Timeout;

  private constructor(
    private readonly supabase: SupabaseClient,
    private readonly config: DLQConfig
  ) {
    super();
    this.logger = new Logger('DLQ');
  }

  public static getInstance(
    supabase: SupabaseClient,
    config: DLQConfig
  ): DeadLetterQueue {
    if (!DeadLetterQueue.instance) {
      DeadLetterQueue.instance = new DeadLetterQueue(supabase, config);
    }
    return DeadLetterQueue.instance;
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Dead Letter Queue');
    await this.setupProcessing();
  }

  public async enqueue(
    agent: string,
    operation: string,
    payload: unknown,
    error: Error
  ): Promise<void> {
    try {
      const deadLetter: Omit<DeadLetter, 'id' | 'created_at' | 'updated_at'> = {
        agent,
        operation,
        payload,
        error: {
          message: error.message,
          stack: error.stack,
          code: (error as Error & { code?: string }).code,
        },
        retry_count: 0,
        max_retries: this.config.maxRetries,
        status: 'pending',
        next_retry: new Date(
          Date.now() + this.config.initialRetryDelayMs
        ).toISOString(),
      };

      await this.supabase.from('dead_letter_queue').insert(deadLetter);
      
      this.logger.info('Message enqueued to DLQ', {
        agent,
        operation,
        error: error.message,
      });
    } catch (error) {
      this.logger.error('Failed to enqueue to DLQ:', error as Error);
      throw error;
    }
  }

  private async setupProcessing(): Promise<void> {
    this.processingInterval = setInterval(
      () => this.processQueue(),
      this.config.processingIntervalMs
    );
  }

  private async processQueue(): Promise<void> {
    try {
      const { data: deadLetters, error } = await this.supabase
        .from('dead_letter_queue')
        .select('*')
        .in('status', ['pending', 'retrying'])
        .lte('next_retry', new Date().toISOString())
        .order('next_retry', { ascending: true })
        .limit(10);

      if (error) throw error;

      for (const letter of deadLetters || []) {
        await this.processDeadLetter(letter);
      }
    } catch (error) {
      this.logger.error('Failed to process DLQ:', error as Error);
    }
  }

  private async processDeadLetter(letter: DeadLetter): Promise<void> {
    try {
      // Update status to retrying
      await this.supabase
        .from('dead_letter_queue')
        .update({ status: 'retrying' })
        .eq('id', letter.id);

      // Attempt to replay the operation
      await this.replayOperation(letter);

      // Mark as resolved if successful
      await this.supabase
        .from('dead_letter_queue')
        .update({ 
          status: 'resolved',
          updated_at: new Date().toISOString()
        })
        .eq('id', letter.id);

      this.logger.info('Successfully processed dead letter', {
        id: letter.id,
        agent: letter.agent,
        operation: letter.operation,
      });
    } catch (error) {
      const retryCount = letter.retry_count + 1;
      const status = retryCount >= letter.max_retries ? 'failed' : 'pending';
      
      await this.supabase
        .from('dead_letter_queue')
        .update({
          status,
          retry_count: retryCount,
          next_retry: this.calculateNextRetry(retryCount),
          updated_at: new Date().toISOString(),
        })
        .eq('id', letter.id);

      this.logger.warn('Failed to process dead letter', {
        id: letter.id,
        agent: letter.agent,
        operation: letter.operation,
        retryCount,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async replayOperation(letter: DeadLetter): Promise<void> {
    // Emit event for agent to handle
    this.emit('replay', {
      agent: letter.agent,
      operation: letter.operation,
      payload: letter.payload,
    });
  }

  private calculateNextRetry(retryCount: number): string {
    const delay = Math.min(
      this.config.initialRetryDelayMs * Math.pow(2, retryCount),
      this.config.maxRetryDelayMs
    );
    
    return new Date(Date.now() + delay).toISOString();
  }

  public async shutdown(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }
}

// Create and export a singleton instance
export const dlq = DeadLetterQueue.getInstance(
  // Supabase client will be injected at runtime
  null as unknown as SupabaseClient,
  {
    maxRetries: 3,
    initialRetryDelayMs: 1000 * 60, // 1 minute
    maxRetryDelayMs: 1000 * 60 * 60, // 1 hour
    processingIntervalMs: 1000 * 30, // 30 seconds
  }
); 