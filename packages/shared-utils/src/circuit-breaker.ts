/**
 * Circuit Breaker Pattern Implementation for Unit Talk Platform
 * Prevents cascade failures and provides resilience for external service calls
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  monitoringWindowMs: number;
  minimumThroughput: number;
  successThreshold: number;
  name: string;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  windowStartTime: number;
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly circuitState: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private windowStartTime = Date.now();
  private nextAttemptTime = 0;

  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      recoveryTimeoutMs: config.recoveryTimeoutMs ?? 60000, // 1 minute
      monitoringWindowMs: config.monitoringWindowMs ?? 300000, // 5 minutes
      minimumThroughput: config.minimumThroughput ?? 10,
      successThreshold: config.successThreshold ?? 3,
      name: config.name ?? 'unknown',
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<R>(fn: () => Promise<R>): Promise<R> {
    this.updateMetricsWindow();

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          `Circuit breaker "${this.config.name}" is OPEN. Next attempt in ${
            Math.ceil((this.nextAttemptTime - Date.now()) / 1000)
          }s`,
          this.state
        );
      } else {
        // Transition to half-open state
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0; // Reset success count for half-open evaluation
      }
    }

    this.totalRequests++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    this.updateMetricsWindow();
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      windowStartTime: this.windowStartTime,
    };
  }

  /**
   * Get failure rate as percentage
   */
  getFailureRate(): number {
    if (this.totalRequests === 0) return 0;
    return (this.failureCount / this.totalRequests) * 100;
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED && this.getFailureRate() < 10;
  }

  /**
   * Manually reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.windowStartTime = Date.now();
    this.nextAttemptTime = 0;
  }

  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        // Transition back to closed state
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit
      this.tripCircuit();
    } else if (this.state === CircuitState.CLOSED) {
      // Check if failure threshold is exceeded
      const hasSufficientThroughput = this.totalRequests >= this.config.minimumThroughput;

      if (hasSufficientThroughput && this.failureCount >= this.config.failureThreshold) {
        this.tripCircuit();
      }
    }
  }

  private tripCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeoutMs;
  }

  private updateMetricsWindow(): void {
    const now = Date.now();
    const windowAge = now - this.windowStartTime;

    if (windowAge >= this.config.monitoringWindowMs) {
      // Reset metrics for new window
      this.failureCount = 0;
      this.successCount = 0;
      this.totalRequests = 0;
      this.windowStartTime = now;

      // If circuit was open due to old failures, allow transition to half-open
      if (this.state === CircuitState.OPEN && now >= this.nextAttemptTime) {
        this.state = CircuitState.HALF_OPEN;
      }
    }
  }
}

/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private circuitBreakers = new Map<string, CircuitBreaker>();

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, new CircuitBreaker({ ...config, name }));
    }
    return this.circuitBreakers.get(name)!;
  }

  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    
    this.circuitBreakers.forEach((breaker, name) => {
      metrics[name] = breaker.getMetrics();
    });

    return metrics;
  }

  getHealthStatus(): { healthy: number; total: number; details: Record<string, boolean> } {
    const details: Record<string, boolean> = {};
    let healthy = 0;
    let total = 0;

    this.circuitBreakers.forEach((breaker, name) => {
      const isHealthy = breaker.isHealthy();
      details[name] = isHealthy;
      if (isHealthy) healthy++;
      total++;
    });

    return { healthy, total, details };
  }

  reset(name?: string): void {
    if (name) {
      this.circuitBreakers.get(name)?.reset();
    } else {
      this.circuitBreakers.forEach(breaker => breaker.reset());
    }
  }
}

/**
 * Decorator for wrapping functions with circuit breaker protection
 */
export function circuitBreaker(config: Partial<CircuitBreakerConfig> = {}) {
  return function <T>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<T>>
  ) {
    const originalMethod = descriptor.value!;
    const circuitBreakerName = config.name || `${target.constructor.name}.${propertyKey}`;
    const registry = CircuitBreakerRegistry.getInstance();

    descriptor.value = async function (...args: any[]): Promise<T> {
      const breaker = registry.getCircuitBreaker(circuitBreakerName, config);
      
      return breaker.execute(async () => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

/**
 * Higher-order function for wrapping functions with circuit breaker
 */
export function withCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: Partial<CircuitBreakerConfig> = {}
): T {
  const circuitBreakerName = config.name || fn.name || 'anonymous';
  const registry = CircuitBreakerRegistry.getInstance();

  return (async (...args: any[]) => {
    const breaker = registry.getCircuitBreaker(circuitBreakerName, config);
    
    return breaker.execute(async () => {
      return fn(...args);
    });
  }) as T;
}