/**
 * Phase 6: Deterministic Retry Module
 * Provides consistent, predictable retry behavior with idempotency guarantees
 */

import { createHash } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

export type ErrorType = 'retryable' | 'non-retryable' | 'fatal' | 'transient';

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitter: boolean; // Deterministic jitter based on idempotency key
}

export interface RetryContext {
  agent_name: string;
  operation_type: string;
  operation_data: Record<string, any>;
  idempotency_key?: string; // If not provided, will be generated
  policy?: Partial<RetryPolicy>;
}

export interface RetryState {
  id: string;
  agent_name: string;
  operation_type: string;
  idempotency_key: string;
  attempt_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  error_type: ErrorType | null;
  status: 'pending' | 'retrying' | 'succeeded' | 'failed' | 'abandoned';
  operation_data: Record<string, any>;
  result_data: Record<string, any> | null;
}

export interface ErrorClassification {
  type: ErrorType;
  retryable: boolean;
  message: string;
  code?: string;
}

/**
 * DeterministicRetryModule
 *
 * Ensures:
 * 1. Same input + idempotency key = identical retry schedule
 * 2. Durable state survives restarts
 * 3. Error classification guides retry behavior
 * 4. No duplicate execution for same idempotency key
 */
export class DeterministicRetryModule {
  private readonly supabase: SupabaseClient;
  private readonly defaultPolicy: RetryPolicy = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
    backoffFactor: 2.0,
    jitter: true,
  };

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Classify error to determine retry behavior
   */
  public classifyError(error: Error): ErrorClassification {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name;

    // Fatal errors - never retry
    if (errorName === 'ValidationError' || errorMessage.includes('invalid')) {
      return {
        type: 'fatal',
        retryable: false,
        message: 'Fatal validation error',
        code: 'FATAL_VALIDATION',
      };
    }

    if (errorMessage.includes('duplicate') || errorMessage.includes('unique constraint')) {
      return {
        type: 'non-retryable',
        retryable: false,
        message: 'Duplicate operation detected',
        code: 'DUPLICATE',
      };
    }

    // Non-retryable errors
    if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      return {
        type: 'non-retryable',
        retryable: false,
        message: 'Authorization error',
        code: 'AUTH_ERROR',
      };
    }

    if (errorMessage.includes('not found') && !errorMessage.includes('network')) {
      return {
        type: 'non-retryable',
        retryable: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      };
    }

    // Retryable errors
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('network')
    ) {
      return {
        type: 'transient',
        retryable: true,
        message: 'Transient network error',
        code: 'NETWORK_ERROR',
      };
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return {
        type: 'retryable',
        retryable: true,
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT',
      };
    }

    if (
      errorMessage.includes('500') ||
      errorMessage.includes('503') ||
      errorMessage.includes('internal server')
    ) {
      return {
        type: 'retryable',
        retryable: true,
        message: 'Server error',
        code: 'SERVER_ERROR',
      };
    }

    // Default: retryable
    return {
      type: 'retryable',
      retryable: true,
      message: 'Unknown error, retryable by default',
      code: 'UNKNOWN',
    };
  }

  /**
   * Generate deterministic idempotency key from context
   */
  public generateIdempotencyKey(context: RetryContext): string {
    if (context.idempotency_key) {
      return context.idempotency_key;
    }

    // Create stable hash from operation context
    const stableData = {
      agent: context.agent_name,
      operation: context.operation_type,
      ...context.operation_data,
    };

    // Sort keys for consistency
    const sortedData = Object.keys(stableData)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableData[key];
        return acc;
      }, {} as Record<string, any>);

    const hash = createHash('sha256')
      .update(JSON.stringify(sortedData))
      .digest('hex');

    return `${context.agent_name}_${context.operation_type}_${hash.substring(0, 16)}`;
  }

  /**
   * Calculate next retry time with deterministic jitter
   */
  private calculateNextRetry(
    idempotency_key: string,
    attempt_count: number,
    policy: RetryPolicy
  ): Date {
    // Exponential backoff
    const delayMs = Math.min(
      policy.baseDelayMs * Math.pow(policy.backoffFactor, attempt_count),
      policy.maxDelayMs
    );

    // Deterministic jitter (0-20% of delay) based on idempotency key hash
    let jitterMs = 0;
    if (policy.jitter) {
      const hash = createHash('md5').update(idempotency_key).digest('hex');
      const hashValue = parseInt(hash.substring(0, 8), 16);
      const jitterPercent = (hashValue % 100) / 100; // 0.00 to 0.99
      jitterMs = Math.floor(delayMs * 0.2 * jitterPercent);
    }

    return new Date(Date.now() + delayMs + jitterMs);
  }

  /**
   * Get or create retry state for operation
   */
  public async getOrCreateRetryState(context: RetryContext): Promise<RetryState | null> {
    const idempotency_key = this.generateIdempotencyKey(context);
    const policy = { ...this.defaultPolicy, ...context.policy };

    // Check if retry state already exists
    const { data: existing, error: fetchError } = await this.supabase
      .from('agent_retry_state')
      .select('*')
      .eq('idempotency_key', idempotency_key)
      .single();

    if (existing) {
      // Return existing state
      return existing as RetryState;
    }

    // Create new retry state
    const { data: created, error: createError } = await this.supabase
      .from('agent_retry_state')
      .insert({
        agent_name: context.agent_name,
        operation_type: context.operation_type,
        idempotency_key,
        max_attempts: policy.maxAttempts,
        base_delay_ms: policy.baseDelayMs,
        max_delay_ms: policy.maxDelayMs,
        backoff_factor: policy.backoffFactor,
        attempt_count: 0,
        operation_data: context.operation_data,
        status: 'pending',
        first_attempt_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('[DeterministicRetryModule] Failed to create retry state:', createError);
      return null;
    }

    return created as RetryState;
  }

  /**
   * Record retry attempt
   */
  public async recordAttempt(
    idempotency_key: string,
    error: Error | null,
    success: boolean = false
  ): Promise<RetryState | null> {
    // Get current state
    const { data: state, error: fetchError } = await this.supabase
      .from('agent_retry_state')
      .select('*')
      .eq('idempotency_key', idempotency_key)
      .single();

    if (!state) {
      console.error('[DeterministicRetryModule] Retry state not found:', idempotency_key);
      return null;
    }

    const policy: RetryPolicy = {
      maxAttempts: state.max_attempts,
      baseDelayMs: state.base_delay_ms,
      maxDelayMs: state.max_delay_ms,
      backoffFactor: state.backoff_factor,
      jitter: true,
    };

    if (success) {
      // Mark as succeeded
      const { data: updated } = await this.supabase
        .from('agent_retry_state')
        .update({
          status: 'succeeded',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('idempotency_key', idempotency_key)
        .select()
        .single();

      return updated as RetryState;
    }

    // Handle failure
    const classification = error
      ? this.classifyError(error)
      : {
          type: 'fatal' as ErrorType,
          retryable: false,
          message: 'No error provided',
          code: 'NO_ERROR',
        };
    const newAttemptCount = state.attempt_count + 1;

    // Check if we should retry
    const shouldRetry = classification.retryable && newAttemptCount < policy.maxAttempts;

    let status: RetryState['status'];
    let next_retry_at: string | null = null;

    if (!shouldRetry) {
      status = classification.type === 'fatal' ? 'abandoned' : 'failed';
    } else {
      status = 'retrying';
      const nextRetry = this.calculateNextRetry(idempotency_key, newAttemptCount, policy);
      next_retry_at = nextRetry.toISOString();
    }

    const { data: updated } = await this.supabase
      .from('agent_retry_state')
      .update({
        attempt_count: newAttemptCount,
        last_attempt_at: new Date().toISOString(),
        error_type: classification.type,
        last_error: error?.message || null,
        last_error_code: classification.code || null,
        status,
        next_retry_at,
        updated_at: new Date().toISOString(),
        completed_at: status === 'failed' || status === 'abandoned' ? new Date().toISOString() : null,
      })
      .eq('idempotency_key', idempotency_key)
      .select()
      .single();

    return updated as RetryState;
  }

  /**
   * Execute operation with automatic retry
   */
  public async executeWithRetry<T>(
    context: RetryContext,
    operation: () => Promise<T>
  ): Promise<T> {
    const state = await this.getOrCreateRetryState(context);

    if (!state) {
      throw new Error('Failed to initialize retry state');
    }

    // Check for duplicate execution
    if (state.status === 'succeeded') {
      console.log('[DeterministicRetryModule] Operation already succeeded, returning cached result');
      return state.result_data as T;
    }

    if (state.status === 'failed' || state.status === 'abandoned') {
      throw new Error(`Operation already failed with status: ${state.status}`);
    }

    // Execute operation
    try {
      const result = await operation();

      // Record success
      await this.recordAttempt(state.idempotency_key, null, true);

      // Store result
      await this.supabase
        .from('agent_retry_state')
        .update({
          result_data: result as any,
          updated_at: new Date().toISOString(),
        })
        .eq('idempotency_key', state.idempotency_key);

      return result;
    } catch (error) {
      // Record failure
      const updatedState = await this.recordAttempt(state.idempotency_key, error as Error, false);

      if (updatedState?.status === 'retrying') {
        // Schedule for retry - throw error with retry info
        const retryError = new Error(
          `Operation failed, scheduled for retry at ${updatedState.next_retry_at}`
        );
        (retryError as any).retryable = true;
        (retryError as any).next_retry_at = updatedState.next_retry_at;
        throw retryError;
      }

      // No more retries
      throw error;
    }
  }

  /**
   * Get operations ready for retry
   */
  public async getOperationsReadyForRetry(
    agent_name?: string
  ): Promise<RetryState[]> {
    let query = this.supabase
      .from('agent_retry_state')
      .select('*')
      .eq('status', 'retrying')
      .lte('next_retry_at', new Date().toISOString())
      .order('next_retry_at', { ascending: true })
      .limit(100);

    if (agent_name) {
      query = query.eq('agent_name', agent_name);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[DeterministicRetryModule] Failed to fetch retry operations:', error);
      return [];
    }

    return (data || []) as RetryState[];
  }

  /**
   * Clean up old completed retry states (older than 7 days)
   */
  public async cleanupOldRetries(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const { data, error } = await this.supabase
      .from('agent_retry_state')
      .delete()
      .in('status', ['succeeded', 'failed', 'abandoned'])
      .lt('completed_at', cutoff.toISOString())
      .select('id');

    if (error) {
      console.error('[DeterministicRetryModule] Failed to cleanup old retries:', error);
      return 0;
    }

    return data?.length || 0;
  }
}
