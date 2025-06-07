import { BaseAgent } from '../BaseAgent';
import { 
  FeedAgentConfig,
  FeedConfigSchema,
  Provider,
  FeedMetrics,
  ProcessedResult
} from './types';
import { BaseAgentDependencies } from '../../types/agent';
import { HealthCheckResult, AgentCommand } from '../../types/agent';
import { Metrics } from '../../types/shared';
import { RawProp } from '../../types/rawProps';
import { fetchFromProviderActivity } from './activities/fetchFromProvider';
import { normalizePublicProps } from './utils/normalizePublicProps';
import { dedupePublicProps } from './utils/dedupePublicProps';

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
    this.logger.info('Initializing FeedAgent...');
    
    // Validate dependencies
    await this.validateDependencies();
    
    // Initialize resources
    await this.initializeResources();
    
    // Reset metrics
    this.resetMetrics();
    
    this.logger.info('FeedAgent initialized successfully');
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Cleaning up FeedAgent...');
    // No heavy cleanup needed for FeedAgent
    this.logger.info('FeedAgent cleanup completed');
  }

  protected async checkHealth(): Promise<HealthCheckResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: Record<string, any> = {
      metrics: this.feedMetrics
    };
    
    // Check provider error rates
    for (const [provider, stats] of Object.entries(this.feedMetrics.providerStats)) {
      const totalRequests = stats.success + stats.failed;
      if (totalRequests > 0) {
        const errorRate = stats.failed / totalRequests;
        if (errorRate > 0.1) {
          errors.push(`High error rate for ${provider}: ${(errorRate * 100).toFixed(1)}%`);
        } else if (errorRate > 0.05) {
          warnings.push(`Elevated error rate for ${provider}: ${(errorRate * 100).toFixed(1)}%`);
        }
        
        // Check latency
        if (stats.avgLatencyMs > 5000) {
          warnings.push(`High latency for ${provider}: ${stats.avgLatencyMs}ms`);
        }
      }
    }

    const status = errors.length === 0 ? 
      (warnings.length === 0 ? 'healthy' : 'degraded') : 
      'unhealthy';

    return {
      status,
      details: {
        errors,
        warnings,
        info
      },
      timestamp: new Date().toISOString()
    };
  }

  protected async collectMetrics(): Promise<Metrics> {
    const baseMetrics: Metrics = {
      errorCount: this.feedMetrics.errors,
      warningCount: Object.values(this.feedMetrics.providerStats)
        .filter(stats => stats.failed > 0).length,
      successCount: Object.values(this.feedMetrics.providerStats)
        .reduce((sum, stats) => sum + stats.success, 0)
    };

    return {
      ...baseMetrics,
      ...this.feedMetrics
    };
  }

  public async handleCommand(command: AgentCommand): Promise<void> {
    switch (command.type) {
      case 'FETCH_FEED':
        await this.startProviderIngestion(command.payload.provider);
        break;
      case 'START_PROCESSING':
        await this.startProcessing();
        break;
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }
  }

  private async validateDependencies(): Promise<void> {
    const config = this.config as FeedAgentConfig;
    
    // Validate provider configurations
    if (!config.providers || Object.keys(config.providers).length === 0) {
      throw new Error('No providers configured');
    }

    for (const [provider, settings] of Object.entries(config.providers)) {
      if (!settings.apiKey || !settings.baseUrl) {
        throw new Error(`Invalid configuration for provider ${provider}: missing apiKey or baseUrl`);
      }
    }

    // Test Supabase connection
    try {
      const { error } = await this.supabase.from('raw_props').select('id').limit(1);
      if (error) {
        throw new Error(`Supabase connection failed: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to validate Supabase connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async initializeResources(): Promise<void> {
    // Initialize provider stats for all configured providers
    const config = this.config as FeedAgentConfig;
    for (const provider of Object.keys(config.providers) as Provider[]) {
      if (!this.feedMetrics.providerStats[provider]) {
        this.feedMetrics.providerStats[provider] = {
          success: 0,
          failed: 0,
          avgLatencyMs: 0
        };
      }
    }
  }

  private async startProcessing(): Promise<void> {
    const config = this.config as FeedAgentConfig;
    
    this.logger.info('Starting feed processing for all enabled providers');
    
    const promises = [];
    for (const [provider, settings] of Object.entries(config.providers)) {
      if (settings.enabled) {
        promises.push(this.startProviderIngestion(provider as Provider));
      }
    }
    
    await Promise.allSettled(promises);
    this.logger.info('Feed processing completed for all providers');
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number,
    backoffMs: number
  ): Promise<T> {
    let attempt = 1;
    while (attempt <= maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        this.logger.warn(`Operation failed on attempt ${attempt}/${maxAttempts}, retrying in ${backoffMs}ms`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        await new Promise(resolve => setTimeout(resolve, backoffMs * attempt));
        attempt++;
      }
    }
    throw new Error('Max attempts reached'); // This should never be reached
  }

  private async startProviderIngestion(provider: Provider): Promise<void> {
    const config = this.config as FeedAgentConfig;
    const settings = config.providers[provider];

    if (!settings || !settings.enabled) {
      this.logger.warn(`Provider ${provider} is not enabled or configured`);
      return;
    }

    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting ingestion for provider: ${provider}`);

      // Use custom retry mechanism for the fetch operation
      const rawResult = await this.retryOperation(
        () => fetchFromProviderActivity({
          provider,
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          timestamp: new Date().toISOString()
        }),
        settings.retryConfig?.maxAttempts || 3,
        settings.retryConfig?.backoffMs || 1000
      );

      if (!rawResult.success || !rawResult.data) {
        this.feedMetrics.providerStats[provider].failed++;
        throw new Error(`Failed to fetch from ${provider}: ${rawResult.error}`);
      }

      // Update success metrics
      this.feedMetrics.providerStats[provider].success++;
      const latency = Date.now() - startTime;
      this.feedMetrics.providerStats[provider].avgLatencyMs = 
        (this.feedMetrics.providerStats[provider].avgLatencyMs + latency) / 2;

      // Normalize the fetched data
      const normalized = await normalizePublicProps(rawResult.data, true);
      this.logger.info(`Normalized ${normalized.length} props from ${provider}`);

      // Deduplicate against existing data
      const deduped = await dedupePublicProps(normalized, this.supabase);
      this.logger.info(`${deduped.length} props after deduplication from ${provider}`);

      // Transform to RawProp format
      const props = this.transformProps(deduped, provider);

      // Process and store the props
      const processed = await this.processProps(props);

      // Update metrics
      this.feedMetrics.totalProps += props.length;
      this.feedMetrics.uniqueProps += processed.inserted;
      this.feedMetrics.duplicates += processed.duplicates;
      this.feedMetrics.errors += processed.errors;
      this.feedMetrics.latencyMs = latency;

      this.logger.info('Provider ingestion completed', {
        provider,
        stats: processed,
        latency: `${latency}ms`,
        timestamp: rawResult.timestamp
      });

    } catch (error) {
      this.feedMetrics.providerStats[provider].failed++;
      this.feedMetrics.errors++;
      
      await this.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
        provider,
        timestamp: new Date().toISOString(),
        operation: 'provider_ingestion'
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

    if (props.length === 0) {
      return result;
    }

    try {
      // Check for existing props by external_id
      const { data: existing } = await this.supabase
        .from('raw_props')
        .select('external_id')
        .in('external_id', props.map(p => p.external_id).filter(Boolean));

      const existingIds = new Set(existing?.map(e => e.external_id) || []);

      // Process each prop
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
              `Failed to insert prop ${prop.external_id || prop.id}: ${error.message}`
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
            `Error processing prop ${prop.external_id || prop.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

    } catch (error) {
      this.logger.error('Failed to process props batch', { error, propsCount: props.length });
      result.errors = props.length;
      result.details.errorMessages.push(`Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private transformProps(data: any[], provider: Provider): RawProp[] {
    return data.map(item => ({
      id: crypto.randomUUID(),
      external_id: item.external_id || item.id || `${provider}-${crypto.randomUUID()}`,
      player_name: item.player_name || item.playerName || '',
      team: item.team_name || item.team || '',
      opponent: item.opponent || '',
      stat_type: item.market_type || item.statType || '',
      line: item.line || 0,
      over_odds: item.over || item.overOdds,
      under_odds: item.under || item.underOdds,
      market: item.market_type || item.market || '',
      provider,
      game_time: item.game_time || item.gameTime || new Date().toISOString(),
      scraped_at: new Date().toISOString(),
      is_valid: true
    }));
  }

  private resetMetrics(): void {
    this.feedMetrics = {
      totalProps: 0,
      uniqueProps: 0,
      duplicates: 0,
      errors: 0,
      latencyMs: 0,
      providerStats: Object.keys(this.feedMetrics.providerStats).reduce((acc, provider) => {
        acc[provider as Provider] = {
          success: 0,
          failed: 0,
          avgLatencyMs: 0
        };
        return acc;
      }, {} as Record<Provider, { success: number; failed: number; avgLatencyMs: number; }>)
    };
  }
}
