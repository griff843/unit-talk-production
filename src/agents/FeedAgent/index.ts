import { proxyActivities } from '@temporalio/workflow';
import { BaseAgent } from '../BaseAgent';
import { SupabaseClient } from '@supabase/supabase-js';
import { ErrorHandlerConfig } from '../../utils/errorHandling';
import { Logger } from '../../utils/logger';
import { 
  FeedAgentConfig,
  FeedConfigSchema,
  Provider,
  FeedMetrics,
  FetchResult,
  ProcessedResult
} from './types';
import { RawProp } from '../../types/rawProps';
import { normalizePublicProps } from './utils/normalizePublicProps';
import { dedupePublicProps } from './utils/dedupePublicProps';
import { fetchFromProviderActivity } from './activities/fetchFromProvider';
import { BaseAgentDependencies } from '../BaseAgentDependencies';

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
    providerStats: {
      SportsGameOdds: {
        success: 0,
        failed: 0,
        avgLatencyMs: 0
      }
    }
  };

  constructor(dependencies: BaseAgentDependencies) {
    super(dependencies);
    FeedConfigSchema.parse(dependencies.config);
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
      const errorRate = stats.failed / (stats.success + stats.failed);
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
      if (!settings.apiKey || !settings.baseUrl) {
        throw new Error(`Invalid configuration for provider ${provider}`);
      }
    }
    const { error } = await this.supabase.from('raw_props').select('id').limit(1);
    if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  }

  protected async initializeResources(): Promise<void> {
    await this.feedMetrics.initialize?.();
  }

  protected async startProcessing(): Promise<void> {
    const config = this.config as FeedAgentConfig;
    for (const [provider, settings] of Object.entries(config.providers)) {
      if (settings.enabled) {
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

    try {
      const rawResult = await fetchFromProviderActivity({
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

      const normalized = await normalizePublicProps(rawResult.data);
      const deduped = await dedupePublicProps(normalized);
      const props = this.transformProps(deduped, provider);

      const processed = await this.processProps(props);

      this.feedMetrics.totalProps += props.length;
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
      await this.handleError(error, `${provider} ingestion`);
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

    const { data: existing } = await this.supabase
      .from('raw_props')
      .select('external_id')
      .in('external_id', props.map(p => p.external_id));

    const existingIds = new Set(existing?.map(e => e.external_id));

    for (const prop of props) {
      try {
        if (existingIds.has(prop.external_id)) {
          result.duplicates++;
          result.details.duplicateExternalIds.push(prop.external_id);
          continue;
        }

        const { error } = await this.supabase.from('raw_props').insert(prop);

        if (error) {
          result.errors++;
          result.details.errorMessages.push(
            `Failed to insert prop ${prop.external_id}: ${error.message}`
          );
        } else {
          result.inserted++;
          result.details.newExternalIds.push(prop.external_id);
        }
      } catch (error) {
        result.errors++;
        result.details.errorMessages.push(
          `Error processing prop ${prop.external_id}: ${error.message}`
        );
      }
    }

    return result;
  }

  private transformProps(data: any[], provider: Provider): RawProp[] {
    return data.map(odd => ({
      id: crypto.randomUUID(),
      external_id: odd.external_id,
      player_name: odd.player_name,
      team: odd.team_name,
      opponent: odd.opponent,
      stat_type: odd.market_type,
      line: odd.line,
      over_odds: odd.over,
      under_odds: odd.under,
      market: odd.market_type,
      provider,
      game_time: odd.game_time,
      scraped_at: new Date().toISOString(),
      is_valid: true
    }));
  }
}
