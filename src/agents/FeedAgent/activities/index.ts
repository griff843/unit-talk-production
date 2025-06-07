import { proxyActivities } from '@temporalio/workflow';
import { BaseAgent } from '../../BaseAgent';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import {
  FeedAgentConfig,
  FeedAgentConfigSchema,
  Provider,
  FeedMetrics,
  FetchResult,
  ProcessedResult,
  AgentCommand,
  HealthCheckResult,
  Metrics
} from '../types';
import { BaseAgentDependencies } from '../BaseAgent/types';
import { RawProp } from '../../../types/rawProps';
import { normalizePublicProps } from '../utils/normalizePublicProps';
import { dedupePublicProps } from '../utils/dedupePublicProps';
import { fetchFromProviderActivity } from './fetchFromProvider';

// Add all supported providers here
const SUPPORTED_PROVIDERS: Provider[] = ['SportsGameOdds', 'OddsAPI', 'Pinnacle'];

function createProviderStats(): FeedMetrics['providerStats'] {
  const stats: FeedMetrics['providerStats'] = {
    SportsGameOdds: { success: 0, failed: 0, avgLatencyMs: 0 },
    OddsAPI: { success: 0, failed: 0, avgLatencyMs: 0 },
    Pinnacle: { success: 0, failed: 0, avgLatencyMs: 0 }
  };
  return stats;
}

const activities = proxyActivities({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
  }
});

export class FeedAgent extends BaseAgent {
  private feedMetrics: FeedMetrics = {
    totalProps: 0,
    uniqueProps: 0,
    duplicates: 0,
    errors: 0,
    latencyMs: 0,
    providerStats: createProviderStats(),
  };

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    // Initialize agent-specific properties here
  }

  protected async initialize(): Promise<void> {
    await this.validateDependencies();
    await this.initializeResources();
  }

  protected async cleanup(): Promise<void> {
    // No cleanup needed
  }

  protected async checkHealth(): Promise<HealthCheckResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [provider, stats] of Object.entries(this.feedMetrics.providerStats)) {
      const errorRate = (stats.success + stats.failed) === 0 ? 0 : stats.failed / (stats.success + stats.failed);
      if (errorRate > 0.1) {
        errors.push(`High error rate for ${provider}: ${(errorRate * 100).toFixed(1)}%`);
      }
    }

    return {
      status: errors.length === 0 ? 'healthy' : (errors.length > 2 ? 'unhealthy' : 'degraded'),
      details: {
        errors,
        warnings,
        info: {
          metrics: this.feedMetrics
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  protected async collectMetrics(): Promise<Metrics> {
    return {
      errorCount: this.feedMetrics.errors,
      warningCount: Object.values(this.feedMetrics.providerStats)
        .filter(stats => stats.failed > 0).length,
      successCount: Object.values(this.feedMetrics.providerStats)
        .reduce((sum, stats) => sum + stats.success, 0),
      ...this.feedMetrics
    };
  }

  public async handleCommand(command: AgentCommand): Promise<void> {
    switch (command.type) {
      case 'FETCH_FEED':
        await this.startProviderIngestion(command.payload.provider);
        break;
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }
  }

  protected async validateDependencies(): Promise<void> {
    const config = this.config as FeedAgentConfig;
    for (const [provider, settings] of Object.entries(config.providers)) {
      if (!settings?.apiKey || !settings?.baseUrl) {
        throw new Error(`Invalid configuration for provider ${provider}`);
      }
    }
    const { error } = await this.supabase.from('raw_props').select('id').limit(1);
    if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  }

  protected async initializeResources(): Promise<void> {
    // Initialize/refresh any resources needed
    // Optionally log or run one-off hooks
  }

  protected async startProcessing(): Promise<void> {
    const config = this.config as FeedAgentConfig;
    for (const [provider, settings] of Object.entries(config.providers)) {
      if (settings?.enabled) {
        await this.startProviderIngestion(provider as Provider);
      }
    }
  }

  protected async stopProcessing(): Promise<void> {
    // No cleanup needed here
  }

  private async startProviderIngestion(provider: Provider): Promise<void> {
    const config = this.config as FeedAgentConfig;
    const settings = config.providers[provider];

    if (!settings) {
      throw new Error(`Provider ${provider} not configured`);
    }

    try {
      const rawResult: FetchResult = await fetchFromProviderActivity({
        provider,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        timestamp: new Date().toISOString()
      });

      if (!rawResult.success || !rawResult.data) {
        this.feedMetrics.providerStats[provider].failed++;
        throw new Error(`Failed to fetch from ${provider}: ${rawResult.error}`);
      }

      this.feedMetrics.providerStats[provider].success++;
      this.feedMetrics.providerStats[provider].avgLatencyMs =
        (this.feedMetrics.providerStats[provider].avgLatencyMs + rawResult.latencyMs) / 2;

      // Normalize, dedupe, and process props
      const normalized = await normalizePublicProps(rawResult.data, provider, true, this.supabase);
      const deduped = await dedupePublicProps(normalized, provider, this.supabase);

      const processed = await this.processProps(deduped);

      this.feedMetrics.totalProps += deduped.length;
      this.feedMetrics.uniqueProps += processed.inserted;
      this.feedMetrics.duplicates += processed.duplicates;
      this.feedMetrics.errors += processed.errors;

      this.logger.info('Provider ingestion completed', {
        provider,
        stats: processed,
        timestamp: rawResult.timestamp
      });

    } catch (error) {
      this.feedMetrics.providerStats[provider].failed++;
      await this.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
        context: `${provider} ingestion`,
        severity: 'high'
      });
    }
  }

  private async processProps(props: RawProp[]): Promise<ProcessedResult> {
    const result: ProcessedResult = {
      inserted: 0,
      duplicates: 0,
      errors: 0,
      details: {
        newExternalIds: [],
        duplicateExternalIds: [],
        errorMessages: []
      }
    };

    // Get existing external_ids for deduplication
    const externalIds = props.map(p => p.external_id).filter((id): id is string => id !== undefined);
    if (externalIds.length === 0) {
      return result;
    }

    const { data: existing, error } = await this.supabase
      .from('raw_props')
      .select('external_id')
      .in('external_id', externalIds);

    const existingIds = new Set(existing?.map(e => e.external_id) || []);

    for (const prop of props) {
      try {
        if (prop.external_id && existingIds.has(prop.external_id)) {
          result.duplicates++;
          result.details.duplicateExternalIds.push(prop.external_id);
          continue;
        }

        const { error } = await this.supabase.from('raw_props').insert(prop);

        if (error) {
          result.errors++;
          result.details.errorMessages.push(
            `Failed to insert prop ${prop.external_id || 'unknown'}: ${error.message}`
          );
        } else {
          result.inserted++;
          if (prop.external_id) {
            result.details.newExternalIds.push(prop.external_id);
          }
        }
      } catch (error) {
        result.errors++;
        result.details.errorMessages.push(
          `Error processing prop ${prop.external_id || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return result;
  }

  private transformProps(data: RawProp[], provider: Provider): RawProp[] {
    return data.map(odd => {
      // Required fields
      const id = crypto.randomUUID();
      const playerName = odd.player_name || '';
      const statType = odd.stat_type || '';
      const line = odd.line || 0;

      // Optional fields with defaults
      const externalId = odd.external_id || crypto.randomUUID();
      const team = odd.team || '';
      const opponent = odd.opponent || '';
      const overOdds = odd.over_odds || 0;
      const underOdds = odd.under_odds || 0;
      const market = odd.market || '';
      const gameTime = odd.game_time || new Date().toISOString();
      const scrapedAt = odd.scraped_at || new Date().toISOString();

      return {
        id,
        external_id: externalId,
        player_name: playerName,
        team,
        opponent,
        stat_type: statType,
        line,
        over_odds: overOdds,
        under_odds: underOdds,
        market,
        provider,
        game_time: gameTime,
        scraped_at: scrapedAt,
        is_valid: true
      };
    });
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }
}