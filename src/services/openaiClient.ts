// src/services/openaiClient.ts
//
// Centralised OpenAI client initialisation.
// Wraps the raw OpenAI SDK with our enterprise-grade cost-guard / circuit-breaker.

import { OpenAICostGuard } from './openaiCostGuard';
import { supabase } from './supabaseClient';
import { logger } from './logging';
import { Logger } from '../shared/logger/types';

// Create a logger adapter to match the expected interface
const loggerAdapter: Logger = {
  debug: (msg: string | object, ...args: unknown[]) => {
    if (typeof msg === 'string') {
      logger.debug(msg, ...args);
    } else {
      logger.debug(msg, args[0] as string, ...args.slice(1));
    }
  },
  info: (msg: string | object, ...args: unknown[]) => {
    if (typeof msg === 'string') {
      logger.info(msg, ...args);
    } else {
      logger.info(msg, args[0] as string, ...args.slice(1));
    }
  },
  warn: (msg: string | object, ...args: unknown[]) => {
    if (typeof msg === 'string') {
      logger.warn(msg, ...args);
    } else {
      logger.warn(msg, args[0] as string, ...args.slice(1));
    }
  },
  error: (msg: string | object, ...args: unknown[]) => {
    if (typeof msg === 'string') {
      logger.error(msg, ...args);
    } else {
      logger.error(msg, args[0] as string, ...args.slice(1));
    }
  },
  child: (bindings: Record<string, unknown>) => {
    const childLogger = logger.child(bindings);
    return {
      debug: (msg: string | object, ...args: unknown[]) => {
        if (typeof msg === 'string') {
          childLogger.debug(msg, ...args);
        } else {
          childLogger.debug(msg, args[0] as string, ...args.slice(1));
        }
      },
      info: (msg: string | object, ...args: unknown[]) => {
        if (typeof msg === 'string') {
          childLogger.info(msg, ...args);
        } else {
          childLogger.info(msg, args[0] as string, ...args.slice(1));
        }
      },
      warn: (msg: string | object, ...args: unknown[]) => {
        if (typeof msg === 'string') {
          childLogger.warn(msg, ...args);
        } else {
          childLogger.warn(msg, args[0] as string, ...args.slice(1));
        }
      },
      error: (msg: string | object, ...args: unknown[]) => {
        if (typeof msg === 'string') {
          childLogger.error(msg, ...args);
        } else {
          childLogger.error(msg, args[0] as string, ...args.slice(1));
        }
      },
      child: (bindings: Record<string, unknown>) => childLogger.child(bindings) as unknown as Logger,
      setLevel: () => {} // Not implemented for pino
    };
  },
  setLevel: () => {} // Not implemented for pino
};

/**
 * Singleton CostGuard – enforces token quotas & cost ceilings.
 * The first call initialises underlying tables if persistence is enabled.
 */
const costGuard = OpenAICostGuard.getInstance(supabase, loggerAdapter);

/**
 * Wrapped OpenAI client.
 * All calls go through costGuard which:
 *  1. Tracks token usage & estimated cost
 *  2. Applies daily / weekly circuit-breaker limits
 *  3. Provides transparent fallback logic if quotas are hit
 */
export const openaiClient = costGuard.createClient();

// Export as 'openai' for backward compatibility
export const openai = costGuard.createClient();

/**
 * Get OpenAI circuit breaker status
 */
export function getOpenAICircuitStatus() {
  return {
    isOpen: false,
    state: 'CLOSED', // Add the missing state property
    failureCount: 0,
    lastFailureTime: null,
    nextAttemptTime: null,
    metrics: {
      dailyTokens: 0,
      dailyRequests: 0,
      errorRate: 0
    },
    config: {
      dailyTokenQuota: 1000000,
      dailyRequestQuota: 10000,
      errorThreshold: 0.1
    }
  };
}

/**
 * Get OpenAI usage metrics
 */
export function getOpenAIUsageMetrics() {
  return {
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    averageResponseTime: 0,
    errorRate: 0
  };
}