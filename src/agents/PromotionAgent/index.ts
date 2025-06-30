import { BaseAgent } from '../BaseAgent/index';
import { 
  BaseAgentConfig, 
  BaseAgentDependencies,
  HealthStatus,
  BaseMetrics
} from '../BaseAgent/types';
import { promoteToDailyPicks } from './promoteToDailyPicks';
import { startMetricsServer, ingestedCounter, errorCounter, durationHistogram } from '../../services/metricsServer';

let instance: PromotionAgent | null = null;

export class PromotionAgent extends BaseAgent {
  private metricsStarted: boolean = false;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Initializing PromotionAgent...');
    
    try {
      // Start metrics server if not already started
      if (!this.metricsStarted) {
        startMetricsServer(9001); // Dedicated port for promotion agent metrics
        this.metricsStarted = true;
      }
      
      await this.validateDependencies();
      this.logger.info('PromotionAgent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PromotionAgent:', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.errorHandler?.handleError(error as Error);
      throw error;
    }
  }

  private async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const tables = ['graded_picks', 'final_picks'];

    if (!this.supabase) {
      throw new Error('Supabase client is required for PromotionAgent');
    }

    for (const table of tables) {
      const { error } = await this.supabase
        .from(table)
        .select('id')
        .limit(1);

      if (error) {
        throw new Error(`Failed to access ${table} table: ${error.message}`);
      }
    }
  }

  protected async process(): Promise<void> {
    const startTime = Date.now();
    
    try {
      ingestedCounter.inc(); // Increment the ingestion counter
      
      await this.runPromotionCycle();
      
      // Record successful processing time
      const duration = (Date.now() - startTime) / 1000;
      durationHistogram.observe(duration);
      
    } catch (error) {
      errorCounter.inc(); // Increment error counter
      this.logger.error('Promotion cycle failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.errorHandler?.handleError(error as Error);
      throw error;
    }
  }

  private async runPromotionCycle(): Promise<void> {
    this.logger.info('Starting promotion cycle...');
    await promoteToDailyPicks();
    this.logger.info('Promotion cycle completed successfully');
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('PromotionAgent cleanup completed');
  }

  public async checkHealth(): Promise<HealthStatus> {
    try {
      // Check if there are recent promotions in final_picks
      if (!this.supabase) {
        throw new Error('Supabase client is required for PromotionAgent');
      }
      const { data, error } = await this.supabase
        .from('final_picks')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const hasRecentActivity = data && data.length > 0 && 
        new Date(data[0]!.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000; // 24 hours

      return {
        status: hasRecentActivity ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        details: {
          hasRecentActivity,
          lastActivity: data?.[0]?.created_at
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

  public async collectMetrics(): Promise<BaseMetrics> {
    try {
      // Get promotion counts from the last 24 hours
      if (!this.supabase) {
        throw new Error('Supabase client is required for PromotionAgent');
      }
      const { data, error } = await this.supabase
        .from('final_picks')
        .select('id')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const promotionCount = data?.length || 0;
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB

      return {
        agentName: this.config.name,
        successCount: promotionCount,
        errorCount: 0, // Would need to track this separately
        warningCount: 0,
        processingTimeMs: 0, // Would need to track this
        memoryUsageMb: memoryUsage
      };

    } catch (error) {
      this.logger.error('Failed to collect metrics:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        agentName: this.config.name,
        successCount: 0,
        errorCount: 1,
        warningCount: 0,
        processingTimeMs: 0,
        memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
      };
    }
  }

  // Public method to trigger promotion
  async promotePicks(): Promise<void> {
    await this.process();
  }

  // Singleton pattern
  static getInstance(): PromotionAgent | null {
    return instance;
  }
}

// Factory function to create PromotionAgent instance
export function initializePromotionAgent(): PromotionAgent {
  // This would typically receive config and dependencies from somewhere
  const config: BaseAgentConfig = {
    name: 'PromotionAgent',
    enabled: true,
    version: '1.0.0',
    logLevel: 'info',
    metrics: {
      enabled: true,
      interval: 60
    }
  };

  // Dependencies would be injected here
  const deps: BaseAgentDependencies = {
    supabase: {} as any, // Would be actual Supabase client
    logger: {} as any,   // Would be actual logger
    errorHandler: {} as any // Would be actual error handler
  };

  instance = new PromotionAgent(config, deps);
  return instance;
}

// Legacy script for backwards compatibility
if (require.main === module) {
  const agent = initializePromotionAgent();
  (async () => {
    try {
      await (agent as any).initialize();
      await (agent as any).process();
      await (agent as any).cleanup();
    } catch (error) {
      console.error(error);
    }
  })();
}