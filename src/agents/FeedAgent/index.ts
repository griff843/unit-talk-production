import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { createBaseAgentConfig } from '../BaseAgent/config';
import { FeedAgentConfigSchema, FeedAgentConfig, FeedMetrics, RawProp } from './types';
import { normalizePublicProps, dedupePublicProps } from './utils';

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
        maxBackoffMs: 30000
      },
      providers: config.providers || {},
      dedupeConfig: {
        checkInterval: 300,
        ttlHours: 24
      }
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
        maxBackoffMs: 30000
      },
      providers: {},
      dedupeConfig: {
        checkInterval: 300,
        ttlHours: 24
      }
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
        Pinnacle: { success: 0, failed: 0, avgLatencyMs: 0 }
      }
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
        error: error instanceof Error ? error.message : String(error)
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
          metrics: this.feedMetrics
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
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
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  private async validateDependencies(): Promise<void> {
    // Check database connectivity
    const { error } = await this.supabase
      .from('raw_props')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Database connectivity check failed: ${error.message}`);
    }
  }

  private async startProviderIngestion(provider: any): Promise<void> {
    try {
      this.logger.info(`Starting ingestion for provider: ${provider.name}`);

      // Fetch data from provider
      const rawData = await this.fetchFromProvider(provider);

      // Normalize the data
      const normalizedData = await normalizePublicProps(rawData, provider, true, this.supabase);

      // Deduplicate the data
      const deduplicatedData = await dedupePublicProps(normalizedData, provider, this.supabase);

      // Transform to RawProp objects
      const rawProps = this.transformProps(deduplicatedData, provider);

      // Process the props
      await this.processProps(rawProps);

    } catch (error) {
      this.logger.error(`Provider ingestion failed: ${provider.name}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      this.feedMetrics.errors++;
      throw error;
    }
  }

  private async fetchFromProvider(_provider: any): Promise<any[]> {
    // Mock implementation - would use actual provider API
    return [];
  }

  private async processProps(props: RawProp[]): Promise<void> {
    for (const prop of props) {
      try {
        // Insert into database
        const { error } = await this.supabase
          .from('raw_props')
          .insert(prop);

        if (error) {
          if (error.code === '23505') { // Duplicate key error
            this.feedMetrics.duplicates++;
          } else {
            throw error;
          }
        } else {
          this.feedMetrics.uniqueProps++;
        }

        this.feedMetrics.totalProps++;

      } catch (error) {
        this.logger.error('Failed to process prop', {
          error: error instanceof Error ? error.message : String(error),
          prop: prop
        });
        this.feedMetrics.errors++;
      }
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
      matchup: item.matchup
    }));
  }
}