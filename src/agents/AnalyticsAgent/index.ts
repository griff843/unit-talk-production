import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types/index';

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
  lastRunStats: {
    startTime: string;
    endTime: string;
    recordsProcessed: number;
  };
}

export class AnalyticsAgent extends BaseAgent {
  public config: BaseAgentConfig;
  public metrics: AnalyticsMetrics;

  constructor(config: BaseAgentConfig, dependencies: BaseAgentDependencies) {
    super(config, dependencies);
    this.config = config;

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
      lastRunStats: {
        startTime: '',
        endTime: '',
        recordsProcessed: 0
      }
    };
  }

  public async initialize(): Promise<void> {
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
        const { error } = await this.supabase
          .from(table)
          .select('id')
          .limit(1);

        if (error) {
          throw new Error(`Failed to access table ${table}: ${error.message}`);
        }
      } catch (error) {
        this.logger.error(`Table access check failed for ${table}:`, error as Error);
        throw error;
      }
    }

    this.logger.info('AnalyticsAgent initialized successfully');
  }

  public async process(): Promise<void> {
    const startTime = Date.now();
    this.metrics.lastRunStats.startTime = new Date().toISOString();
    this.logger.info('Starting analytics processing');

    try {
      // Get all cappers with picks - using proper Supabase query
      const { data: cappers, error: capperError } = await this.supabase
        .from('final_picks')
        .select('capper_id')
        .limit(1000); // Add limit to avoid issues

      if (capperError) {
        throw new Error(`Failed to fetch cappers: ${capperError.message}`);
      }

      // Get unique cappers
      const uniqueCappers = Array.from(new Set(cappers?.map(c => c.capper_id) || []));
      this.metrics.capperCount = uniqueCappers.length;
      this.logger.info(`Found ${this.metrics.capperCount} cappers to analyze`);

      // Process each capper
      for (const capperId of uniqueCappers) {
        try {
          await this.processCapperAnalytics(capperId);
          this.metrics.successCount++;
          this.metrics.totalProcessed++;
        } catch (error) {
          this.metrics.errorCount++;
          this.logger.error(
            `Failed to process capper ${capperId}:`,
            error as Error,
            { capperId }
          );
        }
      }

      this.metrics.lastRunStats.endTime = new Date().toISOString();
      this.metrics.processingTimeMs = Date.now() - startTime;
      this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
      this.metrics.lastRunStats.recordsProcessed = this.metrics.totalProcessed;

      this.logger.info('Analytics processing completed', {
        duration: this.metrics.processingTimeMs,
        processedCappers: this.metrics.successCount,
        errors: this.metrics.errorCount
      });

    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error('Analytics processing failed:', error as Error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    this.logger.info('Cleaning up AnalyticsAgent');
    // Cleanup logic here
  }

  public async checkHealth(): Promise<HealthStatus> {
    try {
      // Check database connectivity
      const { error } = await this.supabase
        .from('final_picks')
        .select('id')
        .limit(1);

      if (error) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          details: { error: error.message },
          error: 'Database connectivity check failed'
        };
      }

      // Check metrics
      const isHealthy = this.metrics.errorCount < 10 &&
                       this.metrics.successCount > 0;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        details: {
          successCount: this.metrics.successCount,
          errorCount: this.metrics.errorCount,
          lastProcessingTime: this.metrics.processingTimeMs
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {},
        error: (error as Error).message
      };
    }
  }

  public async collectMetrics(): Promise<AnalyticsMetrics> {
    this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
    return { ...this.metrics };
  }

  public async handleCommand(command: any): Promise<void> {
    this.logger.info(`Received command: ${JSON.stringify(command)}`);

    // Example command handler implementation
    if (command.type === 'RUN_ANALYSIS') {
      await this.process();
    }
  }

  private async processCapperAnalytics(capperId: string): Promise<void> {
    this.logger.debug(`Processing analytics for capper ${capperId}`);

    try {
      // Fetch picks for this capper
      const { data: picks, error } = await this.supabase
        .from('final_picks')
        .select('*')
        .eq('capper_id', capperId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch picks: ${error.message}`);
      }

      if (!picks || picks.length < 5) { // Use hardcoded minimum for now
        this.logger.debug('Insufficient picks for analysis', {
          pickCount: picks?.length,
          required: 5
        });
        return;
      }

      // Calculate basic analytics
      const wins = picks.filter(p => p.result === 'win').length;
      const losses = picks.filter(p => p.result === 'loss').length;
      const winRate = wins / (wins + losses);
      const roi = this.calculateROI(picks);

      // Update metrics
      if (roi > 0) {
        this.metrics.profitableCappers++;
      }

      // Store analytics summary
      await this.storeAnalyticsSummary(capperId, {
        total_picks: picks.length,
        wins,
        losses,
        win_rate: winRate,
        roi,
        analyzed_at: new Date().toISOString()
      });

      this.logger.debug('Capper analytics processed successfully', {
        capperId,
        pickCount: picks.length,
        winRate,
        roi
      });

    } catch (error) {
      this.logger.error('Failed to process capper analytics', error as Error);
      throw error;
    }
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
      const { error } = await this.supabase
        .from('analytics_summary')
        .upsert({
          capper_id: capperId,
          ...summary,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to store analytics summary: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to store analytics summary', error as Error);
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