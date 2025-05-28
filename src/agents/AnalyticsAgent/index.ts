import { SupabaseClient } from '@supabase/supabase-js';
import { AnalyticsAgentConfig, AnalyticsSummary, CapperStats, PlayType, Tier, StatType } from './types';
import { BaseAgent } from '../BaseAgent';
import { ErrorHandlerConfig, ErrorHandler, DatabaseError, AgentError } from '../../shared/errors';
import { Logger } from '../../shared/logger';
import { Metrics, MetricType } from '../../shared/metrics';
import {
  AnalyticsMetrics,
  ROIAnalysis,
  TrendAnalysis,
  CapperPerformance
} from './types';
import {
  calculateROI,
  calculateTrend,
  calculatePerformance
} from './utils/calculations';

// Helper to compute trend tags based on streaks/win%
function getTrendTag(stats: CapperStats): string {
  if (stats.streak >= 5 || stats.winPct >= 0.7) return '🔥 On Fire';
  if (stats.streak <= -3 || stats.winPct <= 0.35) return '🧊 Cold';
  if (stats.winPct >= 0.55 && stats.roi >= 0.08 && stats.streak >= 3) return '💎 Hidden Gem';
  return '';
}

// Helper for window filtering
function filterByWindow<T extends { settled_at: string }>(data: T[], days: number): T[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return data.filter(row => new Date(row.settled_at).getTime() >= cutoff);
}

export class AnalyticsAgent extends BaseAgent {
  private metrics: AnalyticsMetrics = {
    totalProcessed: 0,
    capperCount: 0,
    avgROI: 0,
    profitableCappers: 0,
    activeStreaks: 0,
    processingTimeMs: 0,
    errorCount: 0,
    successCount: 0,
    memoryUsageMb: 0,
    lastRunStats: {
      startTime: '',
      endTime: '',
      recordsProcessed: 0
    }
  };

  private errorHandler: ErrorHandler;
  private logger: Logger;
  private metricsCollector: Metrics;

  constructor(
    config: AnalyticsAgentConfig,
    supabase: SupabaseClient,
    errorConfig: ErrorHandlerConfig
  ) {
    super(config, supabase, errorConfig);
    this.errorHandler = new ErrorHandler(errorConfig);
    this.logger = new Logger('AnalyticsAgent', config.logLevel);
    this.metricsCollector = new Metrics('analytics_agent', config.metricsConfig);
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Initializing AnalyticsAgent');
    
    // Verify access to required tables
    const requiredTables = [
      'final_picks',
      'analytics_summary',
      'roi_by_tier',
      'roi_by_ticket_type'
    ];

    for (const table of requiredTables) {
      try {
        await this.errorHandler.withRetry(
          async () => {
            const { error } = await this.supabase
              .from(table)
              .select('id')
              .limit(1);

            if (error) {
              throw new DatabaseError(
                `Failed to access ${table}`,
                'SELECT',
                table,
                { supabaseError: error }
              );
            }
          },
          `initialize table check: ${table}`
        );
        
        this.logger.debug(`Verified access to table: ${table}`);
      } catch (error) {
        this.logger.error(`Failed to initialize table: ${table}`, error);
        throw new AgentError(
          `Failed to initialize AnalyticsAgent: ${error.message}`,
          'AnalyticsAgent',
          { table, error }
        );
      }
    }

    this.logger.info('AnalyticsAgent initialized successfully');
  }

  public async runAnalysis(): Promise<void> {
    const startTime = Date.now();
    this.metrics.lastRunStats.startTime = new Date().toISOString();
    this.logger.info('Starting analytics run');

    try {
      // Get all cappers with picks
      const { data: cappers, error: capperError } = await this.metricsCollector.measureDuration(
        'fetch_cappers',
        () => this.errorHandler.withRetry(
          async () => this.supabase
            .from('final_picks')
            .select('capper_id')
            .distinct(),
          'fetch distinct cappers'
        ),
        { operation: 'fetch_cappers' }
      );

      if (capperError) {
        throw new DatabaseError(
          'Failed to fetch cappers',
          'SELECT DISTINCT',
          'final_picks',
          { supabaseError: capperError }
        );
      }
      
      this.metrics.capperCount = cappers?.length || 0;
      this.metricsCollector.setGauge('capper_count', this.metrics.capperCount);
      this.logger.info(`Found ${this.metrics.capperCount} cappers to analyze`);

      // Process each capper
      for (const capper of (cappers || [])) {
        try {
          await this.processCapperAnalytics(capper.capper_id);
          this.metrics.successCount++;
          this.metricsCollector.incrementCounter('capper_processed_success');
        } catch (error) {
          this.metrics.errorCount++;
          this.metricsCollector.incrementCounter('capper_processed_error');
          this.logger.error(
            `Failed to process capper ${capper.capper_id}:`,
            error as Error,
            { capperId: capper.capper_id }
          );
        }
      }

      this.metrics.lastRunStats.endTime = new Date().toISOString();
      this.metrics.processingTimeMs = Date.now() - startTime;
      this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;

      // Update final metrics
      this.metricsCollector.setGauge('processing_time_ms', this.metrics.processingTimeMs);
      this.metricsCollector.setGauge('memory_usage_mb', this.metrics.memoryUsageMb);
      this.metricsCollector.setGauge('success_rate', 
        this.metrics.successCount / (this.metrics.successCount + this.metrics.errorCount)
      );

      this.logger.info('Analytics run completed', {
        duration: this.metrics.processingTimeMs,
        cappers: this.metrics.capperCount,
        success: this.metrics.successCount,
        errors: this.metrics.errorCount
      });

    } catch (error) {
      this.metrics.errorCount++;
      this.metricsCollector.incrementCounter('run_failed');
      this.logger.error('Analytics run failed', error as Error);
      throw new AgentError(
        `Analytics run failed: ${error.message}`,
        'AnalyticsAgent',
        { error }
      );
    }
  }

  private async processCapperAnalytics(capperId: string): Promise<void> {
    const config = this.context.config as AnalyticsAgentConfig;
    const logger = this.logger.child({ capperId });
    
    try {
      logger.debug('Processing capper analytics');

      // Get capper's picks
      const { data: picks, error } = await this.metricsCollector.measureDuration(
        'fetch_picks',
        () => this.errorHandler.withRetry(
          async () => this.supabase
            .from('final_picks')
            .select('*')
            .eq('capper_id', capperId)
            .order('created_at', { ascending: true }),
          `fetch picks for capper ${capperId}`
        ),
        { capperId }
      );

      if (error) {
        throw new DatabaseError(
          'Failed to fetch picks',
          'SELECT',
          'final_picks',
          { capperId, supabaseError: error }
        );
      }

      if (!picks || picks.length < config.analysisConfig.minPicksForAnalysis) {
        logger.debug('Insufficient picks for analysis', {
          pickCount: picks?.length,
          required: config.analysisConfig.minPicksForAnalysis
        });
        return;
      }

      logger.debug('Calculating ROI analyses');
      // Calculate ROI for each timeframe
      const roiAnalyses = await Promise.all(
        config.analysisConfig.roiTimeframes.map(timeframe => {
          const timeframePicks = picks.filter(p => {
            const pickDate = new Date(p.created_at);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - timeframe);
            return pickDate >= cutoff;
          });
          return calculateROI(timeframePicks);
        })
      );

      logger.debug('Calculating trends');
      // Calculate trends
      const trends = picks.reduce((acc, pick) => {
        if (!acc[pick.stat_type]) {
          acc[pick.stat_type] = [];
        }
        acc[pick.stat_type].push(pick);
        return acc;
      }, {} as Record<string, any[]>);

      const trendAnalyses = Object.values(trends)
        .filter(statPicks => statPicks.length >= config.analysisConfig.streakThreshold)
        .map(statPicks => calculateTrend(statPicks));

      logger.debug('Calculating performance metrics');
      // Calculate overall performance
      const statTypePerformance = picks.reduce((acc, pick) => {
        if (!acc[pick.stat_type]) {
          acc[pick.stat_type] = { wins: 0, total: 0 };
        }
        acc[pick.stat_type].total++;
        if (pick.result === 'win') acc[pick.stat_type].wins++;
        return acc;
      }, {} as Record<string, { wins: number; total: number }>);

      const performance = calculatePerformance(roiAnalyses[0], statTypePerformance);

      logger.debug('Storing analytics results');
      // Store results
      await this.storeAnalytics(capperId, {
        roiAnalyses,
        trends: trendAnalyses,
        performance
      });

      // Update metrics
      this.metrics.totalAnalyzed++;
      if (performance.roi > 0) {
        this.metrics.profitableCappers++;
      }
      this.metrics.avgROI = (this.metrics.avgROI * (this.metrics.totalAnalyzed - 1) + performance.roi) / this.metrics.totalAnalyzed;
      this.metrics.activeStreaks += trendAnalyses.length;

      // Update metrics collector
      this.metricsCollector.setGauge('profitable_cappers', this.metrics.profitableCappers);
      this.metricsCollector.setGauge('avg_roi', this.metrics.avgROI);
      this.metricsCollector.setGauge('active_streaks', this.metrics.activeStreaks);

      logger.info('Capper analytics processed successfully', {
        pickCount: picks.length,
        roi: performance.roi,
        streaks: trendAnalyses.length
      });

    } catch (error) {
      logger.error('Failed to process capper analytics', error as Error);
      throw new AgentError(
        `Failed to process capper analytics: ${error.message}`,
        'AnalyticsAgent',
        { capperId, error }
      );
    }
  }

  private async storeAnalytics(
    capperId: string,
    results: {
      roiAnalyses: ROIAnalysis[];
      trends: TrendAnalysis[];
      performance: CapperPerformance;
    }
  ): Promise<void> {
    const logger = this.logger.child({ capperId });

    try {
      logger.debug('Storing analytics summary');
      await this.metricsCollector.measureDuration(
        'store_analytics',
        async () => {
          await this.errorHandler.withRetry(
            async () => {
              const { error: summaryError } = await this.supabase
                .from('analytics_summary')
                .upsert({
                  capper_id: capperId,
                  ...results.performance,
                  updated_at: new Date().toISOString()
                });

              if (summaryError) {
                throw new DatabaseError(
                  'Failed to upsert analytics summary',
                  'UPSERT',
                  'analytics_summary',
                  { capperId, supabaseError: summaryError }
                );
              }
            },
            'store analytics summary'
          );

          logger.debug('Storing ROI analysis');
          await this.errorHandler.withRetry(
            async () => {
              const { error: roiError } = await this.supabase
                .from('roi_by_tier')
                .upsert(
                  results.roiAnalyses.map(roi => ({
                    ...roi,
                    tier: results.performance.tier,
                    created_at: new Date().toISOString()
                  }))
                );

              if (roiError) {
                throw new DatabaseError(
                  'Failed to upsert ROI analysis',
                  'UPSERT',
                  'roi_by_tier',
                  { capperId, supabaseError: roiError }
                );
              }
            },
            'store ROI analysis'
          );

          logger.debug('Storing trend analysis');
          await this.errorHandler.withRetry(
            async () => {
              const { error: trendsError } = await this.supabase
                .from('trend_analysis')
                .upsert(
                  results.trends.map(trend => ({
                    ...trend,
                    created_at: new Date().toISOString()
                  }))
                );

              if (trendsError) {
                throw new DatabaseError(
                  'Failed to upsert trend analysis',
                  'UPSERT',
                  'trend_analysis',
                  { capperId, supabaseError: trendsError }
                );
              }
            },
            'store trend analysis'
          );
        },
        { capperId }
      );

      logger.info('Analytics stored successfully');
    } catch (error) {
      logger.error('Failed to store analytics', error as Error);
      throw new AgentError(
        `Failed to store analytics: ${error.message}`,
        'AnalyticsAgent',
        { capperId, error }
      );
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Starting cleanup');
    // Cleanup old analytics data
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90); // Keep 90 days of history

    const tables = ['analytics_summary', 'roi_by_tier', 'trend_analysis'];
    
    for (const table of tables) {
      try {
        await this.metricsCollector.measureDuration(
          'cleanup',
          () => this.errorHandler.withRetry(
            async () => {
              const { error } = await this.supabase
                .from(table)
                .delete()
                .lt('created_at', cutoff.toISOString());

              if (error) {
                throw new DatabaseError(
                  `Failed to cleanup ${table}`,
                  'DELETE',
                  table,
                  { cutoff, supabaseError: error }
                );
              }
            },
            `cleanup ${table}`
          ),
          { table }
        );

        this.logger.debug(`Cleaned up old data from ${table}`);
      } catch (error) {
        this.logger.error(
          `Failed to cleanup ${table}:`,
          error as Error
        );
      }
    }

    this.logger.info('Cleanup completed');
  }

  protected async healthCheck(): Promise<HealthStatus> {
    this.logger.debug('Running health check');
    const errors = [];
    const config = this.context.config as AnalyticsAgentConfig;

    if (this.metrics.errorCount > 0) {
      errors.push(`${this.metrics.errorCount} errors in last run`);
    }

    if (this.metrics.processingTimeMs > 300000) { // 5 minutes
      errors.push('Processing time exceeds threshold');
    }

    if (this.metrics.capperCount === 0) {
      errors.push('No cappers found for analysis');
    }

    const status = errors.length === 0 ? 'ok' : 'warn';
    this.logger.info('Health check completed', { status, errors });

    return {
      status,
      message: errors.join('; '),
      details: {
        metrics: this.metrics
      }
    };
  }

  // Placeholder for Discord/Retool push
  async publishToDiscord(summaries: AnalyticsSummary[]) {
    // TODO: Format and send to Discord or Retool webhook/dashboard
    // Example: createLeaderboardEmbed(summaries)
  }
}

// Helper: Current win/loss streak
function calcStreak(picks: any[]): number {
  let streak = 0;
  for (let i = picks.length - 1; i >= 0; i--) {
    if (picks[i].outcome === 'win') streak++;
    else if (picks[i].outcome === 'loss') streak--;
    else break;
  }
  return streak;
}

// Helper: Edge/volatility metric (simple stddev of ROI or outcome)
function calcEdgeVolatility(picks: any[]): number {
  const rois = picks.map(p => (p.profit || 0) / (p.units || 1));
  const avg = rois.reduce((a, b) => a + b, 0) / (rois.length || 1);
  const sqDiff = rois.map(r => Math.pow(r - avg, 2));
  return Math.sqrt(sqDiff.reduce((a, b) => a + b, 0) / (sqDiff.length || 1));
}
