import { EventEmitter } from 'events';

import { logger } from '../shared/logger';

export interface ServiceConfig {
  name: string;
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxRequests: number;
  timeoutMs: number;
  retryAttempts: number;
  backoffMultiplier: number;
  circuitBreakerEnabled: boolean;
}

export interface ServiceMetrics {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  timeoutRequests: number;
  circuitBreakerTrips: number;
  averageResponseTime: number;
  recentErrors: Array<{
    timestamp: number;
    error: string;
    type: 'timeout' | 'error' | 'rejection';
  }>;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ServiceStatus {
  name: string;
  state: CircuitState;
  metrics: ServiceMetrics;
  config: ServiceConfig;
  lastStateChange: number;
  nextRetryTime?: number;
}

/**
 * Enhanced Circuit Breaker for external service calls
 * Features:
 * - Per-service circuit breaker state
 * - Configurable failure thresholds and timeouts
 * - Half-open state for gradual recovery
 * - Comprehensive metrics and monitoring
 * - Event emission for monitoring systems
 * - Retry logic with exponential backoff
 * - Health check integration
 */
export class EnhancedCircuitBreaker extends EventEmitter {
  private services: Map<string, ServiceStatus> = new Map();
  private defaultConfig: ServiceConfig;

  constructor(defaultConfig?: Partial<ServiceConfig>) {
    super();
    
    this.defaultConfig = {
      name: 'default',
      failureThreshold: 5,
      resetTimeoutMs: 60000, // 1 minute
      halfOpenMaxRequests: 3,
      timeoutMs: 10000, // 10 seconds
      retryAttempts: 3,
      backoffMultiplier: 2,
      circuitBreakerEnabled: true,
      ...defaultConfig
    };

    // Start metrics cleanup interval
    setInterval(() => {
      this.cleanupOldErrors();
    }, 300000); // 5 minutes
  }

  /**
   * Register a service with custom configuration
   */
  public registerService(serviceName: string, config?: Partial<ServiceConfig>): void {
    const serviceConfig: ServiceConfig = {
      ...this.defaultConfig,
      name: serviceName,
      ...config
    };

    const status: ServiceStatus = {
      name: serviceName,
      state: 'CLOSED',
      config: serviceConfig,
      lastStateChange: Date.now(),
      metrics: {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        timeoutRequests: 0,
        circuitBreakerTrips: 0,
        averageResponseTime: 0,
        recentErrors: []
      }
    };

    this.services.set(serviceName, status);
    
    logger.info('🔌 Service registered with circuit breaker', {
      serviceName,
      config: serviceConfig
    });
  }

  /**
   * Execute a service call with circuit breaker protection
   */
  public async executeCall<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const service = this.getOrCreateService(serviceName);
    
    // Check if circuit breaker should block the call
    if (this.shouldBlockCall(service)) {
      const error = new Error(`Circuit breaker OPEN for service: ${serviceName}`);
      this.emit('callBlocked', { serviceName, error });
      
      if (fallback) {
        logger.warn('🚫 Circuit breaker blocked call, using fallback', { serviceName });
        return fallback();
      }
      
      throw error;
    }

    return await this.executeWithRetry(service, operation, fallback);
  }

  /**
   * Execute operation with retry logic and circuit breaker protection
   */
  private async executeWithRetry<T>(
    service: ServiceStatus,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    const startTime = Date.now();
    service.metrics.totalRequests++;

    try {
      // Execute with timeout
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), service.config.timeoutMs)
        )
      ]);

      // Record success
      this.recordSuccess(service, Date.now() - startTime);
      return result;

    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'Operation timeout';
      
      // Record failure
      this.recordFailure(service, error, isTimeout ? 'timeout' : 'error');

      // Check if we should retry
      if (attempt < service.config.retryAttempts && !this.shouldOpenCircuit(service)) {
        const delay = this.calculateBackoffDelay(attempt, service.config.backoffMultiplier);
        
        logger.warn('🔄 Retrying operation after failure', {
          serviceName: service.name,
          attempt,
          delay,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(service, operation, fallback, attempt + 1);
      }

      // No more retries or circuit should open
      if (this.shouldOpenCircuit(service)) {
        this.openCircuit(service);
      }

      // Use fallback if available
      if (fallback) {
        logger.error('💥 Operation failed, using fallback', {
          serviceName: service.name,
          attempt,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return fallback();
      }

      throw error;
    }
  }

  /**
   * Check if a service call should be blocked
   */
  private shouldBlockCall(service: ServiceStatus): boolean {
    if (!service.config.circuitBreakerEnabled) {
      return false;
    }

    const now = Date.now();

    switch (service.state) {
      case 'OPEN':
        // Check if enough time has passed to try half-open
        if (now - service.lastStateChange >= service.config.resetTimeoutMs) {
          this.halfOpenCircuit(service);
          return false;
        }
        return true;

      case 'HALF_OPEN':
        // Allow limited number of requests in half-open state
        const recentRequests = this.getRecentRequestCount(service);
        return recentRequests >= service.config.halfOpenMaxRequests;

      case 'CLOSED':
      default:
        return false;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(service: ServiceStatus, responseTime: number): void {
    service.metrics.successRequests++;
    
    // Update average response time
    const total = service.metrics.successRequests + service.metrics.failedRequests;
    service.metrics.averageResponseTime = 
      (service.metrics.averageResponseTime * (total - 1) + responseTime) / total;

    // If in half-open state and success, close the circuit
    if (service.state === 'HALF_OPEN') {
      this.closeCircuit(service);
    }

    this.emit('operationSuccess', {
      serviceName: service.name,
      responseTime,
      state: service.state
    });
  }

  /**
   * Record failed operation
   */
  private recordFailure(
    service: ServiceStatus,
    error: unknown,
    type: 'timeout' | 'error' | 'rejection'
  ): void {
    service.metrics.failedRequests++;
    
    if (type === 'timeout') {
      service.metrics.timeoutRequests++;
    }

    // Store recent error for analysis
    service.metrics.recentErrors.push({
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error),
      type
    });

    // Keep only last 50 errors
    if (service.metrics.recentErrors.length > 50) {
      service.metrics.recentErrors = service.metrics.recentErrors.slice(-50);
    }

    this.emit('operationFailure', {
      serviceName: service.name,
      error,
      type,
      state: service.state
    });
  }

  /**
   * Check if circuit should be opened
   */
  private shouldOpenCircuit(service: ServiceStatus): boolean {
    if (!service.config.circuitBreakerEnabled || service.state === 'OPEN') {
      return false;
    }

    // Calculate failure rate over recent requests
    const recentFailures = this.getRecentFailureCount(service);
    const recentRequests = this.getRecentRequestCount(service);

    // Need minimum number of requests before opening circuit
    if (recentRequests < service.config.failureThreshold) {
      return false;
    }

    // Open if failure rate exceeds threshold
    const failureRate = recentFailures / recentRequests;
    return failureRate >= 0.5; // 50% failure rate
  }

  /**
   * Open the circuit breaker
   */
  private openCircuit(service: ServiceStatus): void {
    service.state = 'OPEN';
    service.lastStateChange = Date.now();
    service.metrics.circuitBreakerTrips++;
    service.nextRetryTime = Date.now() + service.config.resetTimeoutMs;

    logger.error('⚡ Circuit breaker OPENED', {
      serviceName: service.name,
      recentFailures: this.getRecentFailureCount(service),
      recentRequests: this.getRecentRequestCount(service),
      nextRetryTime: new Date(service.nextRetryTime).toISOString()
    });

    this.emit('circuitOpened', {
      serviceName: service.name,
      metrics: service.metrics,
      nextRetryTime: service.nextRetryTime
    });
  }

  /**
   * Transition to half-open state
   */
  private halfOpenCircuit(service: ServiceStatus): void {
    service.state = 'HALF_OPEN';
    service.lastStateChange = Date.now();

    logger.info('🔄 Circuit breaker HALF-OPEN', {
      serviceName: service.name
    });

    this.emit('circuitHalfOpened', {
      serviceName: service.name,
      metrics: service.metrics
    });
  }

  /**
   * Close the circuit breaker
   */
  private closeCircuit(service: ServiceStatus): void {
    service.state = 'CLOSED';
    service.lastStateChange = Date.now();
    service.nextRetryTime = undefined;

    logger.info('✅ Circuit breaker CLOSED', {
      serviceName: service.name
    });

    this.emit('circuitClosed', {
      serviceName: service.name,
      metrics: service.metrics
    });
  }

  /**
   * Get or create service status
   */
  private getOrCreateService(serviceName: string): ServiceStatus {
    if (!this.services.has(serviceName)) {
      this.registerService(serviceName);
    }
    return this.services.get(serviceName)!;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number, multiplier: number): number {
    const baseDelay = 1000; // 1 second
    return Math.min(baseDelay * Math.pow(multiplier, attempt - 1), 30000); // Max 30 seconds
  }

  /**
   * Get count of recent failures (last 5 minutes)
   */
  private getRecentFailureCount(service: ServiceStatus): number {
    const fiveMinutesAgo = Date.now() - 300000;
    return service.metrics.recentErrors.filter(
      error => error.timestamp > fiveMinutesAgo
    ).length;
  }

  /**
   * Get count of recent requests (estimated)
   */
  private getRecentRequestCount(service: ServiceStatus): number {
    // Estimate based on recent errors and success rate
    const recentFailures = this.getRecentFailureCount(service);
    const estimatedSuccesses = Math.max(1, recentFailures); // Conservative estimate
    return recentFailures + estimatedSuccesses;
  }

  /**
   * Clean up old error records
   */
  private cleanupOldErrors(): void {
    const oneHourAgo = Date.now() - 3600000;
    
    for (const service of Array.from(this.services.values())) {
      service.metrics.recentErrors = service.metrics.recentErrors.filter(
        error => error.timestamp > oneHourAgo
      );
    }
  }

  /**
   * Get status of all services
   */
  public getAllServiceStatus(): ServiceStatus[] {
    return Array.from(this.services.values()).map(service => ({
      ...service,
      metrics: { ...service.metrics }
    }));
  }

  /**
   * Get status of specific service
   */
  public getServiceStatus(serviceName: string): ServiceStatus | null {
    const service = this.services.get(serviceName);
    return service ? { ...service, metrics: { ...service.metrics } } : null;
  }

  /**
   * Reset service circuit breaker
   */
  public resetService(serviceName: string): void {
    const service = this.services.get(serviceName);
    if (service) {
      this.closeCircuit(service);
      service.metrics.recentErrors = [];
      
      logger.info('🔄 Service circuit breaker manually reset', { serviceName });
      
      this.emit('serviceReset', { serviceName });
    }
  }

  /**
   * Health check for circuit breaker system
   */
  public getHealthStatus(): {
    healthy: boolean;
    services: Array<{
      name: string;
      state: CircuitState;
      healthy: boolean;
      failureRate: number;
    }>;
  } {
    const serviceHealths = Array.from(this.services.values()).map(service => {
      const recentFailures = this.getRecentFailureCount(service);
      const recentRequests = this.getRecentRequestCount(service);
      const failureRate = recentRequests > 0 ? recentFailures / recentRequests : 0;
      
      return {
        name: service.name,
        state: service.state,
        healthy: service.state !== 'OPEN' && failureRate < 0.5,
        failureRate
      };
    });

    const overallHealthy = serviceHealths.every(s => s.healthy);

    return {
      healthy: overallHealthy,
      services: serviceHealths
    };
  }
}

// Global circuit breaker instance
export const circuitBreaker = new EnhancedCircuitBreaker();

// Pre-register common services
circuitBreaker.registerService('openai', {
  failureThreshold: 3,
  resetTimeoutMs: 30000, // 30 seconds
  timeoutMs: 15000, // 15 seconds
  retryAttempts: 2
});

circuitBreaker.registerService('discord', {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  timeoutMs: 10000, // 10 seconds
  retryAttempts: 3
});

circuitBreaker.registerService('supabase', {
  failureThreshold: 3,
  resetTimeoutMs: 15000, // 15 seconds
  timeoutMs: 5000, // 5 seconds
  retryAttempts: 2
});

circuitBreaker.registerService('redis', {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds
  timeoutMs: 3000, // 3 seconds
  retryAttempts: 2
});

// Service wrapper functions for easy integration
export const withCircuitBreaker = {
  openai: <T>(operation: () => Promise<T>, fallback?: () => Promise<T>) =>
    circuitBreaker.executeCall('openai', operation, fallback),
    
  discord: <T>(operation: () => Promise<T>, fallback?: () => Promise<T>) =>
    circuitBreaker.executeCall('discord', operation, fallback),
    
  supabase: <T>(operation: () => Promise<T>, fallback?: () => Promise<T>) =>
    circuitBreaker.executeCall('supabase', operation, fallback),
    
  redis: <T>(operation: () => Promise<T>, fallback?: () => Promise<T>) =>
    circuitBreaker.executeCall('redis', operation, fallback)
};

// Decorator for automatic circuit breaker integration
export function CircuitBreakerProtected(serviceName: string) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return circuitBreaker.executeCall(
        serviceName,
        () => method.apply(this, args)
      );
    };
  };
}