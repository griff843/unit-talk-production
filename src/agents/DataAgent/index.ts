import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus } from '../BaseAgent/types';
import { ETLWorkflow, EnrichmentPipeline, DataQualityCheck, DataAgentMetrics } from './types';

// Add DataQualityResult interface to fix missing type error
interface DataQualityResult {
  passed: boolean;
  score: number;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    field: string;
    recordId: string;
  }>;
  metadata: {
    totalRecords: number;
    validRecords: number;
  };
}

/**
 * DataAgent handles data quality, ETL processes, and data enrichment workflows
 * Follows agent-development-sop.md specifications for structure and implementation
 */
export class DataAgent extends BaseAgent {
  private etlWorkflows: Map<string, ETLWorkflow>;
  private enrichmentPipelines: Map<string, EnrichmentPipeline>;
  private qualityChecks: Map<string, DataQualityCheck>;
  private activeJobs: Set<string>;
  protected override metrics: DataAgentMetrics;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    // Initialize collections
    this.etlWorkflows = new Map();
    this.enrichmentPipelines = new Map();
    this.qualityChecks = new Map();
    this.activeJobs = new Set();

    // Initialize metrics
    this.metrics = {
      agentName: 'DataAgent',
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0,
      etlJobs: {
        total: 0,
        successful: 0,
        failed: 0,
        avgDurationMs: 0
      },
      enrichmentJobs: {
        total: 0,
        successful: 0,
        failed: 0,
        avgDurationMs: 0
      },
      qualityChecks: {
        total: 0,
        passed: 0,
        failed: 0,
        avgScore: 0
      },
      dataVolume: {
        recordsProcessed: 0,
        recordsEnriched: 0,
        recordsRejected: 0
      }
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Initializing DataAgent...');

    try {
      // Initialize default workflows
      this.initializeDefaultWorkflows();

      // Initialize default pipelines
      this.initializeDefaultPipelines();

      // Initialize quality checks
      this.initializeQualityChecks();

      // Verify database connectivity
      if (!this.supabase) {
        throw new Error('Supabase client is required for DataAgent');
      }
      const { error } = await this.supabase
        .from('data_agent_events')
        .select('id')
        .limit(1);

      if (error) {
        this.logger.warn('Data agent events table not accessible:', {
          error: error.message,
          code: error.code,
          details: error.details
        });
      }

      this.logger.info('DataAgent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize DataAgent:', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  protected async process(): Promise<void> {
    const startTime = Date.now();
    this.logger.info('Starting DataAgent processing');

    try {
      // Run ETL workflows
      await this.runETLWorkflows();

      // Run enrichment pipelines
      await this.runEnrichmentPipelines();

      // Run quality checks
      await this.runQualityChecks();

      this.metrics.processingTimeMs = Date.now() - startTime;
      this.metrics.successCount++;

      this.logger.info('DataAgent processing completed', {
        duration: this.metrics.processingTimeMs,
        etlJobs: this.metrics.etlJobs.total,
        enrichmentJobs: this.metrics.enrichmentJobs.total,
        qualityChecks: this.metrics.qualityChecks.total
      });

    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error('DataAgent processing failed:', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Cleaning up DataAgent');
    this.activeJobs.clear();
  }

  public async checkHealth(): Promise<HealthStatus> {
    try {
      // Check database connectivity
      if (!this.supabase) {
        throw new Error('Supabase client is required for DataAgent');
      }
      const { error } = await this.supabase
        .from('data_agent_events')
        .select('id')
        .limit(1);

      if (error) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          details: {
            error: error.message,
            message: 'Database connectivity check failed'
          }
        };
      }

      // Check active jobs
      const activeJobCount = this.activeJobs.size;
      const isHealthy = activeJobCount < 10 && this.metrics.errorCount < 5;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        details: {
          activeJobs: activeJobCount,
          etlJobs: this.metrics.etlJobs,
          enrichmentJobs: this.metrics.enrichmentJobs,
          qualityChecks: this.metrics.qualityChecks
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          error: (error as Error).message
        }
      };
    }
  }

  protected async collectMetrics(): Promise<DataAgentMetrics> {
    this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
    return { ...this.metrics };
  }

  private initializeDefaultWorkflows(): void {
    // Initialize user data sync workflow
    this.etlWorkflows.set('user-data-sync', {
      id: 'user-data-sync',
      name: 'User Data Synchronization',
      description: 'Synchronizes user data across systems',
      enabled: true,
      schedule: '0 * * * *', // Every hour
      extract: async () => {
        if (!this.supabase) {
          throw new Error('Supabase client is required for DataAgent');
        }
        const { data } = await this.supabase.from('users').select('*');
        return data || [];
      },
      transform: async (data: any[]) => {
        return data.map(user => ({
          ...user,
          email: user.email?.toLowerCase(),
          processed_at: new Date().toISOString()
        }));
      },
      load: async (data: any[], target: string) => {
        if (!this.supabase) {
          throw new Error('Supabase client is required for DataAgent');
        }
        const { error } = await this.supabase.from(target).upsert(data);
        if (error) throw error;
      }
    });
  }

  private initializeDefaultPipelines(): void {
    // Initialize user enrichment pipeline
    this.enrichmentPipelines.set('user-enrichment', {
      id: 'user-enrichment',
      name: 'User Profile Enrichment',
      description: 'Enriches user profiles with additional data',
      enabled: true,
      priority: 1,
      enrich: async (data: any[]) => {
        return data.map(user => ({
          ...user,
          enriched_at: new Date().toISOString(),
          profile_completeness: this.calculateProfileCompleteness(user)
        }));
      }
    });
  }

  private initializeQualityChecks(): void {
    // Initialize email validation check
    this.qualityChecks.set('email-validation', {
      id: 'email-validation',
      name: 'Email Validation',
      description: 'Validates email format and domain',
      enabled: true,
      threshold: 0.95,
      execute: async (data: any[]): Promise<DataQualityResult> => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validEmails = data.filter(item => emailRegex.test(item.email));
        const score = validEmails.length / data.length;
        
        return {
          passed: score >= 0.95,
          score,
          issues: data
            .filter(item => !emailRegex.test(item.email))
            .map(item => ({
              type: 'invalid_email',
              severity: 'medium' as const,
              message: `Invalid email format: ${item.email}`,
              field: 'email',
              recordId: item.id
            })),
          metadata: { totalRecords: data.length, validRecords: validEmails.length }
        };
      }
    });
  }

  private async runETLWorkflows(): Promise<void> {
    for (const [, workflow] of Array.from(this.etlWorkflows.entries())) {
      if (!workflow.enabled) continue;

      this.activeJobs.add(workflow.id);
      const startTime = Date.now();

      try {
        this.logger.info(`Running ETL workflow: ${workflow.name}`);

        // Extract
        const extractedData = await this.extractData(workflow);

        // Transform
        const transformedData = await this.transformData(extractedData, workflow);

        // Load
        await this.loadData(transformedData, workflow);

        this.metrics.etlJobs.successful++;
        this.logger.info(`ETL workflow completed: ${workflow.name}`, {
          duration: Date.now() - startTime,
          recordsProcessed: extractedData?.length || 0
        });

      } catch (error) {
        this.metrics.etlJobs.failed++;
        this.logger.error(`ETL workflow failed: ${workflow.name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      } finally {
        this.activeJobs.delete(workflow.id);
      }
    }
  }

  /**
   * Extract data from source
   */
  private async extractData(workflow: ETLWorkflow): Promise<any[]> {
    // Implementation would depend on the source type
    // For now, return mock data
    this.logger.info(`Extracting data for workflow: ${workflow.name}`);
    return [];
  }

  /**
   * Transform data according to workflow rules
   */
  private async transformData(data: any[], workflow: ETLWorkflow): Promise<any[]> {
    // Implementation would apply transformations
    this.logger.info(`Transforming data for workflow: ${workflow.name}`);
    return data;
  }

  /**
   * Load data to destination
   */
  private async loadData(_: any[], workflow: ETLWorkflow): Promise<void> {
    // Implementation would load data to destination
    this.logger.info(`Loading data for workflow: ${workflow.name}`);
  }

  /**
   * Run enrichment pipelines
   */
  private async runEnrichmentPipelines(): Promise<void> {
    for (const [key, pipeline] of Array.from(this.enrichmentPipelines)) {
      if (!pipeline.enabled) continue;

      try {
        this.activeJobs.add(key);
        const startTime = Date.now();

        // Run enrichment logic here
        await this.runEnrichmentPipeline(pipeline);

        this.metrics.enrichmentJobs.successful++;
        this.logger.info(`Enrichment pipeline completed: ${pipeline.name}`, {
          duration: Date.now() - startTime
        });

      } catch (error) {
        this.metrics.enrichmentJobs.failed++;
        this.logger.error(`Enrichment pipeline failed: ${pipeline.name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        this.activeJobs.delete(key);
      }
    }
  }

  /**
   * Run a single enrichment pipeline
   */
  private async runEnrichmentPipeline(pipeline: EnrichmentPipeline): Promise<void> {
    this.logger.info(`Running enrichment pipeline: ${pipeline.name}`);
    // Implementation would run the enrichment logic
  }

  /**
   * Run quality checks
   */
  private async runQualityChecks(): Promise<void> {
    for (const [, check] of Array.from(this.qualityChecks)) {
      if (!check.enabled) continue;

      try {
        this.logger.info(`Running quality check: ${check.name}`);

        // Get sample data for quality check
        if (!this.supabase) {
          throw new Error('Supabase client is required for DataAgent');
        }
        const { data } = await this.supabase.from('users').select('*').limit(1000);

        if (data && data.length > 0) {
          const result = await this.runQualityCheck(check, data);

          this.metrics.qualityChecks.total++;
          if (result.passed) {
            this.metrics.qualityChecks.passed++;
          } else {
            this.metrics.qualityChecks.failed++;
          }
        }

      } catch (error) {
        this.metrics.qualityChecks.failed++;
        this.logger.error(`Quality check failed: ${check.name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Run a single quality check
   */
  private async runQualityCheck(_: DataQualityCheck, _data: any[]): Promise<{ passed: boolean; score: number }> {
    // Mock implementation - would run actual quality check logic
    return { passed: true, score: 0.95 };
  }

  /**
   * Calculate profile completeness
   */
  private calculateProfileCompleteness(_user: any): number {
    // Mock implementation
    return 0.8;
  }

  /**
   * Test methods for internal testing
   */
  public async __test__initialize(): Promise<void> {
    return this.initialize();
  }

  public async __test__collectMetrics(): Promise<DataAgentMetrics> {
    return this.metrics;
  }

  public async __test__checkHealth(): Promise<HealthStatus> {
    return this.checkHealth();
  }
}