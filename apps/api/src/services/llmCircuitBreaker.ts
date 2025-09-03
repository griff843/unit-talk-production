import { logger } from '../shared/logger';

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  dailyTokenQuota: number;
  maxConcurrentRequests: number;
  timeoutMs: number;
}

interface CircuitBreakerMetrics {
  failures: number;
  lastFailure: number;
  dailyTokens: number;
  lastReset: number;
  concurrentRequests: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  metrics: CircuitBreakerMetrics;
  config: CircuitBreakerConfig;
  lastStateChange: number;
}

export class LLMCircuitBreaker {
  private static instance: LLMCircuitBreaker;
  private state: CircuitBreakerState;
  private requestQueue: Array<() => Promise<any>> = [];
  private processingQueue = false;

  private constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.state = {
      state: 'CLOSED',
      metrics: {
        failures: 0,
        lastFailure: 0,
        dailyTokens: 0,
        lastReset: Date.now(),
        concurrentRequests: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0
      },
      config: {
        failureThreshold: config.failureThreshold || 5,
        resetTimeout: config.resetTimeout || 60000, // 1 minute
        dailyTokenQuota: config.dailyTokenQuota || 1000000, // 1M tokens
        maxConcurrentRequests: config.maxConcurrentRequests || 50,
        timeoutMs: config.timeoutMs || 30000 // 30 seconds
      },
      lastStateChange: Date.now()
    };
  }

  public static getInstance(config?: Partial<CircuitBreakerConfig>): LLMCircuitBreaker {
    if (!LLMCircuitBreaker.instance) {
      LLMCircuitBreaker.instance = new LLMCircuitBreaker(config);
    }
    return LLMCircuitBreaker.instance;
  }

  public getState(): CircuitBreakerState {
    return { ...this.state };
  }

  public async executeRequest<T>(
    request: () => Promise<T>,
    tokenEstimate: number,
    fallback?: () => Promise<T>
  ): Promise<T> {
    // Check circuit state
    if (this.state.state === 'OPEN') {
      logger.warn('Circuit breaker is OPEN, using fallback');
      return fallback ? fallback() : this.handleOpenCircuit<T>();
    }

    // Check token quota
    if (this.state.metrics.dailyTokens + tokenEstimate > this.state.config.dailyTokenQuota) {
      logger.warn('Daily token quota exceeded');
      return fallback ? fallback() : this.handleQuotaExceeded<T>();
    }

    // Check concurrent requests
    if (this.state.metrics.concurrentRequests >= this.state.config.maxConcurrentRequests) {
      return this.queueRequest(request, fallback);
    }

    // Execute request with timeout
    try {
      this.state.metrics.concurrentRequests++;
      this.state.metrics.totalRequests++;
      const startTime = Date.now();

      const result = await Promise.race([
        request(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), this.state.config.timeoutMs)
        )
      ]);

      // Update metrics on success
      this.state.metrics.successfulRequests++;
      this.state.metrics.dailyTokens += tokenEstimate;
      this.state.metrics.averageLatency = 
        (this.state.metrics.averageLatency * (this.state.metrics.successfulRequests - 1) + 
        (Date.now() - startTime)) / this.state.metrics.successfulRequests;

      // Reset failures in HALF_OPEN state
      if (this.state.state === 'HALF_OPEN') {
        this.closeCircuit();
      }

      return result;
    } catch (error) {
      this.handleFailure(error);
      if (fallback) {
        return fallback();
      }
      throw error;
    } finally {
      this.state.metrics.concurrentRequests--;
      this.processQueue();
    }
  }

  private async queueRequest<T>(
    request: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.executeRequest(request, 0, fallback);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async processQueue() {
    if (this.processingQueue || this.requestQueue.length === 0) {return;}
    this.processingQueue = true;

    while (this.requestQueue.length > 0) {
      if (this.state.metrics.concurrentRequests < this.state.config.maxConcurrentRequests) {
        const request = this.requestQueue.shift();
        if (request) {
          try {
            await request();
          } catch (error) {
            logger.error('Error processing queued request:', error);
          }
        }
      } else {
        break;
      }
    }

    this.processingQueue = false;
  }

  private handleFailure(error: any) {
    this.state.metrics.failures++;
    this.state.metrics.failedRequests++;
    this.state.metrics.lastFailure = Date.now();

    logger.error('LLM request failed:', error);

    if (this.state.metrics.failures >= this.state.config.failureThreshold) {
      this.openCircuit();
    }
  }

  private openCircuit() {
    this.state.state = 'OPEN';
    this.state.lastStateChange = Date.now();
    logger.warn('Circuit breaker opened');

    // Schedule transition to HALF_OPEN
    setTimeout(() => {
      this.state.state = 'HALF_OPEN';
      this.state.lastStateChange = Date.now();
      this.state.metrics.failures = 0;
      logger.info('Circuit breaker half-opened');
    }, this.state.config.resetTimeout);
  }

  private closeCircuit() {
    this.state.state = 'CLOSED';
    this.state.lastStateChange = Date.now();
    this.state.metrics.failures = 0;
    logger.info('Circuit breaker closed');
  }

  private handleOpenCircuit<T>(): Promise<T> {
    throw new Error('Circuit breaker is open');
  }

  private handleQuotaExceeded<T>(): Promise<T> {
    throw new Error('Daily token quota exceeded');
  }

  // Reset daily token count at midnight
  private resetDailyTokens() {
    const now = Date.now();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    
    setTimeout(() => {
      this.state.metrics.dailyTokens = 0;
      this.state.metrics.lastReset = now;
      this.resetDailyTokens(); // Schedule next reset
    }, midnight.getTime() - now);
  }
} 