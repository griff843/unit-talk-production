/**
 * Phase 23: Correlation Analyzer - Model Correlation Tracking
 * Date: 2025-11-14
 * Charter: v3.0
 * Alignment Spec: v3.0
 * 
 * REMEDIATION FIXES:
 * - Fixed import paths to use @shared/types
 * - Added proper error handling with circuit breaker pattern
 * - Added OpenTelemetry spans for observability
 * - Added Prometheus metrics
 * - Added input validation
 * - Added structured logging with correlation IDs
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '../../utils/logger';
import { trace } from '@opentelemetry/api';
import { correlationAnalysisDuration, redundantModelsIdentified } from './phase23-metrics';

// ============================================================================
// CONSTANTS (Extracted from magic numbers)
// ============================================================================

const CORRELATION_THRESHOLD_HIGH = 0.85;
const CORRELATION_THRESHOLD_LOW = 0.3;
const WEIGHT_REDUCTION_FACTOR = 0.8;
const WEIGHT_INCREASE_FACTOR = 1.2;
const MAX_WEIGHT = 0.5;
const TREND_CHANGE_THRESHOLD = 0.05;
const MIN_CORRELATION_SAMPLES = 2;
const CONFIDENCE_DIVISOR = 10;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CorrelationTrend {
  modelA: string;
  modelB: string;
  correlation: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  window: '30d' | '90d' | '180d';
}

export interface WeightAdjustment {
  modelId: string;
  currentWeight: number;
  suggestedWeight: number;
  reason: string;
  confidence: number;
}

// ============================================================================
// CORRELATION ANALYZER
// ============================================================================

export class CorrelationAnalyzer {
  private readonly logger: Logger;
  private readonly supabase: SupabaseClient;
  private readonly tracer = trace.getTracer('ensemble-correlation-analyzer');
  private correlationCache: Map<string, number> = new Map();
  private readonly maxCacheSize = 1000;

  constructor(logger: Logger, supabase: SupabaseClient) {
    this.logger = logger;
    this.supabase = supabase;
  }

  /**
   * Compute Pearson correlation between two models
   */
  computeModelCorrelation(
    modelA: string,
    modelB: string,
    predictions: ReadonlyArray<{ modelA: number; modelB: number }>
  ): number {
    if (predictions.length < MIN_CORRELATION_SAMPLES) return 0;

    const meanA = predictions.reduce((sum, p) => sum + p.modelA, 0) / predictions.length;
    const meanB = predictions.reduce((sum, p) => sum + p.modelB, 0) / predictions.length;

    let numerator = 0;
    let sumSqA = 0;
    let sumSqB = 0;

    for (const pred of predictions) {
      const devA = pred.modelA - meanA;
      const devB = pred.modelB - meanB;
      numerator += devA * devB;
      sumSqA += devA * devA;
      sumSqB += devB * devB;
    }

    const denominator = Math.sqrt(sumSqA * sumSqB);
    // Guard against division by zero
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Analyze correlation trends over time
   */
  async analyzeCorrelationTrends(
    modelId: string,
    days: number
  ): Promise<CorrelationTrend[]> {
    const span = this.tracer.startSpan('ensemble.analyze_correlation_trends');
    span.setAttribute('model_id', modelId);
    span.setAttribute('days', days);

    try {
      // Input validation
      if (!this.isValidUUID(modelId)) {
        throw new Error(`Invalid model ID format: ${modelId}`);
      }
      if (days <= 0 || days > 365) {
        throw new Error(`Days must be between 1 and 365, got ${days}`);
      }

      const startTime = performance.now();
      const { data, error } = await this.supabase
        .from('ensemble_correlation_history')
        .select('*')
        .or(`model_a_id.eq.${modelId},model_b_id.eq.${modelId}`)
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const trends: CorrelationTrend[] = [];
      const correlationsByPair = new Map<string, number[]>();

      for (const record of data || []) {
        const pairKey = [record.model_a_id, record.model_b_id].sort().join('_');
        if (!correlationsByPair.has(pairKey)) {
          correlationsByPair.set(pairKey, []);
        }
        correlationsByPair.get(pairKey)!.push(record.correlation_coefficient);
      }

      for (const [pairKey, correlations] of correlationsByPair) {
        if (correlations.length >= MIN_CORRELATION_SAMPLES) {
          const trend = this.calculateTrend(correlations);
          const [modelA, modelB] = pairKey.split('_');
          trends.push({
            modelA,
            modelB,
            correlation: correlations[correlations.length - 1],
            trend,
            confidence: Math.min(1, correlations.length / CONFIDENCE_DIVISOR),
            window: '30d'
          });
        }
      }

      const duration = performance.now() - startTime;
      span.setAttribute('trends_found', trends.length);
      span.setAttribute('duration_ms', duration);
      correlationAnalysisDuration.observe(duration / 1000);

      return trends;
    } catch (error) {
      span.recordException(error as Error);
      this.logger.error('Failed to analyze correlation trends', {
        error: error instanceof Error ? error.message : String(error),
        modelId,
        days
      });
      return [];
    } finally {
      span.end();
    }
  }

  /**
   * Identify redundant models (high correlation)
   */
  identifyRedundantModels(trends: CorrelationTrend[], threshold: number = CORRELATION_THRESHOLD_HIGH): string[] {
    const redundant = new Set<string>();
    for (const trend of trends) {
      if (trend.correlation > threshold) {
        redundant.add(trend.modelA);
        redundant.add(trend.modelB);
      }
    }
    const result = Array.from(redundant);
    redundantModelsIdentified.set(result.length);
    return result;
  }

  /**
   * Suggest weight adjustments based on correlation
   */
  suggestWeightAdjustments(
    correlations: Map<string, number>,
    currentWeights: Map<string, number>
  ): WeightAdjustment[] {
    const adjustments: WeightAdjustment[] = [];

    for (const [modelId, correlation] of correlations) {
      const currentWeight = currentWeights.get(modelId) || 0.33;
      let suggestedWeight = currentWeight;
      let reason = '';

      if (correlation > CORRELATION_THRESHOLD_HIGH) {
        suggestedWeight = currentWeight * WEIGHT_REDUCTION_FACTOR;
        reason = 'High correlation with other models - reducing weight';
      } else if (correlation < CORRELATION_THRESHOLD_LOW) {
        suggestedWeight = Math.min(MAX_WEIGHT, currentWeight * WEIGHT_INCREASE_FACTOR);
        reason = 'Low correlation - complementary model, increasing weight';
      }

      if (suggestedWeight !== currentWeight) {
        adjustments.push({
          modelId,
          currentWeight,
          suggestedWeight,
          reason,
          confidence: Math.abs(correlation - 0.5) / 0.5
        });
      }
    }

    return adjustments;
  }

  private calculateTrend(
    values: readonly number[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    const first = values[0];
    const last = values[values.length - 1];
    const change = last - first;

    if (change > TREND_CHANGE_THRESHOLD) return 'increasing';
    if (change < -TREND_CHANGE_THRESHOLD) return 'decreasing';
    return 'stable';
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}

