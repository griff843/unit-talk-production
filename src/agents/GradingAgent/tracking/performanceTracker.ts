import { SupabaseClient } from '@supabase/supabase-js';
import { Pick, GradeTier, BetType } from '../types';
import { logger } from '../../../services/logging';
import * as metrics from '../monitoring/metrics';

interface PerformanceMetrics {
  total_processed: number;
  successful: number;
  failed: number;
  processing_time_ms: number;
  tier_distribution: Record<GradeTier, number>;
  bet_type_distribution: Record<BetType, number>;
}

export class PerformanceTracker {
  private static instance: PerformanceTracker;
  private metrics: PerformanceMetrics = {
    total_processed: 0,
    successful: 0,
    failed: 0,
    processing_time_ms: 0,
    tier_distribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
    bet_type_distribution: {
      single: 0,
      parlay: 0,
      teaser: 0,
      roundrobin: 0,
      sgp: 0
    }
  };

  private constructor(private supabase: SupabaseClient) {
    this.setupPeriodicSync();
  }

  public static getInstance(supabase: SupabaseClient): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker(supabase);
    }
    return PerformanceTracker.instance;
  }

  private setupPeriodicSync(): void {
    setInterval(() => this.syncMetrics(), 60000); // Sync every minute
  }

  public async trackPick(pick: Pick, result: { tier: GradeTier, duration_ms: number, success: boolean }): Promise<void> {
    try {
      // Update local metrics
      this.metrics.total_processed++;
      this.metrics.processing_time_ms += result.duration_ms;
      
      if (result.success) {
        this.metrics.successful++;
        this.metrics.tier_distribution[result.tier]++;
        this.metrics.bet_type_distribution[pick.bet_type]++;
      } else {
        this.metrics.failed++;
      }

      // Update Prometheus metrics
      metrics.trackPickProcessed(pick.bet_type, result.success ? 'success' : 'failure');
      metrics.trackPickGrade(result.tier, pick.bet_type);
      metrics.trackProcessingTime(pick.bet_type, result.duration_ms);

      // Store in Supabase
      await this.supabase.from('grading_performance').insert({
        pick_id: pick.id,
        bet_type: pick.bet_type,
        tier: result.tier,
        processing_time_ms: result.duration_ms,
        success: result.success,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to track pick performance:', error);
      metrics.trackFailedOperation('performance_tracking', error.message);
    }
  }

  private async syncMetrics(): Promise<void> {
    try {
      await this.supabase.from('grading_metrics').insert({
        ...this.metrics,
        timestamp: new Date().toISOString()
      });

      // Reset counters after successful sync
      this.resetMetrics();
    } catch (error) {
      logger.error('Failed to sync metrics:', error);
      metrics.trackFailedOperation('metrics_sync', error.message);
    }
  }

  private resetMetrics(): void {
    this.metrics = {
      total_processed: 0,
      successful: 0,
      failed: 0,
      processing_time_ms: 0,
      tier_distribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
      bet_type_distribution: {
        single: 0,
        parlay: 0,
        teaser: 0,
        roundrobin: 0,
        sgp: 0
      }
    };
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
} 