import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { createBaseAgentConfig } from '../BaseAgent/config';
import { IngestionAgentConfigSchema, IngestionAgentConfig, IngestionMetrics, RawProp } from './types';
import { fetchRawProps } from './fetchRawProps';
import { validateRawProp } from './validation';
import { normalizeRawProp } from './validation';

/**
 * Create a proper IngestionAgent configuration that extends BaseAgentConfig
 */
function createIngestionAgentConfig(config: any): BaseAgentConfig {
  // Create base config first
  const baseConfig = createBaseAgentConfig(config);

  // Construct ingestion-specific config by merging with baseConfig, filling defaults
  const ingestionConfig: any = {
    ...baseConfig,
    providers: config.providers || [],
    batchSize: config.batchSize || 100,
    processingTimeout: config.processingTimeout || 30000,
    duplicateCheck: {
      enabled: config.duplicateCheck?.enabled ?? true,
      lookbackHours: config.duplicateCheck?.lookbackHours || 24
    },
    validation: {
      enabled: config.validation?.enabled ?? true,
      strictMode: config.validation?.strictMode ?? false
    },
    normalization: {
      enabled: config.normalization?.enabled ?? true,
      autoCorrect: config.normalization?.autoCorrect ?? true
    }
  };
  return ingestionConfig;
}

/**
 * IngestionAgent handles fetching, validating, normalizing, and ingesting raw property data
 * from external providers into the database.
 */
export class IngestionAgent extends BaseAgent {
  private fullConfig: IngestionAgentConfig;
  private ingestionMetrics: IngestionMetrics;
  private ingestedCount: number = 0;
  private skippedCount: number = 0;
  private errorCount: number = 0;
  private lastIngestionTime: Date | null = null;

  constructor(config: BaseAgentConfig | any, dependencies: BaseAgentDependencies) {
    // Create a proper configuration that works with BaseAgent
    const enhancedConfig = createIngestionAgentConfig(config);
    super(enhancedConfig, dependencies);

    // Create ingestion-specific config separately
    let ingestionConfig: IngestionAgentConfig;
    try {
      ingestionConfig = IngestionAgentConfigSchema.parse(config);
    } catch (error) {
      // If ingestion config validation fails, create a minimal valid config
      ingestionConfig = {
        ...enhancedConfig,
        providers: config.providers || [],
        batchSize: config.batchSize || 100,
        processingTimeout: config.processingTimeout || 30000,
        duplicateCheckEnabled: config.duplicateCheck?.enabled ?? true,
        duplicateCheckWindow: config.duplicateCheck?.lookbackHours ?
          config.duplicateCheck.lookbackHours * 60 * 60 * 1000 : 86400000, // Convert hours to ms
        validationEnabled: config.validation?.enabled ?? true,
        normalizationEnabled: config.normalization?.enabled ?? true
      };
    }

    this.fullConfig = ingestionConfig;

    // Initialize metrics
    this.ingestionMetrics = {
      agentName: this.fullConfig.name,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0,
      ingestedCount: 0,
      skippedCount: 0,
      lastIngestionTime: null,
      providersConfigured: this.fullConfig.providers?.length || 0,
      batchSize: this.fullConfig.batchSize,
      propsIngested: 0,
      duplicatesFiltered: 0,
      validationErrors: 0,
      providerStats: {}
    };
  }

  /**
   * Initialize the agent
   */
  protected async initialize(): Promise<void> {
    this.logger.info('🚀 Initializing IngestionAgent...');
    
    try {
      // Initialize data providers
      this.ingestionMetrics.providersConfigured = this.fullConfig.providers.length;
      
      // Initialize metrics
      this.ingestionMetrics.batchSize = this.fullConfig.batchSize;
      
      this.logger.info('✅ IngestionAgent initialized successfully', {
        providersConfigured: this.ingestionMetrics.providersConfigured,
        batchSize: this.ingestionMetrics.batchSize
      });
    } catch (error) {
      this.logger.error('❌ Failed to initialize IngestionAgent', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Main processing method
   */
  protected async process(): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info('🔄 Starting ingestion process...');
      
      // Fetch raw props from all providers
      const rawProps = await this.fetchAllRawProps();
      
      if (rawProps.length === 0) {
        this.logger.info('ℹ️ No props to process');
        return;
      }

      // Process props in batches
      await this.processPropsBatch(rawProps);
      
      // Update metrics
      this.ingestionMetrics.processingTimeMs = Date.now() - startTime;
      this.lastIngestionTime = new Date();
      this.ingestionMetrics.lastIngestionTime = this.lastIngestionTime;
      
      this.logger.info('✅ Ingestion process completed', {
        totalProps: rawProps.length,
        ingested: this.ingestedCount,
        skipped: this.skippedCount,
        errors: this.errorCount,
        duration: this.ingestionMetrics.processingTimeMs
      });
      
    } catch (error) {
      this.logger.error('❌ Ingestion process failed', error instanceof Error ? error : new Error(String(error)));
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Fetch raw props from all configured providers
   */
  private async fetchAllRawProps(): Promise<RawProp[]> {
    const allProps: RawProp[] = [];

    for (const provider of this.fullConfig.providers) {
      if (!provider.enabled) continue;

      try {
        this.logger.info(`Fetching from provider: ${provider.name}`);
        const props = await fetchRawProps(provider);
        allProps.push(...props);
        
        // Update provider stats
        if (!this.ingestionMetrics.providerStats[provider.name]) {
          this.ingestionMetrics.providerStats[provider.name] = { success: 0, failed: 0, lastFetch: null };
        }
        this.ingestionMetrics.providerStats[provider.name].success++;
        this.ingestionMetrics.providerStats[provider.name].lastFetch = new Date();
        
      } catch (error) {
        this.logger.error(`Failed to fetch from provider: ${provider.name}`, error instanceof Error ? error : new Error(String(error)));

        if (!this.ingestionMetrics.providerStats[provider.name]) {
          this.ingestionMetrics.providerStats[provider.name] = { success: 0, failed: 0, lastFetch: null };
        }
        this.ingestionMetrics.providerStats[provider.name].failed++;
      }
    }

    return allProps;
  }

  /**
   * Process props in batches
   */
  private async processPropsBatch(rawProps: RawProp[]): Promise<void> {
    for (const prop of rawProps) {
      await this.processSingleProp(prop);
    }
  }

  /**
   * Process a single prop
   */
  private async processSingleProp(prop: unknown): Promise<void> {
    try {
      // Validate the prop
      if (!validateRawProp(prop)) {
        this.logger.warn('Invalid prop skipped', {
          player_name: (prop as RawProp).player_name,
          stat_type: (prop as RawProp).stat_type
        });
        this.skippedCount++;
        this.ingestionMetrics.validationErrors++;
        return;
      }

      // Check for duplicates (simplified check)
      const isDuplicate = await this.checkForDuplicate(prop as RawProp);
      if (isDuplicate) {
        this.logger.debug('Duplicate prop skipped', {
          player_name: (prop as RawProp).player_name,
          stat_type: (prop as RawProp).stat_type
        });
        this.skippedCount++;
        this.ingestionMetrics.duplicatesFiltered++;
        return;
      }

      // Normalize the prop
      const normalizedProp = normalizeRawProp(prop);

      // Insert into database
      const { error } = await this.supabase
        .from('raw_props')
        .insert(normalizedProp);

      if (error) {
        throw error;
      }

      this.ingestedCount++;
      this.ingestionMetrics.propsIngested++;
      
    } catch (error) {
      this.logger.error('Failed to process prop', error instanceof Error ? error : new Error(String(error)));
      this.errorCount++;
      this.ingestionMetrics.errorCount++;
    }
  }

  /**
   * Check for duplicate props
   */
  private async checkForDuplicate(_prop: RawProp): Promise<boolean> {
    // Simplified duplicate check - in reality this would be more sophisticated
    return false;
  }

  /**
   * Cleanup resources
   */
  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 IngestionAgent cleanup completed');
  }

  /**
   * Collect metrics
   */
  public async collectMetrics(): Promise<BaseMetrics> {
    const baseMetrics: BaseMetrics = {
      agentName: this.config.name,
      successCount: this.ingestionMetrics.successCount,
      errorCount: this.ingestionMetrics.errorCount,
      warningCount: this.ingestionMetrics.warningCount,
      processingTimeMs: this.ingestionMetrics.processingTimeMs,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };

    return baseMetrics;
  }

  /**
   * Check health
   */
  public async checkHealth(): Promise<HealthStatus> {
    try {
      // Check database connectivity
      const { error } = await this.supabase
        .from('raw_props')
        .select('id')
        .limit(1);

      if (error) throw error;

      const isRecentIngestion = this.ingestionMetrics.lastIngestionTime && 
        (Date.now() - this.ingestionMetrics.lastIngestionTime.getTime()) < 3600000; // 1 hour

      const status = isRecentIngestion ? 'healthy' : 'degraded';

      return {
        status,
        timestamp: new Date().toISOString(),
        details: {
          lastIngestionTime: this.ingestionMetrics.lastIngestionTime,
          metrics: this.ingestionMetrics
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
}