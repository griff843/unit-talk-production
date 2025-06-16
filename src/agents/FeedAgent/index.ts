import { proxyActivities } from '@temporalio/workflow';
import { BaseAgent } from '../BaseAgent/index';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '../../utils/logger';
import type { ErrorHandler } from '../../utils/errorHandling';
import {
  FeedAgentConfig,
  FeedAgentConfigSchema,
  Provider,
  FeedMetrics,
  FetchResult,
  ProcessedResult,
  HealthCheckResult,
  AgentCommand,
  Metrics
} from './types';
import { RawProp } from '../../types/rawProps';
import { normalizePublicProps } from './utils/normalizePublicProps';
import { dedupePublicProps } from './utils/dedupePublicProps';
import { fetchFromProviderActivity, FetchProviderInput } from './activities/fetchFromProvider';
import { BaseAgentDependencies, BaseAgentConfig, AgentStatus } from '../BaseAgent/types';

const SUPPORTED_PROVIDERS: Provider[] = ['SportsGameOdds', 'OddsAPI', 'Pinnacle'];

function createProviderStats(): FeedMetrics['providerStats'] {
  return {
    SportsGameOdds: { success: 0, failed: 0, avgLatencyMs: 0 },
    OddsAPI: { success: 0, failed: 0, avgLatencyMs: 0 },
    Pinnacle: { success: 0, failed: 0, avgLatencyMs: 0 }
  };
}

const activities = proxyActivities<{
  fetchFromProviderActivity: (input: FetchProviderInput) => Promise<FetchResult>;
}>({
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
    providerStats: createProviderStats()
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

    // Use new AgentStatus type
    let status: AgentStatus = 'healthy';
    if (errors.length > 2) status = 'unhealthy';
    else if (errors.length > 0) status = 'degraded';

    return {
      status,
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
        await this.startProviderIngestion(command.payload.provider as Provider);
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
    // .from().select().limit() for all supabase test mocks
    const { error } = await this.supabase.from('raw_props').select('id').limit(1);
    if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  }

  protected async initializeResources(): Promise<void> {
    // Initialize/refresh any resources needed
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
    // No cleanup needed
  }

  private async startProviderIngestion(provider: Provider): Promise<void> {
    const config = this.config as FeedAgentConfig;
    const settings = config.providers[provider];
    if (!settings) {
      throw new Error(`No settings found for provider ${provider}`);
    }

    try {
      const rawResult = await activities.fetchFromProviderActivity({
        provider,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        timestamp: new Date().toISOString()
      }) as FetchResult;

      if (!rawResult.success || !rawResult.data) {
        this.feedMetrics.providerStats[provider].failed++;
        throw new Error(`Failed to fetch from ${provider}: ${rawResult.error}`);
      }

      this.feedMetrics.providerStats[provider].success++;
      this.feedMetrics.providerStats[provider].avgLatencyMs =
        (this.feedMetrics.providerStats[provider].avgLatencyMs + rawResult.latencyMs) / 2;

      // Normalize, dedupe, and process props
      const normalized = await normalizePublicProps(
        rawResult.data,
        provider,
        true,
        this.supabase
      );
      const deduped = await dedupePublicProps(
        normalized,
        provider,
        this.supabase
      );
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
      this.handleError(error, `${provider} ingestion`);
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
    const { data: existing, error } = await this.supabase
      .from('raw_props')
      .select('external_id')
      .in('external_id', props.map(p => p.external_id));

    const existingIds = new Set((existing?.map(e => e.external_id || '') || []));

    for (const prop of props) {
      try {
        if (existingIds.has(prop.external_id || '')) {
          result.duplicates++;
          result.details.duplicateExternalIds.push(prop.external_id || '');
          continue;
        }

        const { error } = await this.supabase.from('raw_props').insert(prop);

        if (error) {
          result.errors++;
          result.details.errorMessages.push(
            `Failed to insert prop ${prop.external_id || ''}: ${error.message}`
          );
        } else {
          result.inserted++;
          result.details.newExternalIds.push(prop.external_id || '');
        }
      } catch (error) {
        result.errors++;
        result.details.errorMessages.push(
          `Error processing prop ${prop.external_id || ''}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return result;
  }

  private transformProps(data: any[], provider: Provider): RawProp[] {
    return data.map(odd => ({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      external_id: odd.external_id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
      player_name: odd.player_name || '',
      team: odd.team_name || '',
      opponent: odd.opponent || '',
      stat_type: odd.market_type || '',
      line: odd.line || 0,
      over_odds: odd.over || 0,
      under_odds: odd.under || 0,
      market: odd.market_type || '',
      provider,
      game_time: odd.game_time || new Date().toISOString(),
      scraped_at: new Date().toISOString(),
      is_valid: true
    }));
  }

  private handleError(error: unknown, context: string): void {
    this.feedMetrics.errors++;
    if (this.logger) {
      this.logger.error(`[FeedAgent] Error in ${context}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Test-only methods
  public async __test__initialize(): Promise<void> {
    return this.initialize();
  }

  public async __test__collectMetrics(): Promise<Metrics> {
    return this.collectMetrics();
  }

  public async __test__checkHealth(): Promise<HealthCheckResult> {
    return this.checkHealth();
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
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