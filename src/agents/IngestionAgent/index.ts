import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, AgentStatus, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { fetchRawProps } from './fetchRawProps';
import { validateRawProp } from './validateRawProp';
import { isDuplicateRawProp } from './isDuplicate';
import { normalizeRawProp } from './normalize';
import { IngestionAgentConfig, IngestionAgentConfigSchema, IngestionMetrics, RawProp, IngestionResult } from './types';

/**
 * IngestionAgent - Handles fetching, validating, and ingesting raw props from external providers
 * 
 * This agent is responsible for:
 * - Fetching raw props from external data providers
 * - Validating prop data structure and content
 * - Checking for duplicates to avoid data redundancy
 * - Normalizing prop data to match internal schema
 * - Inserting validated props into the database
 * - Providing comprehensive metrics and monitoring
 */
export class IngestionAgent extends BaseAgent {
  private fullConfig: IngestionAgentConfig;
  private ingestedCount = 0;
  private skippedCount = 0;
  private errorCount = 0;
  private lastIngestionTime: Date | null = null;

  constructor(config: IngestionAgentConfig, dependencies: BaseAgentDependencies) {
    // Validate the full IngestionAgent config first
    const validatedConfig = IngestionAgentConfigSchema.parse(config);

    // Pass the validated config directly to BaseAgent
    // BaseAgent will validate it again with BaseAgentConfigSchema, but that should work
    // since IngestionAgentConfigSchema extends BaseAgentConfigSchema
    super(validatedConfig as any, dependencies);

    // Store the full validated config
    this.fullConfig = validatedConfig;
  }

  /**
   * Initialize the IngestionAgent
   * Sets up metrics collection and validates configuration
   */
  public async initialize(): Promise<void> {
    this.dependencies.logger.info('🚀 IngestionAgent initializing');

    // Initialize data providers
    for (const provider of this.fullConfig.providers) {
      if (provider.enabled) {
        this.dependencies.logger.info(`Initializing provider: ${provider.name}`);
        // Provider-specific initialization logic would go here
      }
    }

    // Initialize metrics
    this.metrics = {
      propsIngested: 0,
      duplicatesFiltered: 0,
      validationErrors: 0,
      processingTime: 0,
      lastIngestionTime: null,
      providerStats: new Map()
    };

    this.logger.info('✅ IngestionAgent initialized successfully');
  }

  /**
   * Main processing method - fetches and ingests props
   */
  public async process(): Promise<IngestionResult> {
    const startTime = Date.now();
    this.logger.info('🔄 Starting ingestion process');

    try {
      // Reset counters for this run
      this.ingestedCount = 0;
      this.skippedCount = 0;
      this.errorCount = 0;

      // Fetch raw props from all configured providers
      const rawProps = await this.fetchAllRawProps();
      this.logger.info(`📥 Fetched ${rawProps.length} props from providers`);

      // Process props in batches
      const results = await this.processPropsBatch(rawProps);
      
      // Update metrics
      this.lastIngestionTime = new Date();
      const duration = Date.now() - startTime;

      const result: IngestionResult = {
        totalFetched: rawProps.length,
        ingested: this.ingestedCount,
        skipped: this.skippedCount,
        errors: this.errorCount,
        duration,
        timestamp: this.lastIngestionTime
      };

      this.logger.info('✅ Ingestion process completed', result);
      return result;

    } catch (error) {
      this.errorCount++;
      await this.errorHandler.handleError(error, {
        operation: 'process',
        agent: this.name
      });
      throw error;
    }
  }

  /**
   * Fetch raw props from all configured providers
   */
  private async fetchAllRawProps(): Promise<RawProp[]> {
    const allProps: RawProp[] = [];

    for (const provider of this.fullConfig.providers) {
      try {
        this.logger.info(`📡 Fetching from provider: ${provider.name}`);
        const props = await fetchRawProps(provider);
        allProps.push(...props);
        this.logger.info(`✅ Fetched ${props.length} props from ${provider.name}`);
      } catch (error) {
        this.errorCount++;
        this.logger.error(`❌ Failed to fetch from provider ${provider.name}:`, error);
        await this.errorHandler.handleError(error, {
          provider: provider.name,
          operation: 'fetchRawProps'
        });

        // Continue with other providers unless configured to fail fast
        if (this.fullConfig.failFast) {
          throw error;
        }
      }
    }

    return allProps;
  }

  /**
   * Process props in batches for better performance and error handling
   */
  private async processPropsBatch(rawProps: RawProp[]): Promise<void> {
    const batchSize = this.fullConfig.batchSize;

    for (let i = 0; i < rawProps.length; i += batchSize) {
      const batch = rawProps.slice(i, i + batchSize);
      this.logger.info(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rawProps.length / batchSize)}`);

      await Promise.all(batch.map(prop => this.processSingleProp(prop)));
    }
  }

  /**
   * Process a single prop through the ingestion pipeline
   */
  private async processSingleProp(prop: RawProp): Promise<void> {
    try {
      // Validate prop structure
      if (!validateRawProp(prop)) {
        this.logger.warn('⚠️ Invalid prop shape—skipping', { 
          player: prop.player_name, 
          stat: prop.stat_type 
        });
        this.skippedCount++;
        return;
      }

      // Check for duplicates
      if (await isDuplicateRawProp(prop, this.dependencies.supabase)) {
        this.logger.debug('🔄 Duplicate prop—skipping', { 
          player: prop.player_name, 
          stat: prop.stat_type 
        });
        this.skippedCount++;
        return;
      }

      // Normalize prop data
      const normalized = normalizeRawProp(prop);

      // Insert into database
      const { error } = await this.dependencies.supabase
        .from('raw_props')
        .insert([normalized]);

      if (error) {
        throw error;
      }

      this.logger.info('✅ Ingested prop', { 
        player: normalized.player_name, 
        stat: normalized.stat_type 
      });
      this.ingestedCount++;

    } catch (error) {
      this.errorCount++;
      this.logger.error('❌ Failed to process prop:', error, { prop });
      await this.errorHandler.handleError(error, {
        operation: 'processSingleProp',
        prop: {
          player: prop.player_name,
          stat: prop.stat_type,
          id: prop.id
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.logger.info('🧹 IngestionAgent cleanup started');

    // Cleanup data providers
    for (const provider of this.fullConfig.providers) {
      if (provider.enabled) {
        this.logger.info(`Cleaning up provider: ${provider.name}`);
        // Provider-specific cleanup logic would go here
      }
    }

    this.logger.info('✅ IngestionAgent cleanup completed');
  }

  /**
   * Collect agent-specific metrics
   */
  public async collectMetrics(): Promise<IngestionMetrics> {
    const baseMetrics = await super.performMetricsCollection();

    return {
      ...baseMetrics,
      ingestedCount: this.metrics.propsIngested,
      skippedCount: this.metrics.duplicatesFiltered,
      errorCount: this.metrics.validationErrors,
      lastIngestionTime: this.metrics.lastIngestionTime,
      providersConfigured: this.fullConfig.providers.length,
      batchSize: this.fullConfig.batchSize
    };
  }

  /**
   * Perform health check
   */
  public async checkHealth(): Promise<HealthStatus> {
    const baseHealth = await super.performHealthCheck();

    // Check if ingestion is running too frequently or not at all
    const now = new Date();
    const timeSinceLastIngestion = this.metrics.lastIngestionTime
      ? now.getTime() - this.metrics.lastIngestionTime.getTime()
      : null;

    // If no ingestion has happened yet, that's okay for a new agent
    if (timeSinceLastIngestion === null) {
      return {
        ...baseHealth,
        status: 'healthy',
        details: {
          ...baseHealth.details,
          ingestion: 'No ingestion runs yet - agent is new'
        }
      };
    }

    // If last ingestion was more than 1 hour ago, that might be concerning
    const oneHourMs = 60 * 60 * 1000;
    if (timeSinceLastIngestion > oneHourMs) {
      return {
        ...baseHealth,
        status: 'degraded',
        details: {
          ...baseHealth.details,
          ingestion: `Last ingestion was ${Math.round(timeSinceLastIngestion / 60000)} minutes ago`
        }
      };
    }

    // Check error rate and skip rate using the individual counters that are actually updated
    const totalProcessed = this.ingestedCount + this.errorCount + this.skippedCount;
    const errorRate = totalProcessed > 0 ? this.errorCount / totalProcessed : 0;
    const skipRate = totalProcessed > 0 ? this.skippedCount / totalProcessed : 0;

    // High error rate indicates processing issues
    if (errorRate > 0.1) { // More than 10% error rate
      return {
        ...baseHealth,
        status: 'degraded',
        details: {
          ...baseHealth.details,
          ingestion: `High error rate: ${(errorRate * 100).toFixed(1)}%`
        }
      };
    }

    // High skip rate indicates data quality issues
    if (skipRate > 0.9) { // More than 90% skip rate
      return {
        ...baseHealth,
        status: 'degraded',
        details: {
          ...baseHealth.details,
          ingestion: `High skip rate: ${(skipRate * 100).toFixed(1)}% - possible data quality issues`
        }
      };
    }

    return {
      ...baseHealth,
      status: 'healthy',
      details: {
        ...baseHealth.details,
        ingestion: 'All systems operational'
      }
    };
  }

  /**
   * Reset metrics counters
   */
  private resetMetrics(): void {
    this.ingestedCount = 0;
    this.skippedCount = 0;
    this.errorCount = 0;
  }

  /**
   * Test method for unit testing
   */
  public async __test__process(mockProps?: RawProp[]): Promise<IngestionResult> {
    if (mockProps) {
      return this.processPropsBatch(mockProps).then(() => ({
        totalFetched: mockProps.length,
        ingested: this.ingestedCount,
        skipped: this.skippedCount,
        errors: this.errorCount,
        duration: 0,
        timestamp: new Date()
      }));
    }
    return this.process();
  }

  /**
   * Test method for checking validation
   */
  public __test__validateProp(prop: RawProp): boolean {
    return validateRawProp(prop);
  }

  /**
   * Test method for checking normalization
   */
  public __test__normalizeProp(prop: RawProp): any {
    return normalizeRawProp(prop);
  }
}