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
    this.deps.logger.info('Initializing PromotionAgent...');
    
    try {
      // Start metrics server if not already started
      if (!this.metricsStarted) {
        startMetricsServer(9001); // Dedicated port for promotion agent metrics
        this.metricsStarted = true;
      }
      
      await this.validateDependencies();
      this.deps.logger.info('PromotionAgent initialized successfully');
    } catch (error) {
      this.deps.logger.error('Failed to initialize PromotionAgent:', error);
      throw error;
    }
  }

  private async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const tables = ['graded_picks', 'final_picks'];
    
    for (const table of tables) {
      const { error } = await this.deps.supabase
        .from(table)
        .select('id')
        .limit(1);

      if (error) {
        throw new Error(`Failed to access ${table} table: ${error.message}`);
      }
    }
  }

  protected async process(): Promise<void> {
    const stopTimer = durationHistogram.startTimer({ phase: 'promotion' });
    
    try {
      await this.runPromotionCycle();
      ingestedCounter.inc();
    } catch (error) {
      errorCounter.inc();
      this.deps.logger.error('PromotionAgent error:', error);
      throw error;
    } finally {
      stopTimer();
    }
  }

  private async runPromotionCycle(): Promise<void> {
    this.deps.logger.info('Running promotion cycle...');
    await promoteToDailyPicks();
    this.deps.logger.info('Promotion cycle complete');
  }

  protected async cleanup(): Promise<void> {
    this.deps.logger.info('PromotionAgent cleanup completed');
  }

  protected async checkHealth(): Promise<HealthStatus> {
    const errors: string[] = [];
    
    try {
      // Check if we can access the promotion functions
      const { data: recentPromotions } = await this.deps.supabase
        .from('final_picks')
        .select('id')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .limit(10);

      if (!recentPromotions || recentPromotions.length === 0) {
        errors.push('No recent promotions found');
      }
    } catch (error) {
      errors.push(`Health check failed: ${error}`);
    }

    return {
      status: errors.length > 0 ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      details: { errors }
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    const { data: promotions24h } = await this.deps.supabase
      .from('final_picks')
      .select('id')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const successCount = promotions24h?.length || 0;

    return {
      agentName: 'PromotionAgent',
      successCount,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  // Public methods
  public async promotePicks(): Promise<void> {
    await this.runPromotionCycle();
  }

  // Public API
  public static getInstance(dependencies: BaseAgentDependencies): PromotionAgent {
    if (!instance) {
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
      instance = new PromotionAgent(config, dependencies);
    }
    return instance;
  }
}

export function initializePromotionAgent(dependencies: BaseAgentDependencies): PromotionAgent {
  const config = dependencies.logger?.config || {} as BaseAgentConfig;
  return new PromotionAgent(config, dependencies);
}

// Legacy script execution for backwards compatibility
if (require.main === module) {
  async function runPromotionAgent() {
    const deps: BaseAgentDependencies = {
      supabase: (await import('../../services/supabaseClient')).supabase,
      logger: console as any,
      errorHandler: null as any
    };
    
    const agent = new PromotionAgent({} as BaseAgentConfig, deps);
    await agent.initialize();
    await agent.process();
  }
  
  runPromotionAgent().catch(console.error);
}
