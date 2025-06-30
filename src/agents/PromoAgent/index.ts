import { BaseAgent } from '../BaseAgent/index';
import {
  BaseAgentConfig,
  BaseAgentDependencies,
  HealthStatus,
  BaseMetrics
} from '../BaseAgent/types';
import { PromotionConfig, PromoParams } from './types';

let instance: PromoAgent | null = null;

export class PromoAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    this.deps.logger.info('Initializing PromoAgent...');
    
    try {
      await this.validateDependencies();
      this.deps.logger.info('PromoAgent initialized successfully');
    } catch (error) {
      this.deps.logger.error('Failed to initialize PromoAgent:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const { error } = await this.deps.supabase
      .from('promotions')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Failed to access promotions table: ${error.message}`);
    }
  }

  protected async process(): Promise<void> {
    try {
      // Process any active promotions
      await this.processActivePromotions();
      // Clean up expired promotions
      await this.cleanupExpired();
    } catch (error) {
      this.deps.logger.error('Error in PromoAgent process:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async processActivePromotions(): Promise<void> {
    const { data: activePromos, error } = await this.deps.supabase
      .from('promotions')
      .select('*')
      .eq('active', true)
      .lte('start_date', new Date().toISOString())
      .gte('end_date', new Date().toISOString());

    if (error) {
      throw new Error(`Failed to fetch active promotions: ${error.message}`);
    }

    for (const promo of activePromos || []) {
      await this.applyPromotion(promo);
    }
  }

  protected async cleanup(): Promise<void> {
    try {
      await this.cleanupExpired();
      this.deps.logger.info('PromoAgent cleanup completed');
    } catch (error) {
      this.deps.logger.error('Error during PromoAgent cleanup:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public async checkHealth(): Promise<HealthStatus> {
    const errors: string[] = [];
    
    try {
      const { error } = await this.deps.supabase
        .from('promotions')
        .select('id')
        .limit(1);

      if (error) {
        errors.push(`Database connectivity issue: ${error.message}`);
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
    const { data: promoStats } = await this.deps.supabase
      .from('promotions')
      .select('active, applied_count');

    const totalApplied = promoStats?.reduce((sum: number, p: { applied_count?: number }) => sum + (p.applied_count || 0), 0) || 0;

    return {
      agentName: 'PromoAgent',
      successCount: totalApplied,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  // Public methods for activities
  public async executePromotion(params: PromoParams): Promise<void> {
    await this.runPromotion(params);
  }

  public async validatePromo(params: PromoParams): Promise<void> {
    // Validate promotion parameters
    if (!params.name || !params.type || !params.value) {
      throw new Error('Invalid promotion parameters');
    }

    if (params.endDate && new Date(params.endDate) < new Date()) {
      throw new Error('Promotion end date must be in the future');
    }
  }

  public async applyDiscounts(): Promise<void> {
    await this.processActivePromotions();
  }

  public async cleanupExpired(): Promise<void> {
    const { error } = await this.deps.supabase
      .from('promotions')
      .update({ active: false })
      .lt('end_date', new Date().toISOString());

    if (error) {
      throw new Error(`Failed to cleanup expired promotions: ${error.message}`);
    }
  }

  private async runPromotion(config: PromotionConfig): Promise<void> {
    this.deps.logger.info('Running promotion', { name: config.name });

    const result = await this.deps.supabase.from('promotions').insert({
      name: config.name,
      start_date: config.startDate,
      end_date: config.endDate,
      type: config.type,
      value: config.value,
      conditions: config.conditions,
      active: true
    });

    if (result.error) {
      this.deps.logger.error('Failed to insert promotion', {
        error: result.error?.message || 'Unknown database error'
      });
      throw result.error;
    }

    this.deps.logger.info('Promotion recorded successfully');
  }

  private async applyPromotion(promo: any): Promise<void> {
    // Apply promotion logic here
    this.deps.logger.info(`Applying promotion: ${promo.name}`);
    
    // Update applied count
    await this.deps.supabase
      .from('promotions')
      .update({ applied_count: (promo.applied_count || 0) + 1 })
      .eq('id', promo.id);
  }

  // Public API
  public static getInstance(dependencies: BaseAgentDependencies): PromoAgent {
    if (!instance) {
      // Create a default config since logger doesn't have config property
      const config: BaseAgentConfig = {
        name: 'PromoAgent',
        enabled: true,
        version: '1.0.0',
        logLevel: 'info',
        schedule: 'manual',
        metrics: {
          enabled: true,
          interval: 60,
          port: 9090
        },
        retry: {
          enabled: true,
          maxRetries: 3,
          backoffMs: 1000,
          maxBackoffMs: 30000,
          maxAttempts: 3,
          backoff: 1000,
          exponential: true,
          jitter: false
        },
        health: {
          enabled: true,
          interval: 30,
          timeout: 5000,
          checkDb: true,
          checkExternal: false
        }
      };
      instance = new PromoAgent(config, dependencies);
    }
    return instance;
  }
}

export function initializePromoAgent(dependencies: BaseAgentDependencies): PromoAgent {
  // Create a default config since logger doesn't have config property
  const config: BaseAgentConfig = {
    name: 'PromoAgent',
    enabled: true,
    version: '1.0.0',
    logLevel: 'info',
    schedule: 'manual',
    metrics: {
      enabled: true,
      interval: 60,
      port: 9090
    },
    retry: {
      enabled: true,
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 30000,
      maxAttempts: 3,
      backoff: 1000,
      exponential: true,
      jitter: false
    },
    health: {
      enabled: true,
      interval: 30,
      timeout: 5000,
      checkDb: true,
      checkExternal: false
    }
  };
  return new PromoAgent(config, dependencies);
}