/**
 * Phase 23: Circuit Breaker & Retry Logic
 * Date: 2025-11-14
 * Charter: v3.0
 * 
 * Implements circuit breaker pattern with exponential backoff retry logic
 */

import type { Logger } from '../../utils/logger';
import { circuitBreakerTrips, circuitBreakerState } from './phase23-metrics';

// ============================================================================
// CONSTANTS
// ============================================================================

const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds
const ERROR_THRESHOLD_PERCENTAGE = 50;
const RESET_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// ============================================================================
// TYPES
// ============================================================================

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private readonly timeout: number;
  private readonly errorThresholdPercentage: number;
  private readonly resetTimeout: number;
  private readonly logger: Logger;
  private readonly serviceName: string;

  constructor(
    logger: Logger,
    serviceName: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.logger = logger;
    this.serviceName = serviceName;
    this.timeout = options.timeout || CIRCUIT_BREAKER_TIMEOUT;
    this.errorThresholdPercentage = options.errorThresholdPercentage || ERROR_THRESHOLD_PERCENTAGE;
    this.resetTimeout = options.resetTimeout || RESET_TIMEOUT;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        circuitBreakerState.set({ service: this.serviceName }, 2);
      } else {
        throw new Error(`Circuit breaker is open for ${this.serviceName}`);
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        this.createTimeout()
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute with exponential backoff retry
   */
  async executeWithRetry<T>(fn: () => Promise<T>, maxRetries: number = MAX_RETRIES): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.execute(fn);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries - 1) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          this.logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${backoffMs}ms`, {
            service: this.serviceName,
            error: lastError.message
          });
          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError || new Error(`Failed after ${maxRetries} retries`);
  }

  /**
   * Get circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    circuitBreakerState.set({ service: this.serviceName }, 0);
    this.logger.info(`Circuit breaker reset for ${this.serviceName}`);
  }

  private onSuccess(): void {
    this.successCount++;
    this.failureCount = 0;

    if (this.state === 'half-open') {
      this.state = 'closed';
      circuitBreakerState.set({ service: this.serviceName }, 0);
      this.logger.info(`Circuit breaker closed for ${this.serviceName}`);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    const totalRequests = this.failureCount + this.successCount;
    const errorPercentage = (this.failureCount / Math.max(1, totalRequests)) * 100;

    if (errorPercentage >= this.errorThresholdPercentage && this.state !== 'open') {
      this.state = 'open';
      circuitBreakerTrips.inc({ service: this.serviceName });
      circuitBreakerState.set({ service: this.serviceName }, 1);
      this.logger.error(`Circuit breaker opened for ${this.serviceName}`, {
        errorPercentage,
        failureCount: this.failureCount
      });
    }
  }

  private shouldAttemptReset(): boolean {
    if (this.lastFailureTime === null) return true;
    return Date.now() - this.lastFailureTime >= this.resetTimeout;
  }

  private createTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.timeout}ms`));
      }, this.timeout);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Utility function for retrying with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialBackoffMs: number = INITIAL_BACKOFF_MS
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const backoffMs = initialBackoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries} retries`);
}

