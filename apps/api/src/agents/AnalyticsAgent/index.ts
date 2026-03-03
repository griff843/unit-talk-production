import { BaseAgent } from '../BaseAgent/index';
import {
  BaseAgentConfig,
  BaseAgentDependencies,
  HealthStatus,
  BaseMetrics,
} from '../BaseAgent/types';

interface AnalyticsMetrics extends BaseMetrics {
  totalAnalyzed: number;
  capperCount: number;
  totalPicks: number;
  avgROI: number;
  avgWinRate: number;
  streakCount: number;
  profitableCappers: number;
  activeStreaks: number;
  totalProcessed: number;
  batchesProcessed: number;
  avgBatchTimeMs: number;
  throughputPerMinute: number;
  cacheHitRate: number;
  lastRunStats: {
    startTime: string;
    endTime: string;
    recordsProcessed: number;
  };
}

export class AnalyticsAgent extends BaseAgent {
  public override metrics: AnalyticsMetrics;

  constructor(config: BaseAgentConfig, dependencies: BaseAgentDependencies) {
    super(config, dependencies);

    // Override the base metrics with our extended analytics metrics
    this.metrics = {
      agentName: 'AnalyticsAgent',
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0,
      totalAnalyzed: 0,
      capperCount: 0,
      totalPicks: 0,
      avgROI: 0,
      avgWinRate: 0,
      streakCount: 0,
      profitableCappers: 0,
      activeStreaks: 0,
      totalProcessed: 0,
      batchesProcessed: 0,
      avgBatchTimeMs: 0,
      throughputPerMinute: 0,
      cacheHitRate: 0,
      lastRunStats: {
        startTime: '',
        endTime: '',
        recordsProcessed: 0,
      },
    };
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing AnalyticsAgent');

    // Verify access to required tables
    const requiredTables = [
      'unified_picks',
      'analytics_summary',
      'roi_by_tier',
      'roi_by_ticket_type',
    ];

    for (const table of requiredTables) {
      try {
        if (!this.hasSupabase()) {
          throw new Error(`Supabase client not available for table ${table}`);
        }

        const { error } = await this.requireSupabase().from(table).select('id').limit(1);

        if (error) {
          throw new Error(`Failed to access table ${table}: ${error.message}`);
        }
      } catch (error) {
        this.logger.error(`Table access check failed for ${table}:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }

    this.logger.info('AnalyticsAgent initialized successfully');
  }

  public async process(): Promise<void> {
    const startTime = Date.now();
    this.metrics.lastRunStats.startTime = new Date().toISOString();
    this.logger.info('🔄 Starting enhanced analytics processing with batch optimization');

    try {
      // Enhanced batch processing approach
      const processingResult = await this.processBatchedAnalytics();

      // Update comprehensive metrics
      this.updateProcessingMetrics(processingResult, Date.now() - startTime);

      this.logger.info('✅ Analytics processing completed', {
        duration: this.metrics?.processingTimeMs,
        processedCappers: processingResult.cappersProcessed,
        batchesProcessed: processingResult.batchesProcessed,
        avgBatchTime: processingResult.avgBatchTimeMs,
        errors: this.metrics?.errorCount,
        throughputPerMinute: processingResult.throughputPerMinute,
      });
    } catch (error) {
      const metrics = this.metrics;
      if (metrics) {
        metrics.errorCount++;
      }
      this.logger.error('❌ Analytics processing failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    this.logger.info('Cleaning up AnalyticsAgent');
    // Cleanup logic here
  }

  public async checkHealth(): Promise<HealthStatus> {
    try {
      if (!this.hasSupabase()) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          details: { error: 'Supabase client not available' },
        };
      }

      // Check database connectivity
      const { error } = await this.requireSupabase().from('unified_picks').select('id').limit(1);

      if (error) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          details: { error: 'Database connectivity check failed: ' + error.message },
        };
      }

      // Check metrics
      const isHealthy =
        (this.metrics?.errorCount || 0) < 10 && (this.metrics?.successCount || 0) > 0;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        details: {
          successCount: this.metrics?.successCount || 0,
          errorCount: this.metrics?.errorCount || 0,
          lastProcessingTime: this.metrics?.processingTimeMs || 0,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: { err: (error as Error).message },
      };
    }
  }

  public async collectMetrics(): Promise<AnalyticsMetrics> {
    this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
    return { ...this.metrics };
  }

  // Remove override since handleCommand is not in BaseAgent
  public async handleCommand(command: any): Promise<void> {
    this.logger.info(`Received command: ${JSON.stringify(command)}`);

    // Example command handler implementation
    if (command.type === 'RUN_ANALYSIS') {
      await this.process();
    }
  }

  private async processBatchedAnalytics(): Promise<{
    cappersProcessed: number;
    batchesProcessed: number;
    avgBatchTimeMs: number;
    throughputPerMinute: number;
    errors: number;
  }> {
    const BATCH_SIZE = 20; // Process 20 cappers per batch
    const MAX_CONCURRENT_BATCHES = 3; // Limit concurrent batches

    // Fetch all cappers with basic info in a single query
    const cappers = await this.fetchCappersForAnalysis();

    if (cappers.length === 0) {
      return {
        cappersProcessed: 0,
        batchesProcessed: 0,
        avgBatchTimeMs: 0,
        throughputPerMinute: 0,
        errors: 0,
      };
    }

    this.logger.info(`📊 Processing ${cappers.length} cappers in batches of ${BATCH_SIZE}`);

    // Create batches
    const batches = this.createBatches(cappers, BATCH_SIZE);
    const batchTimes: number[] = [];
    let totalProcessed = 0;
    let totalErrors = 0;

    // Process batches with controlled concurrency
    for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
      const batchGroup = batches.slice(i, i + MAX_CONCURRENT_BATCHES);

      const batchPromises = batchGroup.map(async (batch, batchIndex) => {
        const batchStartTime = Date.now();
        const actualBatchIndex = i + batchIndex;

        try {
          await this.processBatch(batch, actualBatchIndex);
          const batchTime = Date.now() - batchStartTime;
          batchTimes.push(batchTime);

          this.logger.debug(`✅ Batch ${actualBatchIndex + 1} completed`, {
            batchSize: batch.length,
            processingTimeMs: batchTime,
          });

          return batch.length;
        } catch (error) {
          totalErrors++;
          this.logger.error(`❌ Batch ${actualBatchIndex + 1} failed`, {
            batchSize: batch.length,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return 0;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      totalProcessed += batchResults.reduce((sum, count) => sum + count, 0);

      // Brief pause between batch groups to prevent overwhelming the database
      if (i + MAX_CONCURRENT_BATCHES < batches.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const avgBatchTime =
      batchTimes.length > 0
        ? batchTimes.reduce((sum, time) => sum + time, 0) / batchTimes.length
        : 0;

    const totalTimeMs = batchTimes.reduce((sum, time) => sum + time, 0);
    const throughputPerMinute =
      totalTimeMs > 0 ? Math.round((totalProcessed / totalTimeMs) * 60000) : 0;

    return {
      cappersProcessed: totalProcessed,
      batchesProcessed: batches.length,
      avgBatchTimeMs: avgBatchTime,
      throughputPerMinute,
      errors: totalErrors,
    };
  }

  private async fetchCappersForAnalysis(): Promise<Array<{ id: string; pickCount: number }>> {
    if (!this.hasSupabase()) {
      this.logger.error('⚠️ Supabase client not available for capper fetch');
      return [];
    }

    // Optimized query to get cappers with pick counts
    const { data: capperStats, error } = await this.requireSupabase().rpc(
      'get_capper_analytics_summary'
    ); // Custom RPC function for better performance

    if (error) {
      this.logger.warn('⚠️ RPC function not available, falling back to standard query');

      // Fallback to standard query
      const { data: cappers, error: fallbackError } = await this.requireSupabase()
        .from('unified_picks')
        .select('capper_id')
        .limit(1000);

      if (fallbackError) {
        throw new Error(`Failed to fetch cappers: ${fallbackError.message}`);
      }

      // Get unique cappers and estimate pick counts
      const uniqueCappers = Array.from(new Set(cappers?.map(c => c.capper_id) || []));
      return uniqueCappers.map(id => ({ id, pickCount: 10 })); // Estimated count
    }

    return capperStats || [];
  }

  private async processBatch(
    cappers: Array<{ id: string; pickCount: number }>,
    batchIndex: number
  ): Promise<void> {
    const cappersWithSufficientPicks = cappers.filter(c => c.pickCount >= 5);

    if (cappersWithSufficientPicks.length === 0) {
      this.logger.debug(`📭 Batch ${batchIndex + 1}: No cappers with sufficient picks`);
      return;
    }

    // Fetch all picks for this batch in a single query for better performance
    const capperIds = cappersWithSufficientPicks.map(c => c.id);
    const picksData = await this.fetchPicksForCappers(capperIds);

    // Process each capper's analytics
    const analyticsPromises = cappersWithSufficientPicks.map(async capper => {
      try {
        const picks = picksData.get(capper.id) || [];
        await this.processCapperAnalytics(capper.id, picks);

        this.metrics.successCount++;
        this.metrics.totalProcessed++;
      } catch (error) {
        this.metrics.errorCount++;
        this.logger.error(`❌ Failed to process capper ${capper.id}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          capperId: capper.id,
        });
      }
    });

    await Promise.all(analyticsPromises);
  }

  private async fetchPicksForCappers(capperIds: string[]): Promise<Map<string, any[]>> {
    if (!this.hasSupabase() || capperIds.length === 0) {
      return new Map();
    }

    const { data: picks, error } = await this.requireSupabase()
      .from('unified_picks')
      .select('*')
      .in('capper_id', capperIds)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch picks for batch: ${error.message}`);
    }

    // Group picks by capper_id
    const picksMap = new Map<string, any[]>();
    picks?.forEach(pick => {
      const capperId = pick.capper_id;
      if (!picksMap.has(capperId)) {
        picksMap.set(capperId, []);
      }
      picksMap.get(capperId)!.push(pick);
    });

    return picksMap;
  }

  private async processCapperAnalytics(capperId: string, picks: any[]): Promise<void> {
    this.logger.debug(`📈 Processing analytics for capper ${capperId}`);

    if (picks.length < 5) {
      this.logger.debug('⚠️ Insufficient picks for analysis', {
        capperId,
        pickCount: picks.length,
        required: 5,
      });
      return;
    }

    // Calculate comprehensive analytics
    const analytics = this.calculateAdvancedAnalytics(picks);

    // Update global metrics
    if (analytics.roi > 0) {
      this.metrics.profitableCappers++;
    }

    // Store analytics summary with enhanced data
    await this.storeAnalyticsSummary(capperId, {
      total_picks: picks.length,
      wins: analytics.wins,
      losses: analytics.losses,
      pushes: analytics.pushes,
      win_rate: analytics.winRate,
      roi: analytics.roi,
      avg_odds: analytics.avgOdds,
      profit_loss: analytics.profitLoss,
      max_streak: analytics.maxWinStreak,
      current_streak: analytics.currentStreak,
      volatility: analytics.volatility,
      sharpe_ratio: analytics.sharpeRatio,
      tier_distribution: analytics.tierDistribution,
      analyzed_at: new Date().toISOString(),
      last_activity: analytics.lastActivity,
    });

    this.logger.debug('✅ Capper analytics processed successfully', {
      capperId,
      pickCount: picks.length,
      winRate: Math.round(analytics.winRate * 100) / 100,
      roi: Math.round(analytics.roi * 100) / 100,
      profitLoss: Math.round(analytics.profitLoss * 100) / 100,
    });
  }

  private calculateAdvancedAnalytics(picks: any[]): {
    wins: number;
    losses: number;
    pushes: number;
    winRate: number;
    roi: number;
    avgOdds: number;
    profitLoss: number;
    maxWinStreak: number;
    currentStreak: number;
    volatility: number;
    sharpeRatio: number;
    tierDistribution: Record<string, number>;
    lastActivity: string;
  } {
    const wins = picks.filter(p => p.result === 'win').length;
    const losses = picks.filter(p => p.result === 'loss').length;
    const pushes = picks.filter(p => p.result === 'push').length;
    const winRate = wins + losses > 0 ? wins / (wins + losses) : 0;

    // ROI calculation
    const roi = this.calculateROI(picks);

    // Average odds
    const avgOdds = picks.reduce((sum, pick) => sum + (pick.odds || 100), 0) / picks.length;

    // Profit/Loss calculation
    let profitLoss = 0;
    picks.forEach(pick => {
      const stake = pick.stake || 100;
      if (pick.result === 'win') {
        const odds = pick.odds || 100;
        const payout = odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds));
        profitLoss += payout;
      } else if (pick.result === 'loss') {
        profitLoss -= stake;
      }
    });

    // Streak calculations
    let maxWinStreak = 0;
    let currentStreak = 0;
    let tempStreak = 0;

    picks.forEach((pick, index) => {
      if (pick.result === 'win') {
        tempStreak++;
        maxWinStreak = Math.max(maxWinStreak, tempStreak);
      } else {
        tempStreak = 0;
      }

      // Current streak (from most recent)
      if (index === picks.length - 1) {
        let i = picks.length - 1;
        while (i >= 0 && picks[i].result === 'win') {
          currentStreak++;
          i--;
        }
      }
    });

    // Volatility (standard deviation of returns)
    const returns = picks.map(pick => {
      // const _stake = pick.stake || 100; // Unused variable removed
      if (pick.result === 'win') {
        const odds = pick.odds || 100;
        return odds > 0 ? odds / 100 : 100 / Math.abs(odds);
      }
      return -1;
    });

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Sharpe ratio (risk-adjusted returns)
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

    // Tier distribution
    const tierDistribution: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    picks.forEach(pick => {
      const tier = pick.tier || 'C';
      tierDistribution[tier] = (tierDistribution[tier] || 0) + 1;
    });

    // Last activity
    const lastActivity =
      picks.length > 0 ? picks[picks.length - 1].created_at : new Date().toISOString();

    return {
      wins,
      losses,
      pushes,
      winRate,
      roi,
      avgOdds,
      profitLoss,
      maxWinStreak,
      currentStreak,
      volatility,
      sharpeRatio,
      tierDistribution,
      lastActivity,
    };
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private updateProcessingMetrics(result: any, processingTimeMs: number): void {
    this.metrics.lastRunStats.endTime = new Date().toISOString();
    this.metrics.processingTimeMs = processingTimeMs;
    this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
    this.metrics.capperCount = result.cappersProcessed;
    this.metrics.lastRunStats.recordsProcessed = result.cappersProcessed;
  }

  private calculateROI(picks: any[]): number {
    let totalStake = 0;
    let totalReturn = 0;

    for (const pick of picks) {
      const stake = pick.stake || 100; // Default stake
      totalStake += stake;

      if (pick.result === 'win') {
        const odds = pick.odds || 1.9; // Default odds
        totalReturn += stake * odds;
      }
    }

    return totalStake > 0 ? ((totalReturn - totalStake) / totalStake) * 100 : 0;
  }

  private async storeAnalyticsSummary(capperId: string, summary: any): Promise<void> {
    try {
      if (!this.hasSupabase()) {
        this.logger.error('Supabase client not available for storing analytics summary');
        return;
      }

      const { error } = await this.requireSupabase()
        .from('analytics_summary')
        .upsert({
          capper_id: capperId,
          ...summary,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw new Error(`Failed to store analytics summary: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to store analytics summary', {
        err: error instanceof Error ? error.message : 'Unknown error',
        capperId,
      });
      throw error;
    }
  }

  // Public test methods
  public async __test__initialize(): Promise<void> {
    return this.initialize();
  }

  public async __test__collectMetrics(): Promise<AnalyticsMetrics> {
    return this.collectMetrics();
  }

  public async __test__checkHealth(): Promise<HealthStatus> {
    return this.checkHealth();
  }
}

// Export the config type for external use
export type { AnalyticsAgentConfig } from './types';
