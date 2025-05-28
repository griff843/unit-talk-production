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

const activities = proxyActivities({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
  }
});

export class FeedAgent extends BaseAgent {
  private metrics: FeedMetrics = {
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

  constructor(
    config: FeedAgentConfig,
    supabase: SupabaseClient,
    errorConfig: ErrorHandlerConfig
  ) {
    super('FeedAgent', config, supabase, errorConfig);
    FeedConfigSchema.parse(config);
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
    await this.metrics.initialize?.();
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

  protected async checkHealth(): Promise<HealthStatus> {
    const errors = [];
    for (const [provider, stats] of Object.entries(this.metrics.providerStats)) {
      const errorRate = stats.failed / (stats.success + stats.failed);
      if (errorRate > 0.1) {
        errors.push(`High error rate for ${provider}: ${(errorRate * 100).toFixed(1)}%`);
      }
    }
    return {
      status: errors.length === 0 ? 'ok' : 'warn',
      details: {
        errors,
        metrics: this.metrics
      }
    };
  }

  protected async collectMetrics(): Promise<FeedMetrics> {
    return this.metrics;
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
        this.metrics.providerStats[provider].failed++;
        throw new Error(`Failed to fetch from ${provider}: ${rawResult.error}`);
      }

      this.metrics.providerStats[provider].success++;
      this.metrics.providerStats[provider].avgLatencyMs =
        (this.metrics.providerStats[provider].avgLatencyMs + rawResult.latencyMs) / 2;

      const normalized = await normalizePublicProps(rawResult.data);
      const deduped = await dedupePublicProps(normalized);
      const props = this.transformProps(deduped, provider);

      const processed = await this.processProps(props);

      this.metrics.totalProps += props.length;
      this.metrics.uniqueProps += processed.inserted;
      this.metrics.duplicates += processed.duplicates;
      this.metrics.errors += processed.errors;

      this.logger.info('Provider ingestion completed', {
        provider,
        stats: processed,
        timestamp: rawResult.timestamp
      });

    } catch (error) {
      this.metrics.providerStats[provider].failed++;
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
