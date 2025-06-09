import { BaseAgent } from '../BaseAgent/index';
import { 
  BaseAgentConfig, 
  BaseAgentDependencies, 
  HealthStatus, 
  BaseMetrics 
} from '../BaseAgent/types';
import { fetchRawProps } from './fetchRawProps';
import { validateRawProp } from './validateRawProp';
import { isDuplicateRawProp } from './isDuplicate';
import { normalizeRawProp } from './normalize';
import { 
  startMetricsServer,
  ingestedCounter,
  skippedCounter,
  errorCounter,
  durationHistogram
} from '../../services/metricsServer';

let instance: IngestionAgent | null = null;

export interface IngestionMetrics extends BaseMetrics {
  'custom.propsIngested': number;
  'custom.propsSkipped': number;
  'custom.propsInvalid': number;
}

export class IngestionAgent extends BaseAgent {
  private metricsStarted: boolean = false;
  private propsIngested: number = 0;
  private propsSkipped: number = 0;
  private propsInvalid: number = 0;
  private lastRunTimestamp: number = 0;
  private processingErrors: Error[] = [];

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    this.deps.logger.info('Initializing IngestionAgent...');
    
    try {
      // Start metrics server if not already started
      if (!this.metricsStarted) {
        startMetricsServer(9000); // Dedicated port for ingestion agent metrics
        this.metricsStarted = true;
      }
      
      await this.validateDependencies();
      this.deps.logger.info('IngestionAgent initialized successfully');
    } catch (error) {
      this.deps.logger.error('Failed to initialize IngestionAgent:', error);
      throw error;
    }
  }

  private async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const { error } = await this.deps.supabase
      .from('raw_props')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Failed to access raw_props table: ${error.message}`);
    }
  }

  protected async process(): Promise<void> {
    const stopTimer = durationHistogram.startTimer({ phase: 'ingestion' });
    this.lastRunTimestamp = Date.now();
    this.processingErrors = [];
    
    try {
      this.deps.logger.info('🚀 IngestionAgent started processing');
      
      // Reset counters for this processing cycle
      this.propsIngested = 0;
      this.propsSkipped = 0;
      this.propsInvalid = 0;
      
      // Fetch raw props from provider
      const rawProps = await fetchRawProps();
      this.deps.logger.info(`Fetched ${rawProps.length} props from provider`);
      
      // Process each prop
      for (const prop of rawProps) {
        try {
          if (!validateRawProp(prop)) {
            this.deps.logger.warn({ prop }, 'Invalid prop shape—skipping');
            skippedCounter.inc();
            this.propsInvalid++;
            continue;
          }
          
          if (await isDuplicateRawProp(prop)) {
            this.deps.logger.info({ prop }, 'Duplicate prop—skipping');
            skippedCounter.inc();
            this.propsSkipped++;
            continue;
          }
          
          const normalized = normalizeRawProp(prop);
          const { error } = await this.deps.supabase.from('raw_props').insert([normalized]);
          
          if (error) {
            this.deps.errorHandler.handleError(error, 'Supabase insert');
            errorCounter.inc();
            this.processingErrors.push(new Error(`Insert error: ${error.message}`));
          } else {
            this.deps.logger.info(
              { player: normalized.player_name, stat: normalized.stat_type }, 
              'Inserted raw prop'
            );
            ingestedCounter.inc();
            this.propsIngested++;
          }
        } catch (error) {
          this.deps.errorHandler.handleError(error, 'Ingestion loop');
          errorCounter.inc();
          if (error instanceof Error) {
            this.processingErrors.push(error);
          } else {
            this.processingErrors.push(new Error('Unknown error in ingestion loop'));
          }
        }
      }
      
      this.deps.logger.info('✅ IngestionAgent processing complete', {
        ingested: this.propsIngested,
        skipped: this.propsSkipped,
        invalid: this.propsInvalid,
        errors: this.processingErrors.length
      });
    } catch (error) {
      this.deps.logger.error('IngestionAgent process error:', error);
      errorCounter.inc();
      if (error instanceof Error) {
        this.processingErrors.push(error);
      }
      throw error;
    } finally {
      stopTimer();
    }
  }

  protected async cleanup(): Promise<void> {
    this.deps.logger.info('Performing IngestionAgent cleanup');
    // Any cleanup logic here (close connections, etc.)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    try {
      // Check database connectivity
      const { error } = await this.deps.supabase
        .from('raw_props')
        .select('id')
        .limit(1);

      if (error) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          details: {
            error: error.message,
            component: 'database'
          }
        };
      }

      // Check if we've processed recently (within last 24 hours)
      const isRecentRun = Date.now() - this.lastRunTimestamp < 24 * 60 * 60 * 1000;
      
      // Check for excessive errors in last run
      const hasExcessiveErrors = this.processingErrors.length > 10;

      if (!isRecentRun) {
        return {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'No recent processing run',
            lastRun: new Date(this.lastRunTimestamp).toISOString()
          }
        };
      }

      if (hasExcessiveErrors) {
        return {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'Excessive errors in last run',
            errorCount: this.processingErrors.length
          }
        };
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: {
          lastRun: new Date(this.lastRunTimestamp).toISOString(),
          propsIngested: this.propsIngested,
          propsSkipped: this.propsSkipped
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          component: 'health-check'
        }
      };
    }
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // Get stats from the database for the last 24 hours
    const { data: recentProps } = await this.deps.supabase
      .from('raw_props')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return {
      successCount: this.propsIngested,
      errorCount: this.processingErrors.length,
      warningCount: this.propsSkipped + this.propsInvalid,
      processingTimeMs: Date.now() - this.lastRunTimestamp,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
      'custom.propsIngested': this.propsIngested,
      'custom.propsSkipped': this.propsSkipped,
      'custom.propsInvalid': this.propsInvalid,
      'custom.recentPropsCount': recentProps?.length || 0
    };
  }

  // Public API
  public static getInstance(dependencies: BaseAgentDependencies): IngestionAgent {
    if (!instance) {
      const config: BaseAgentConfig = {
        name: 'IngestionAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: {
          enabled: true,
          interval: 60
        },
        health: {
          enabled: true,
          interval: 30
        },
        retry: {
          maxRetries: 3,
          backoffMs: 200,
          maxBackoffMs: 5000
        }
      };
      instance = new IngestionAgent(config, dependencies);
    }
    return instance;
  }
}

// Legacy script execution for backwards compatibility
if (require.main === module) {
  async function runIngestionAgent() {
    try {
      const deps: BaseAgentDependencies = {
        supabase: (await import('../../services/supabaseClient')).supabase,
        logger: (await import('../../services/logging')).logger,
        errorHandler: {
          handleError: (await import('../../utils/errorHandler')).handleError
        }
      };
      
      const agent = IngestionAgent.getInstance(deps);
      await agent.start();
    } catch (error) {
      console.error('Failed to run IngestionAgent:', error);
    }
  }
  
  runIngestionAgent();
}
