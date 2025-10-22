import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { cacheClient } from '../cacheClient.js';
import { creditLogger } from '../creditLogger.js';
import { circuitBreaker } from '../enhanced-circuit-breaker';
import { apiQuotaCoordinator } from '../APIQuotaCoordinator';
import {
  externalApiCalls,
  externalApiDuration,
  externalApiErrors,
  providerCacheHits,
  providerCacheMisses,
  providerCreditsUsed,
  providerBudgetRemainingPercent,
  providerCircuitBreakerState,
} from '../metricsServer';

// Simple in-memory token bucket per provider
interface TokenBucket { capacity: number; tokens: number; refillRatePerSec: number; lastRefill: number; }

// Keep last-known remaining credits per provider
const lastRemainingByProvider: Record<string, number | undefined> = {};

function nowMs() { return Date.now(); }

function refill(bucket: TokenBucket) {
  const now = nowMs();
  const elapsed = (now - bucket.lastRefill) / 1000;
  const refillTokens = elapsed * bucket.refillRatePerSec;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refillTokens);
  bucket.lastRefill = now;
}

const buckets: Record<string, TokenBucket> = {};

function getBucket(provider: string): TokenBucket {
  if (!buckets[provider]) {
    const rpm = parseInt(process.env.ODDS_API_RPM || '60', 10); // default 60 rpm
    const rps = Math.max(1, rpm) / 60;
    buckets[provider] = { capacity: Math.max(1, rpm), tokens: Math.max(1, rpm), refillRatePerSec: rps, lastRefill: nowMs() };
  }
  return buckets[provider];
}

export type ProviderName = 'oddsapi' | string;

export interface ProviderRequestOptions {
  provider: ProviderName;
  endpoint: string; // e.g., /sports/nfl/odds
  method?: 'GET';
  params?: Record<string, any>;
  headers?: Record<string, string>;
  cacheKey?: string;
  cacheTtlSeconds?: number; // default from env
  dedupKey?: string;
  priority?: number; // 1-10
}

export class ProviderGateway {
  private inFlight: Map<string, Promise<any>> = new Map();
  private monthlyLimitByProvider: Record<string, number> = { oddsapi: parseInt(process.env.ODDS_API_MONTHLY_LIMIT || '5000000', 10) };

  constructor() {
    // Wire circuit breaker metrics for provider(s)
    circuitBreaker.on('circuitOpened', ({ serviceName }) => {
      if (serviceName === 'oddsapi') providerCircuitBreakerState.labels('oddsapi').set(1);
    });
    circuitBreaker.on('circuitHalfOpened', ({ serviceName }) => {
      if (serviceName === 'oddsapi') providerCircuitBreakerState.labels('oddsapi').set(0.5);
    });
    circuitBreaker.on('circuitClosed', ({ serviceName }) => {
      if (serviceName === 'oddsapi') providerCircuitBreakerState.labels('oddsapi').set(0);
    });
  }

  async request<T>(opts: ProviderRequestOptions): Promise<T> {
    const provider = opts.provider;
    const method = opts.method || 'GET';
    const endpoint = opts.endpoint;
    const params = opts.params || {};
    const headers = opts.headers || {};

    const requestId = `${provider}:${endpoint}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const dedupKey = opts.dedupKey || `${provider}:${endpoint}:${JSON.stringify(params)}`;
    const cacheKey = opts.cacheKey || `${provider}:${endpoint}:${JSON.stringify(params)}`;
    const ttl = opts.cacheTtlSeconds ?? parseInt(process.env.ODDS_EVENT_CACHE_TTL_SECONDS || '120', 10);

    // Emergency freeze enforcement (oddsapi)
    if (provider === 'oddsapi' && process.env.ODDS_API_EMERGENCY_FREEZE === '1') {
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        providerCacheHits.labels(provider, endpoint).inc();
        return cached as T;
      }
      providerCacheMisses.labels(provider, endpoint).inc();
      throw new Error('[ProviderGateway] Emergency freeze enabled; live calls blocked');
    }

    // Remaining-credit pre-check
    const minRemaining = parseInt(process.env.ODDS_API_MIN_REMAINING || '25', 10);
    const lastRemaining = lastRemainingByProvider[provider];
    if (typeof lastRemaining === 'number' && lastRemaining < minRemaining) {
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        providerCacheHits.labels(provider, endpoint).inc();
        return cached as T;
      }
      providerCacheMisses.labels(provider, endpoint).inc();
      throw new Error(`[ProviderGateway] Remaining credits ${lastRemaining} below threshold ${minRemaining}`);
    }

    // Cache-first
    const cached = await cacheClient.get(cacheKey);
    if (cached) {
      providerCacheHits.labels(provider, endpoint).inc();
      return cached as T;
    }
    providerCacheMisses.labels(provider, endpoint).inc();

    // Token bucket rate limit
    const bucket = getBucket(provider);
    refill(bucket);
    if (bucket.tokens < 1) {
      const waitMs = Math.ceil((1 - bucket.tokens) / bucket.refillRatePerSec * 1000);
      await new Promise(res => setTimeout(res, waitMs));
      refill(bucket);
    }
    bucket.tokens -= 1;

    // Ask coordinator if allowed (runtime budgets)
    const access = await apiQuotaCoordinator.requestAPIAccess(provider, endpoint, opts.priority || 5, { requestId });
    if (!access.allowed) {
      throw new Error(`[ProviderGateway] Quota denied: ${access.reason || 'unknown'}`);
    }

    // Deduplicate concurrent requests
    if (this.inFlight.has(dedupKey)) {
      return this.inFlight.get(dedupKey)! as Promise<T>;
    }

    const doCall = async (): Promise<T> => {
      const start = Date.now();
      externalApiCalls.labels(provider, endpoint, 'attempt').inc();

      // Log request for cost tracking
      creditLogger.addCall(provider, 1, 1, dedupKey);

      const url = provider === 'oddsapi'
        ? `https://api.the-odds-api.com/v4${endpoint}`
        : endpoint; // for other providers, endpoint should be full URL

      const apiKeyHeader = provider === 'oddsapi' ? { apiKey: process.env.ODDS_API_KEY as string } : {};
      const requestConfig: AxiosRequestConfig = { method, url, params: { ...apiKeyHeader, ...params }, headers, timeout: 30000 };

      try {
        const response: AxiosResponse<T> = await axios.request<T>(requestConfig);

        // Metrics and credit tracking
        const dur = (Date.now() - start) / 1000;
        externalApiDuration.labels(provider, endpoint, String(response.status)).observe(dur);
        externalApiCalls.labels(provider, endpoint, String(response.status)).inc();

        const remaining = (response.headers['x-requests-remaining'] as any) || (response.headers['x-requests-available'] as any);
        if (remaining !== undefined) {
          const remainingInt = parseInt(String(remaining), 10);
          lastRemainingByProvider[provider] = remainingInt;
          const monthlyLimit = this.monthlyLimitByProvider[provider] || 1000000;
          const pct = Math.max(0, Math.min(100, (remainingInt / monthlyLimit) * 100));
          providerBudgetRemainingPercent.labels(provider).set(pct);
        }

        // Assume 1 credit/request if header absent
        providerCreditsUsed.labels(provider, endpoint).inc(1);

        // Cache response
        await cacheClient.set(cacheKey, response.data, ttl);

        return response.data;
      } catch (err: any) {
        externalApiErrors.labels(provider, err?.response?.status ? String(err.response.status) : 'error').inc();
        externalApiCalls.labels(provider, endpoint, err?.response?.status ? String(err.response.status) : 'error').inc();
        throw err;
      }
    };

    const wrapped = circuitBreaker.executeCall<T>('oddsapi', doCall);
    this.inFlight.set(dedupKey, wrapped);

    try {
      const result = await wrapped;
      return result;
    } finally {
      this.inFlight.delete(dedupKey);
    }
  }
}

export const providerGateway = new ProviderGateway();

