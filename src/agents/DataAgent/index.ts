import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { 
  DataQualityCheck, 
  ETLWorkflow, 
  EnrichmentPipeline,
  DataAgentConfig,
  DataAgentEvent,
  DataAgentEventType,
  DataQualityIssue,
  DataAgentMetrics,
  DataQualityResult
} from './types';

/**
 * DataAgent handles data quality, ETL processes, and data enrichment workflows
 * Follows agent-development-sop.md specifications for structure and implementation
 */
export class DataAgent extends BaseAgent {
  private etlWorkflows: Map<string, ETLWorkflow>;
  private enrichmentPipelines: Map<string, EnrichmentPipeline>;
  private qualityChecks: Map<string, DataQualityCheck>;
  private activeJobs: Set<string>;
  private lastHealthCheck: Date;
  protected metrics: DataAgentMetrics;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    // Initialize collections
    this.etlWorkflows = new Map();
    this.enrichmentPipelines = new Map();
    this.qualityChecks = new Map();
    this.activeJobs = new Set();
    this.lastHealthCheck = new Date();

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
      const { error } = await this.supabase
        .from('data_agent_events')
        .select('id')
        .limit(1);

      if (error) {
        this.logger.warn('Data agent events table not accessible:', error);
      }

      this.logger.info('DataAgent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize DataAgent:', error as Error);
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
      this.logger.error('DataAgent processing failed:', error as Error);
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
      const { error } = await this.supabase
        .from('data_agent_events')
        .select('id')
        .limit(1);

      if (error) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          details: { error: error.message },
          error: 'Database connectivity check failed'
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
        details: {},
        error: (error as Error).message
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
      extract: async (config: any) => {
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
    for (const [id, workflow] of this.etlWorkflows) {
      if (!workflow.enabled) continue;

      const startTime = Date.now();
      this.activeJobs.add(id);

      try {
        this.logger.info(`Running ETL workflow: ${workflow.name}`);
        
        // Extract
        const extractedData = await workflow.extract({});
        
        // Transform
        const transformedData = await workflow.transform(extractedData);
        
        // Load
        await workflow.load(transformedData, 'processed_data');

        this.metrics.etlJobs.successful++;
        this.metrics.dataVolume.recordsProcessed += transformedData.length;

        this.logger.info(`ETL workflow completed: ${workflow.name}`, {
          recordsProcessed: transformedData.length,
          duration: Date.now() - startTime
        });

      } catch (error) {
        this.metrics.etlJobs.failed++;
        this.logger.error(`ETL workflow failed: ${workflow.name}`, error as Error);
      } finally {
        this.activeJobs.delete(id);
        this.metrics.etlJobs.total++;
        this.metrics.etlJobs.avgDurationMs = 
          (this.metrics.etlJobs.avgDurationMs * (this.metrics.etlJobs.total - 1) + (Date.now() - startTime)) / 
          this.metrics.etlJobs.total;
      }
    }
  }

  private async runEnrichmentPipelines(): Promise<void> {
    for (const [id, pipeline] of this.enrichmentPipelines) {
      if (!pipeline.enabled) continue;

      const startTime = Date.now();
      this.activeJobs.add(id);

      try {
        this.logger.info(`Running enrichment pipeline: ${pipeline.name}`);
        
        // Get data to enrich
        const { data } = await this.supabase.from('users').select('*').limit(100);
        
        if (data && data.length > 0) {
          const enrichedData = await pipeline.enrich(data);
          this.metrics.dataVolume.recordsEnriched += enrichedData.length;
        }

        this.metrics.enrichmentJobs.successful++;

        this.logger.info(`Enrichment pipeline completed: ${pipeline.name}`, {
          recordsEnriched: data?.length || 0,
          duration: Date.now() - startTime
        });

      } catch (error) {
        this.metrics.enrichmentJobs.failed++;
        this.logger.error(`Enrichment pipeline failed: ${pipeline.name}`, error as Error);
      } finally {
        this.activeJobs.delete(id);
        this.metrics.enrichmentJobs.total++;
        this.metrics.enrichmentJobs.avgDurationMs = 
          (this.metrics.enrichmentJobs.avgDurationMs * (this.metrics.enrichmentJobs.total - 1) + (Date.now() - startTime)) / 
          this.metrics.enrichmentJobs.total;
      }
    }
  }

  private async runQualityChecks(): Promise<void> {
    for (const [id, check] of this.qualityChecks) {
      if (!check.enabled) continue;

      try {
        this.logger.info(`Running quality check: ${check.name}`);
        
        // Get sample data for quality check
        const { data } = await this.supabase.from('users').select('*').limit(1000);
        
        if (data && data.length > 0) {
          const result = await check.execute(data);
          
          if (result.passed) {
            this.metrics.qualityChecks.passed++;
          } else {
            this.metrics.qualityChecks.failed++;
            this.metrics.dataVolume.recordsRejected += result.issues.length;
          }

          this.metrics.qualityChecks.avgScore = 
            (this.metrics.qualityChecks.avgScore * this.metrics.qualityChecks.total + result.score) / 
            (this.metrics.qualityChecks.total + 1);
        }

        this.metrics.qualityChecks.total++;

        this.logger.info(`Quality check completed: ${check.name}`);

      } catch (error) {
        this.metrics.qualityChecks.failed++;
        this.logger.error(`Quality check failed: ${check.name}`, error as Error);
      }
    }
  }

  private calculateProfileCompleteness(user: any): number {
    const requiredFields = ['email', 'username', 'first_name', 'last_name'];
    const completedFields = requiredFields.filter(field => user[field] && user[field].trim() !== '');
    return completedFields.length / requiredFields.length;
  }

  // Public test methods
  public async __test__initialize(): Promise<void> {
    return this.initialize();
  }

  public async __test__collectMetrics(): Promise<DataAgentMetrics> {
    return this.collectMetrics();
  }

  public async __test__checkHealth(): Promise<HealthStatus> {
    return this.checkHealth();
  }
}