/**
 * Phase 23: Weight Convergence Engine
 * Date: 2025-11-14
 * Charter: v3.0
 * 
 * REMEDIATION FIXES:
 * - Proper EWMA implementation with state tracking
 * - Division by zero guards
 * - OpenTelemetry spans
 * - Prometheus metrics
 * - Bounded history with MAX_HISTORY_LENGTH
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '../../utils/logger';
import { trace } from '@opentelemetry/api';
import { weightConvergenceScore, convergenceSnapshotsCaptured } from './phase23-metrics';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_HISTORY_LENGTH = 1000;
const CONVERGENCE_VARIANCE_THRESHOLD = 0.01;
const CONVERGENCE_OSCILLATION_THRESHOLD = 0.1;
const STABILITY_SCORE_THRESHOLD = 0.8;
const EWMA_ALPHA_DEFAULT = 0.3;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ConvergenceMetrics {
  variance: number;
  oscillationScore: number;
  stabilityScore: number;
  isConverged: boolean;
  convergenceRate: number;
}

export interface WeightHistory {
  modelId: string;
  weight: number;
  timestamp: Date;
}

export interface ConvergenceSnapshot {
  modelId: string;
  weight: number;
  convergenceScore: number;
  stabilityIndicator: number;
  timestamp: Date;
}

// ============================================================================
// WEIGHT CONVERGENCE ENGINE
// ============================================================================

export class WeightConvergenceEngine {
  private readonly logger: Logger;
  private readonly supabase: SupabaseClient;
  private readonly tracer = trace.getTracer('ensemble-weight-convergence');
  private weightHistory: Map<string, WeightHistory[]> = new Map();
  private previousSmoothedWeights: Map<string, number> = new Map();

  constructor(logger: Logger, supabase: SupabaseClient) {
    this.logger = logger;
    this.supabase = supabase;
  }

  /**
   * Analyze weight convergence metrics
   */
  analyzeConvergence(
    weights: Map<string, number>,
    history: readonly WeightHistory[]
  ): ConvergenceMetrics {
    if (history.length < 2) {
      return {
        variance: 0,
        oscillationScore: 0,
        stabilityScore: 1,
        isConverged: false,
        convergenceRate: 0
      };
    }

    // Calculate variance of recent weights
    const recentWeights = Array.from(weights.values());
    const mean = recentWeights.reduce((a, b) => a + b, 0) / recentWeights.length;
    const variance = recentWeights.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / recentWeights.length;

    // Calculate oscillation score
    const oscillationScore = this.calculateOscillation(history);

    // Calculate stability score (guard against negative values)
    const stabilityScore = Math.max(0, 1 - oscillationScore - variance);

    // Determine convergence
    const isConverged = variance < CONVERGENCE_VARIANCE_THRESHOLD && 
                       oscillationScore < CONVERGENCE_OSCILLATION_THRESHOLD;

    // Calculate convergence rate
    const convergenceRate = this.calculateConvergenceRate(history);

    return {
      variance,
      oscillationScore,
      stabilityScore,
      isConverged,
      convergenceRate
    };
  }

  /**
   * Apply exponential moving average (EMA) smoothing with proper state tracking
   */
  applyEMASmoothing(
    weights: Map<string, number>,
    alpha: number = EWMA_ALPHA_DEFAULT
  ): Map<string, number> {
    const smoothed = new Map<string, number>();

    for (const [modelId, weight] of weights) {
      const previousWeight = this.previousSmoothedWeights.get(modelId);
      
      if (previousWeight === undefined) {
        // First time seeing this model
        smoothed.set(modelId, weight);
        this.previousSmoothedWeights.set(modelId, weight);
      } else {
        // Apply EWMA formula: smoothed = alpha * current + (1-alpha) * previous
        const smoothedWeight = alpha * weight + (1 - alpha) * previousWeight;
        smoothed.set(modelId, smoothedWeight);
        this.previousSmoothedWeights.set(modelId, smoothedWeight);
      }
    }

    return smoothed;
  }

  /**
   * Check if weights have converged
   */
  isConverged(metrics: ConvergenceMetrics): boolean {
    return metrics.isConverged && metrics.stabilityScore > STABILITY_SCORE_THRESHOLD;
  }

  /**
   * Capture convergence snapshot
   */
  async captureSnapshot(
    weights: Map<string, number>,
    metrics: ConvergenceMetrics,
    tenantId: string
  ): Promise<void> {
    const span = this.tracer.startSpan('ensemble.capture_convergence_snapshot');
    span.setAttribute('model_count', weights.size);
    span.setAttribute('is_converged', metrics.isConverged);

    try {
      const snapshots: ConvergenceSnapshot[] = [];

      for (const [modelId, weight] of weights) {
        snapshots.push({
          modelId,
          weight,
          convergenceScore: metrics.isConverged ? 1 : 0.5,
          stabilityIndicator: metrics.stabilityScore,
          timestamp: new Date()
        });

        // Update Prometheus metric
        weightConvergenceScore.set({ model_id: modelId }, metrics.isConverged ? 1 : 0.5);
      }

      const { error } = await this.supabase
        .from('convergence_snapshots')
        .insert(snapshots.map(s => ({
          tenant_id: tenantId,
          model_id: s.modelId,
          weight_value: s.weight,
          convergence_score: s.convergenceScore,
          stability_indicator: s.stabilityIndicator,
          snapshot_date: s.timestamp
        })));

      if (error) throw error;
      
      convergenceSnapshotsCaptured.inc();
      this.logger.info('✅ Convergence snapshot captured', { count: snapshots.length });
    } catch (error) {
      span.recordException(error as Error);
      this.logger.error('Failed to capture convergence snapshot', {
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      span.end();
    }
  }

  /**
   * Add weight history entry with bounded growth
   */
  addWeightHistory(modelId: string, weight: number): void {
    const history = this.weightHistory.get(modelId) || [];
    history.push({ modelId, weight, timestamp: new Date() });
    
    // Keep only recent N entries to prevent memory leak
    if (history.length > MAX_HISTORY_LENGTH) {
      history.shift();
    }
    
    this.weightHistory.set(modelId, history);
  }

  private calculateOscillation(history: readonly WeightHistory[]): number {
    if (history.length < 3) return 0;

    let oscillations = 0;
    for (let i = 1; i < history.length - 1; i++) {
      const prev = history[i - 1].weight;
      const curr = history[i].weight;
      const next = history[i + 1].weight;

      if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
        oscillations++;
      }
    }

    // Guard against division by zero
    const denominator = history.length - 2;
    return denominator === 0 ? 0 : oscillations / denominator;
  }

  private calculateConvergenceRate(history: readonly WeightHistory[]): number {
    if (history.length < 2) return 0;

    const first = history[0].weight;
    const last = history[history.length - 1].weight;
    const change = Math.abs(last - first);

    return Math.max(0, 1 - change);
  }
}

