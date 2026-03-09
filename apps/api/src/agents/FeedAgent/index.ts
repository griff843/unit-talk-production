import { createBaseAgentConfig } from '../BaseAgent/config';
import { BaseAgent } from '../BaseAgent/index';
import {
  BaseAgentConfig,
  BaseAgentDependencies,
  HealthStatus,
  BaseMetrics,
} from '../BaseAgent/types';
// SPRINT-044Q: compatInsertRawProp removed — raw_props writes were orphaned (no production reader)

import { FeedAgentConfigSchema, FeedAgentConfig, FeedMetrics, RawProp } from './types';
import { normalizePublicProps } from './utils';

/**
 * Create a proper FeedAgent configuration that extends BaseAgentConfig
 */
function createFeedAgentConfig(config: any): BaseAgentConfig & { feedConfig?: FeedAgentConfig } {
  // Create base config first
  const baseConfig = createBaseAgentConfig(config);

  // Try to parse feed-specific config, but don't fail if it's incomplete
  let feedConfig: FeedAgentConfig | undefined;
  try {
    feedConfig = FeedAgentConfigSchema.parse(config);
  } catch (error) {
    // If feed config validation fails, create a minimal valid config
    feedConfig = {
      name: config.name || 'FeedAgent',
      enabled: config.enabled ?? true,
      version: config.version || '1.0.0',
      logLevel: config.logLevel || 'info',
      metrics: { enabled: true },
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000,
      },
      providers: config.providers || {},
      dedupeConfig: {
        checkInterval: 300,
        ttlHours: 24,
      },
    };
  }

  return { ...baseConfig, feedConfig };
}

/**
 * FeedAgent handles fetching, normalizing, and processing raw sports betting props
 * from various data providers.
 */
export class FeedAgent extends BaseAgent {
  private feedMetrics: FeedMetrics;
  private fullConfig: FeedAgentConfig;

  constructor(config: BaseAgentConfig | any, deps: BaseAgentDependencies) {
    // Create a proper configuration that works with BaseAgent
    const enhancedConfig = createFeedAgentConfig(config);
    super(enhancedConfig, deps);

    // Use the feed-specific config if available, otherwise create defaults
    this.fullConfig = enhancedConfig.feedConfig || {
      name: enhancedConfig.name,
      enabled: enhancedConfig.enabled || true,
      version: enhancedConfig.version || '1.0.0',
      logLevel: 'info',
      metrics: { enabled: true },
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000,
      },
      providers: {},
      dedupeConfig: {
        checkInterval: 300,
        ttlHours: 24,
      },
    };

    this.feedMetrics = {
      totalProps: 0,
      uniqueProps: 0,
      duplicates: 0,
      errors: 0,
      latencyMs: 0,
      providerStats: {
        SportsGameOdds: { success: 0, failed: 0, avgLatencyMs: 0 },
        OddsAPI: { success: 0, failed: 0, avgLatencyMs: 0 },
        Pinnacle: { success: 0, failed: 0, avgLatencyMs: 0 },
        Optimal: { success: 0, failed: 0, avgLatencyMs: 0 },
      },
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🚀 Initializing FeedAgent...');
    await this.validateDependencies();
  }

  protected async process(): Promise<void> {
    this.logger.info('🔄 Processing feed data...');

    try {
      // Process each configured provider
      for (const [_providerName, provider] of Object.entries(this.fullConfig.providers)) {
        if (provider.enabled) {
          await this.startProviderIngestion(provider);
        }
      }
    } catch (error) {
      this.logger.error('Failed to process feed data', {
        err: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 FeedAgent cleanup completed');
  }

  public async checkHealth(): Promise<HealthStatus> {
    try {
      const errorRate = this.feedMetrics.errors / Math.max(this.feedMetrics.totalProps, 1);
      const status = errorRate > 0.1 ? 'unhealthy' : errorRate > 0.05 ? 'degraded' : 'healthy';

      return {
        status,
        timestamp: new Date().toISOString(),
        details: {
          errorRate,
          metrics: this.feedMetrics,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          err: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  public async collectMetrics(): Promise<BaseMetrics> {
    return {
      agentName: this.fullConfig.name,
      successCount: this.feedMetrics.totalProps - this.feedMetrics.errors,
      errorCount: this.feedMetrics.errors,
      warningCount: this.feedMetrics.duplicates,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
    };
  }

  private async validateDependencies(): Promise<void> {
    // Check database connectivity
    if (!this.supabase) {
      throw new Error('Supabase client is required for FeedAgent');
    }
    const { error } = await this.supabase.from('provider_offers').select('id').limit(1);

    if (error) {
      throw new Error(`Database connectivity check failed: ${error.message}`);
    }
  }

  private async startProviderIngestion(provider: any): Promise<void> {
    try {
      this.logger.info(`Starting ingestion for provider: ${provider.name}`);

      // Fetch data from provider
      const rawData = await this.fetchFromProvider(provider);

      // Ensure supabase is available
      if (!this.supabase) {
        throw new Error('Supabase client is required for FeedAgent');
      }

      // Normalize the data
      const normalizedData = await normalizePublicProps(rawData, provider, true, this.supabase);

      // SPRINT-046: dedupePublicProps removed — was deduplicating against deprecated raw_props

      // Transform to RawProp objects
      const rawProps = this.transformProps(normalizedData, provider);

      // Process the props
      await this.processProps(rawProps);
    } catch (error) {
      this.logger.error(`Provider ingestion failed: ${provider.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      this.feedMetrics.errors++;
      throw error;
    }
  }

  private async fetchFromProvider(provider: any): Promise<any[]> {
    const startTime = Date.now();

    try {
      this.logger.info(`🌐 Fetching real data using unified data source router`);

      // Import the unified data source router
      const { fetchUnifiedData } = await import('./dataSourceRouter');

      // Get today's date for filtering
      const today = new Date().toISOString().split('T')[0];

      // Fetch props for all supported sports using smart routing
      const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF'];
      const allProps = [];

      for (const sport of sports) {
        try {
          this.logger.info(`🏀 Fetching ${sport} props using smart routing`);

          // Use unified data router to automatically select best API
          const result = await fetchUnifiedData({
            sport,
            marketType: 'player-props',
            date: today,
          });

          this.logger.info(
            `📊 ${sport}: ${result.data.length} props from ${result.source} (${result.metadata.processingTimeMs}ms)`
          );

          // Add source metadata to props
          const sourceProps = result.data.map(prop => ({
            ...prop,
            source: result.source,
            fetched_via: 'unified-router',
          }));

          allProps.push(...sourceProps);

          // Update provider stats based on source used
          if (result.source === 'optimal-api') {
            this.feedMetrics.providerStats.Optimal.success++;
            this.feedMetrics.providerStats.Optimal.avgLatencyMs = result.metadata.processingTimeMs;
          } else if (result.source === 'odds-api') {
            this.feedMetrics.providerStats.OddsAPI.success++;
            this.feedMetrics.providerStats.OddsAPI.avgLatencyMs = result.metadata.processingTimeMs;
          }

          // Log any errors from the unified system
          if (result.metadata.errors.length > 0) {
            this.logger.warn(`⚠️ ${sport} fetch had errors:`, result.metadata.errors);
          }

          // Small delay between sports
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          this.logger.error(`❌ Failed to fetch ${sport} props`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          this.feedMetrics.errors++;
        }
      }

      const duration = Date.now() - startTime;

      this.logger.info(
        `✅ Fetched ${allProps.length} total props using unified routing in ${duration}ms`
      );
      return allProps;
    } catch (error) {
      this.logger.error(`❌ Unified data fetch failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  private async processProps(props: RawProp[]): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase client is required for FeedAgent');
    }

    // SPRINT-044Q: raw_props writes removed — orphaned after GRADING_DATA_SOURCE flip (044P)
    // FeedAgent ingestion now only writes to provider_offers via V3 path
    for (const prop of props) {
      this.feedMetrics.totalProps++;
      this.feedMetrics.uniqueProps++;
    }
  }

  private transformProps(data: any[], provider: any): RawProp[] {
    return data.map(item => ({
      id: crypto.randomUUID(),
      player_name: item.player_name || '',
      team: item.team || '',
      opponent: item.opponent || '',
      market: item.market || item.stat_type || '',
      line: parseFloat(item.line) || 0,
      over: parseFloat(item.over_odds) || 0,
      under: parseFloat(item.under_odds) || 0,
      market_type: item.market_type || 'player_prop',
      game_time: item.game_time || new Date().toISOString(),
      // Additional properties for flexibility
      external_id: item.external_id,
      external_game_id: item.external_game_id,
      provider: provider.name,
      scraped_at: new Date().toISOString(),
      sport: item.sport,
      sport_key: item.sport_key,
      matchup: item.matchup,
    }));
  }
}

// Export Optimal integration
export { fetchOptimalProps, getRateLimitStatus } from './optimal';
