/**
 * Phase 23: Route Optimizer - Intelligent Model Routing
 * Date: 2025-11-14
 * Charter: v3.0
 * 
 * REMEDIATION FIXES:
 * - Fixed cache key generation (removed timestamp)
 * - Implemented LRU cache with 5-minute TTL
 * - Added circuit breaker integration
 * - Added OpenTelemetry spans
 * - Added Prometheus metrics
 * - Removed embedded SQL migrations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '../../utils/logger';
import { trace } from '@opentelemetry/api';
import { CircuitBreaker } from './phase23-circuit-breaker';
import {
  routingDecisionLatency,
  routingCacheHits,
  routingCacheMisses,
  loadDistributionAllocations
} from './phase23-metrics';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SCORE_THRESHOLD_HIGH = 0.9;
const SCORE_THRESHOLD_MEDIUM = 0.85;
const LOAD_BALANCE_FACTOR = 0.8;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface RoutingDecision {
  modelId: string;
  allocation: number;
  confidence: number;
  reason: string;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

// ============================================================================
// LRU CACHE IMPLEMENTATION
// ============================================================================

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize: number = MAX_CACHE_SIZE, ttlMs: number = CACHE_TTL_MS) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update access count for LRU
    entry.accessCount++;
    return entry.value;
  }

  set(key: string, value: T): void {
    // Remove least recently used if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      let lruKey = '';
      let minAccess = Infinity;

      for (const [k, entry] of this.cache) {
        if (entry.accessCount < minAccess) {
          minAccess = entry.accessCount;
          lruKey = k;
        }
      }

      if (lruKey) this.cache.delete(lruKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// ROUTE OPTIMIZER
// ============================================================================

export class RouteOptimizer {
  private readonly logger: Logger;
  private readonly supabase: SupabaseClient;
  private readonly tracer = trace.getTracer('ensemble-route-optimizer');
  private readonly circuitBreaker: CircuitBreaker;
  private readonly cache: LRUCache<RoutingDecision[]>;

  constructor(logger: Logger, supabase: SupabaseClient) {
    this.logger = logger;
    this.supabase = supabase;
    this.circuitBreaker = new CircuitBreaker(logger, 'route-optimizer');
    this.cache = new LRUCache(MAX_CACHE_SIZE, CACHE_TTL_MS);
  }

  /**
   * Optimize routing for batch of predictions
   */
  async optimizeRouting(
    modelIds: readonly string[],
    features: readonly number[],
    tenantId: string
  ): Promise<RoutingDecision[]> {
    const span = this.tracer.startSpan('ensemble.routing_decision');
    span.setAttribute('model_count', modelIds.length);
    span.setAttribute('feature_count', features.length);

    const startTime = performance.now();

    try {
      // Input validation
      if (!modelIds.length) throw new Error('No models provided');
      if (!features.length) throw new Error('No features provided');
      if (!this.isValidUUID(tenantId)) throw new Error('Invalid tenant ID');

      // Generate cache key (fixed: no timestamp)
      const cacheKey = `${[...modelIds].sort().join('_')}_${features.join('_')}`;

      // Check cache
      const cached = this.cache.get(cacheKey);
      if (cached) {
        routingCacheHits.inc();
        span.setAttribute('cache_hit', true);
        return cached;
      }

      routingCacheMisses.inc();

      // Fetch model scores with circuit breaker
      const decisions = await this.circuitBreaker.executeWithRetry(async () => {
        const { data, error } = await this.supabase
          .from('routing_decisions')
          .select('*')
          .in('model_id', modelIds)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(modelIds.length);

        if (error) throw error;

        return this.computeAllocations(data || [], modelIds);
      });

      // Cache result
      this.cache.set(cacheKey, decisions);

      // Update metrics
      for (const decision of decisions) {
        loadDistributionAllocations.set({ model_id: decision.modelId }, decision.allocation);
      }

      const duration = performance.now() - startTime;
      span.setAttribute('duration_ms', duration);
      routingDecisionLatency.observe(duration);

      return decisions;
    } catch (error) {
      span.recordException(error as Error);
      this.logger.error('Failed to optimize routing', {
        error: error instanceof Error ? error.message : String(error),
        modelCount: modelIds.length
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (useful for monitoring)
   */
  getCacheSize(): number {
    return this.cache.size();
  }

  private computeAllocations(
    records: readonly any[],
    modelIds: readonly string[]
  ): RoutingDecision[] {
    const decisions: RoutingDecision[] = [];
    const scoreMap = new Map<string, number>();

    // Build score map from records
    for (const record of records) {
      scoreMap.set(record.model_id, record.confidence_score || 0.5);
    }

    // Compute allocations based on scores
    let totalScore = 0;
    const scores: number[] = [];

    for (const modelId of modelIds) {
      const score = scoreMap.get(modelId) || 0.5;
      scores.push(score);
      totalScore += score;
    }

    // Guard against division by zero
    if (totalScore === 0) totalScore = modelIds.length;

    for (let i = 0; i < modelIds.length; i++) {
      const allocation = (scores[i] / totalScore) * LOAD_BALANCE_FACTOR;
      const confidence = Math.min(1, scores[i]);

      decisions.push({
        modelId: modelIds[i],
        allocation,
        confidence,
        reason: this.getAllocationReason(confidence)
      });
    }

    return decisions;
  }

  private getAllocationReason(confidence: number): string {
    if (confidence >= SCORE_THRESHOLD_HIGH) return 'High confidence model';
    if (confidence >= SCORE_THRESHOLD_MEDIUM) return 'Medium confidence model';
    return 'Low confidence model - reduced allocation';
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}

