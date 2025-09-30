/**
 * SGO API Monitoring Service
 *
 * Monitors API usage, tracks quotas, implements circuit breaker pattern,
 * and provides alerting for API health issues.
 */

import { logger } from '../utils/logger';
import { sgoApiKeyManager } from '../utils/sgoApiKeyManager';

export interface ApiUsageMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  rateLimitHits: number;
  authErrors: number;
  serverErrors: number;
  lastSuccess: Date | null;
  lastError: Date | null;
  averageResponseTime: number;
  quotaUsage: {
    remaining?: number;
    reset?: number;
    limit?: number;
  };
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, requests blocked
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

class SGOApiMonitoringService {
  private metrics: ApiUsageMetrics = {
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    rateLimitHits: 0,
    authErrors: 0,
    serverErrors: 0,
    lastSuccess: null,
    lastError: null,
    averageResponseTime: 0,
    quotaUsage: {}
  };

  private circuitState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private circuitOpenTime: Date | null = null;
  private consecutiveFailures = 0;
  private responseTimes: number[] = [];

  // Configuration
  private readonly failureThreshold = 5; // Open circuit after 5 consecutive failures
  private readonly circuitOpenDuration = 60000; // Keep circuit open for 1 minute
  private readonly halfOpenRequestLimit = 3; // Allow 3 requests in half-open state
  private readonly responseTimeWindowSize = 10; // Track last 10 response times

  /**
   * Record a successful API request
   */
  recordSuccess(responseTimeMs: number): void {
    this.metrics.requestCount++;
    this.metrics.successCount++;
    this.metrics.lastSuccess = new Date();
    this.consecutiveFailures = 0;

    // Update average response time
    this.responseTimes.push(responseTimeMs);
    if (this.responseTimes.length > this.responseTimeWindowSize) {
      this.responseTimes.shift();
    }
    this.metrics.averageResponseTime = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;

    // Reset circuit breaker if needed
    if (this.circuitState === CircuitBreakerState.HALF_OPEN) {
      this.closeCircuit();
    }

    logger.debug('SGO API success recorded', {
      responseTime: responseTimeMs,
      avgResponseTime: this.metrics.averageResponseTime,
      successRate: this.getSuccessRate()
    });
  }

  /**
   * Record a failed API request
   */
  recordError(errorType: 'auth' | 'rateLimit' | 'server' | 'other', error?: Error): void {
    this.metrics.requestCount++;
    this.metrics.errorCount++;
    this.metrics.lastError = new Date();
    this.consecutiveFailures++;

    switch (errorType) {
      case 'auth':
        this.metrics.authErrors++;
        break;
      case 'rateLimit':
        this.metrics.rateLimitHits++;
        break;
      case 'server':
        this.metrics.serverErrors++;
        break;
    }

    // Check if we should open the circuit
    if (this.consecutiveFailures >= this.failureThreshold && this.circuitState === CircuitBreakerState.CLOSED) {
      this.openCircuit();
    }

    logger.warn('SGO API error recorded', {
      errorType,
      consecutiveFailures: this.consecutiveFailures,
      circuitState: this.circuitState,
      error: error?.message
    });
  }

  /**
   * Update quota information from API response
   */
  updateQuotaUsage(remaining?: number, reset?: number, limit?: number): void {
    this.metrics.quotaUsage = {
      remaining,
      reset,
      limit
    };

    // Alert if quota is running low
    if (remaining !== undefined && remaining < 100) {
      logger.warn('SGO API quota running low', {
        remaining,
        reset: reset ? new Date(reset * 1000).toISOString() : 'unknown',
        limit
      });
    }
  }

  /**
   * Check if requests should be allowed (circuit breaker logic)
   */
  shouldAllowRequest(): boolean {
    switch (this.circuitState) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        // Check if we should transition to half-open
        if (this.circuitOpenTime && Date.now() - this.circuitOpenTime.getTime() > this.circuitOpenDuration) {
          this.halfOpenCircuit();
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        // Allow limited requests to test if service recovered
        return this.metrics.requestCount < this.halfOpenRequestLimit;

      default:
        return false;
    }
  }

  /**
   * Get current API health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: ApiUsageMetrics;
    circuitState: CircuitBreakerState;
    issues: string[];
  } {
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check error rate
    const errorRate = this.getErrorRate();
    if (errorRate > 0.5) {
      status = 'unhealthy';
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
    } else if (errorRate > 0.2) {
      status = 'degraded';
      issues.push(`Elevated error rate: ${(errorRate * 100).toFixed(1)}%`);
    }

    // Check circuit breaker state
    if (this.circuitState === CircuitBreakerState.OPEN) {
      status = 'unhealthy';
      issues.push('Circuit breaker is open');
    } else if (this.circuitState === CircuitBreakerState.HALF_OPEN) {
      status = 'degraded';
      issues.push('Circuit breaker is half-open (testing)');
    }

    // Check quota
    if (this.metrics.quotaUsage.remaining !== undefined && this.metrics.quotaUsage.remaining < 50) {
      status = status === 'healthy' ? 'degraded' : status;
      issues.push(`Low API quota: ${this.metrics.quotaUsage.remaining} remaining`);
    }

    // Check recent errors
    if (this.metrics.lastError && this.metrics.lastSuccess) {
      if (this.metrics.lastError.getTime() > this.metrics.lastSuccess.getTime()) {
        const minutesSinceLastSuccess = (Date.now() - this.metrics.lastSuccess.getTime()) / (1000 * 60);
        if (minutesSinceLastSuccess > 10) {
          status = 'unhealthy';
          issues.push(`No successful requests for ${minutesSinceLastSuccess.toFixed(0)} minutes`);
        }
      }
    }

    return {
      status,
      metrics: { ...this.metrics },
      circuitState: this.circuitState,
      issues
    };
  }

  /**
   * Get success rate percentage
   */
  private getSuccessRate(): number {
    if (this.metrics.requestCount === 0) return 1;
    return this.metrics.successCount / this.metrics.requestCount;
  }

  /**
   * Get error rate percentage
   */
  private getErrorRate(): number {
    if (this.metrics.requestCount === 0) return 0;
    return this.metrics.errorCount / this.metrics.requestCount;
  }

  /**
   * Open the circuit breaker
   */
  private openCircuit(): void {
    this.circuitState = CircuitBreakerState.OPEN;
    this.circuitOpenTime = new Date();

    logger.error('SGO API circuit breaker opened', {
      consecutiveFailures: this.consecutiveFailures,
      errorRate: this.getErrorRate(),
      openUntil: new Date(Date.now() + this.circuitOpenDuration).toISOString()
    });
  }

  /**
   * Transition to half-open state
   */
  private halfOpenCircuit(): void {
    this.circuitState = CircuitBreakerState.HALF_OPEN;

    logger.info('SGO API circuit breaker half-opened', {
      consecutiveFailures: this.consecutiveFailures
    });
  }

  /**
   * Close the circuit breaker
   */
  private closeCircuit(): void {
    this.circuitState = CircuitBreakerState.CLOSED;
    this.circuitOpenTime = null;
    this.consecutiveFailures = 0;

    logger.info('SGO API circuit breaker closed - service recovered');
  }

  /**
   * Reset all metrics (for testing or periodic resets)
   */
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      rateLimitHits: 0,
      authErrors: 0,
      serverErrors: 0,
      lastSuccess: null,
      lastError: null,
      averageResponseTime: 0,
      quotaUsage: {}
    };
    this.responseTimes = [];
    this.consecutiveFailures = 0;

    logger.info('SGO API metrics reset');
  }

  /**
   * Get detailed metrics for monitoring dashboard
   */
  getDetailedMetrics() {
    return {
      ...this.metrics,
      circuitState: this.circuitState,
      circuitOpenTime: this.circuitOpenTime,
      consecutiveFailures: this.consecutiveFailures,
      successRate: this.getSuccessRate(),
      errorRate: this.getErrorRate(),
      health: this.getHealthStatus()
    };
  }
}

// Export singleton instance
export const sgoApiMonitoring = new SGOApiMonitoringService();