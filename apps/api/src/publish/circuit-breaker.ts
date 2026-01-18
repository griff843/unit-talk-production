/**
 * Circuit Breaker for Discord Publishing
 *
 * Implements the Circuit Breaker pattern to protect against cascading failures.
 *
 * States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Too many failures, all requests fail fast for cooldown period
 * - HALF_OPEN: Testing if service recovered, single request allowed
 *
 * Trip conditions:
 * - ≥5 failures in 60 seconds → OPEN for 60 seconds
 * - In HALF_OPEN: success → CLOSED, failure → OPEN for 60 seconds
 *
 * Storage:
 * - In-memory (default)
 * - Redis (if REDIS_URL configured)
 */

import { logger } from '../shared/logger';
import Redis from 'ioredis';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerState {
  state: CircuitState;
  opens: number;
  lastChangeAt: Date;
  failures: number;
  windowStart: Date;
}

export interface CircuitBreakerConfig {
  /**
   * Number of failures to trip circuit
   * @default 5
   */
  failureThreshold?: number;

  /**
   * Window to count failures (milliseconds)
   * @default 60000 (60 seconds)
   */
  failureWindow?: number;

  /**
   * How long to keep circuit OPEN (milliseconds)
   * @default 60000 (60 seconds)
   */
  cooldownPeriod?: number;

  /**
   * Circuit breaker name (for logging/Redis key)
   * @default 'discord:global'
   */
  name?: string;

  /**
   * Redis client for distributed circuit breaker
   * @default undefined (in-memory)
   */
  redis?: Redis;
}

/**
 * In-memory storage for circuit breaker state
 */
interface InMemoryState {
  state: CircuitState;
  opens: number;
  lastChangeAt: number;
  failures: number;
  windowStart: number;
}

const inMemoryStates = new Map<string, InMemoryState>();

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
  private config: Required<Omit<CircuitBreakerConfig, 'redis'>> & { redis?: Redis };
  private redis?: Redis;
  private redisKey: string;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      failureWindow: config.failureWindow ?? 60000,
      cooldownPeriod: config.cooldownPeriod ?? 60000,
      name: config.name ?? 'discord:global',
    };

    this.redis = config.redis;
    this.redisKey = `cb:${this.config.name}`;

    logger.info('Circuit breaker initialized', {
      event: 'circuit_breaker_init',
      name: this.config.name,
      failureThreshold: this.config.failureThreshold,
      failureWindow: this.config.failureWindow,
      cooldownPeriod: this.config.cooldownPeriod,
      storage: this.redis ? 'redis' : 'memory',
    });
  }

  /**
   * Get current circuit breaker state
   */
  async getState(): Promise<CircuitBreakerState> {
    if (this.redis) {
      return this.getStateFromRedis();
    } else {
      return this.getStateFromMemory();
    }
  }

  /**
   * Record a successful operation
   */
  async recordSuccess(): Promise<void> {
    const currentState = await this.getState();

    // In HALF_OPEN, success closes the circuit
    if (currentState.state === 'HALF_OPEN') {
      await this.transition('CLOSED', 'Success in HALF_OPEN state');
      return;
    }

    // In CLOSED, reset failure counter if past window
    if (currentState.state === 'CLOSED') {
      const now = Date.now();
      const windowAge = now - currentState.windowStart.getTime();

      if (windowAge > this.config.failureWindow) {
        await this.resetFailures();
      }
    }
  }

  /**
   * Record a failed operation
   */
  async recordFailure(): Promise<void> {
    const currentState = await this.getState();
    const now = Date.now();

    // In HALF_OPEN, failure reopens the circuit
    if (currentState.state === 'HALF_OPEN') {
      await this.transition('OPEN', 'Failure in HALF_OPEN state');
      return;
    }

    // In OPEN, do nothing (already tripped)
    if (currentState.state === 'OPEN') {
      return;
    }

    // In CLOSED, increment failures
    const windowAge = now - currentState.windowStart.getTime();

    // Reset window if past failure window
    if (windowAge > this.config.failureWindow) {
      await this.resetFailures();
      await this.incrementFailure();
    } else {
      await this.incrementFailure();
    }

    // Check if we should trip the circuit
    const updatedState = await this.getState();
    if (updatedState.failures >= this.config.failureThreshold) {
      await this.transition('OPEN', `Failure threshold reached: ${updatedState.failures}/${this.config.failureThreshold}`);
    }
  }

  /**
   * Check if circuit allows requests
   */
  async allowRequest(): Promise<boolean> {
    const currentState = await this.getState();
    const now = Date.now();

    switch (currentState.state) {
      case 'CLOSED':
        return true;

      case 'OPEN': {
        // Check if cooldown period has elapsed
        const openDuration = now - currentState.lastChangeAt.getTime();

        if (openDuration >= this.config.cooldownPeriod) {
          // Transition to HALF_OPEN
          await this.transition('HALF_OPEN', 'Cooldown period elapsed');
          return true; // Allow one request to test
        }

        return false; // Still in cooldown
      }

      case 'HALF_OPEN':
        // Only allow one request at a time in HALF_OPEN
        // This is a simplified implementation; production would use a flag
        return true;

      default:
        return false;
    }
  }

  /**
   * Transition to a new state
   */
  private async transition(newState: CircuitState, reason: string): Promise<void> {
    const currentState = await this.getState();

    logger.info('Circuit breaker state transition', {
      event: 'circuit_breaker_transition',
      name: this.config.name,
      from: currentState.state,
      to: newState,
      reason,
      opens: newState === 'OPEN' ? currentState.opens + 1 : currentState.opens,
    });

    const newStateData: InMemoryState = {
      state: newState,
      opens: newState === 'OPEN' ? currentState.opens + 1 : currentState.opens,
      lastChangeAt: Date.now(),
      failures: newState === 'CLOSED' ? 0 : currentState.failures,
      windowStart: newState === 'CLOSED' ? Date.now() : currentState.windowStart.getTime(),
    };

    if (this.redis) {
      await this.setStateInRedis(newStateData);
    } else {
      inMemoryStates.set(this.config.name, newStateData);
    }
  }

  /**
   * Increment failure count
   */
  private async incrementFailure(): Promise<void> {
    if (this.redis) {
      await this.redis.hincrby(this.redisKey, 'failures', 1);
    } else {
      const state = inMemoryStates.get(this.config.name);
      if (state) {
        state.failures++;
      }
    }
  }

  /**
   * Reset failure count and window
   */
  private async resetFailures(): Promise<void> {
    if (this.redis) {
      await this.redis.hset(this.redisKey, {
        failures: 0,
        windowStart: Date.now(),
      });
    } else {
      const state = inMemoryStates.get(this.config.name);
      if (state) {
        state.failures = 0;
        state.windowStart = Date.now();
      }
    }
  }

  /**
   * Get state from in-memory storage
   */
  private getStateFromMemory(): CircuitBreakerState {
    const state = inMemoryStates.get(this.config.name) || {
      state: 'CLOSED' as CircuitState,
      opens: 0,
      lastChangeAt: Date.now(),
      failures: 0,
      windowStart: Date.now(),
    };

    return {
      state: state.state,
      opens: state.opens,
      lastChangeAt: new Date(state.lastChangeAt),
      failures: state.failures,
      windowStart: new Date(state.windowStart),
    };
  }

  /**
   * Get state from Redis
   */
  private async getStateFromRedis(): Promise<CircuitBreakerState> {
    if (!this.redis) {
      return this.getStateFromMemory();
    }

    try {
      const data = await this.redis.hgetall(this.redisKey);

      if (!data || Object.keys(data).length === 0) {
        // Initialize if not exists
        const initialState: InMemoryState = {
          state: 'CLOSED',
          opens: 0,
          lastChangeAt: Date.now(),
          failures: 0,
          windowStart: Date.now(),
        };

        await this.setStateInRedis(initialState);
        return this.stateFromData(initialState);
      }

      return {
        state: (data.state as CircuitState) || 'CLOSED',
        opens: parseInt(data.opens || '0', 10),
        lastChangeAt: new Date(parseInt(data.lastChangeAt || '0', 10)),
        failures: parseInt(data.failures || '0', 10),
        windowStart: new Date(parseInt(data.windowStart || '0', 10)),
      };
    } catch (error) {
      logger.error('Failed to get circuit breaker state from Redis', {
        event: 'circuit_breaker_redis_error',
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to memory
      return this.getStateFromMemory();
    }
  }

  /**
   * Set state in Redis
   */
  private async setStateInRedis(state: InMemoryState): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.hset(this.redisKey, {
        state: state.state,
        opens: state.opens,
        lastChangeAt: state.lastChangeAt,
        failures: state.failures,
        windowStart: state.windowStart,
      });

      // Set TTL to prevent stale data (2x cooldown period)
      await this.redis.expire(this.redisKey, Math.ceil(this.config.cooldownPeriod * 2 / 1000));
    } catch (error) {
      logger.error('Failed to set circuit breaker state in Redis', {
        event: 'circuit_breaker_redis_error',
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to memory
      inMemoryStates.set(this.config.name, state);
    }
  }

  /**
   * Convert internal state to external format
   */
  private stateFromData(data: InMemoryState): CircuitBreakerState {
    return {
      state: data.state,
      opens: data.opens,
      lastChangeAt: new Date(data.lastChangeAt),
      failures: data.failures,
      windowStart: new Date(data.windowStart),
    };
  }
}

/**
 * Global circuit breaker instance (singleton)
 */
let globalCircuitBreaker: CircuitBreaker | null = null;

/**
 * Get or create global circuit breaker
 */
export function getCircuitBreaker(redis?: Redis): CircuitBreaker {
  if (!globalCircuitBreaker) {
    globalCircuitBreaker = new CircuitBreaker({
      name: 'discord:global',
      redis,
    });
  }

  return globalCircuitBreaker;
}

/**
 * Reset global circuit breaker (for testing)
 */
export function resetCircuitBreaker(): void {
  globalCircuitBreaker = null;
  inMemoryStates.clear();
}
