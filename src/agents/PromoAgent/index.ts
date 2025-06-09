import { BaseAgent } from '../BaseAgent/index';
import { 
  BaseAgentConfig, 
  BaseAgentDependencies,
  HealthStatus,
  BaseMetrics
} from '../BaseAgent/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { PromotionConfig, PromoParams } from './types';
import { startMetricsServer, errorCounter, durationHistogram } from '../../services/metricsServer';
import { Counter, Gauge } from 'prom-client';

// Define PromoAgent-specific metrics
const promoCounter = new Counter({
  name: 'promo_agent_promotions_total',
  help: 'Total number of promotions processed',
  labelNames: ['status', 'type']
});

const activePromosGauge = new Gauge({
  name: 'promo_agent_active_promotions',
  help: 'Number of currently active promotions'
});

const appliedPromosCounter = new Counter({
  name: 'promo_agent_applied_promotions_total',
  help: 'Total number of promotions applied to users'
});

let instance: PromoAgent | null = null;

export interface PromoMetrics extends BaseMetrics {
  'custom.activePromos': number;
  'custom.totalApplied': number;
  'custom.expiredPromos': number;
  'custom.processingErrors': number;
}

export class PromoAgent extends BaseAgent {
  private metricsStarted: boolean = false;
  private activePromos: number = 0;
  private totalApplied: number = 0;
  private expiredPromos: number = 0;
  private processingErrors: number = 0;
  private lastRunTimestamp: number = 0;
  private errorList: Error[] = [];

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    this.deps.logger.info('Initializing PromoAgent...');
    
    try {
      // Start metrics server if not already started
      if (!this.metricsStarted) {
        startMetricsServer(9004); // Dedicated port for promo agent metrics
        this.metricsStarted = true;
      }
      
      await this.validateDependencies();
      await this.loadInitialMetrics();
      this.deps.logger.info('PromoAgent initialized successfully');
    } catch (error) {
      this.deps.logger.error('Failed to initialize PromoAgent:', error);
      if (error instanceof Error) {
        this.errorList.push(error);
        this.processingErrors++;
      }
      throw error;
    }
  }

  private async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const tables = ['promotions', 'users', 'promotion_applications'];
    
    for (const table of tables) {
      try {
        const { error } = await this.deps.supabase
          .from(table)
          .select('id')
          .limit(1);

        if (error) {
          throw new Error(`Failed to access ${table} table: ${error.message}`);
        }
      } catch (error) {
        this.deps.logger.error(`Database validation failed for table ${table}:`, error);
        throw new Error(`Database dependency validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async loadInitialMetrics(): Promise<void> {
    try {
      // Load current active promotions count
      const { data: activePromos, error: activeError } = await this.deps.supabase
        .from('promotions')
        .select('id')
        .eq('active', true)
        .lte('start_date', new Date().toISOString())
        .gte('end_date', new Date().toISOString());

      if (activeError) throw activeError;
      this.activePromos = activePromos?.length || 0;
      activePromosGauge.set(this.activePromos);

      // Load total applied promotions in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: appliedPromos, error: appliedError } = await this.deps.supabase
        .from('promotion_applications')
        .select('id')
        .gte('applied_at', thirtyDaysAgo.toISOString());

      if (appliedError) throw appliedError;
      this.totalApplied = appliedPromos?.length || 0;

      this.deps.logger.info('Initial metrics loaded', {
        activePromos: this.activePromos,
        totalApplied: this.totalApplied
      });
    } catch (error) {
      this.deps.logger.warn('Failed to load initial metrics:', error);
      // Non-fatal error, continue initialization
    }
  }

  protected async process(): Promise<void> {
    const stopTimer = durationHistogram.startTimer({ phase: 'promo_processing' });
    this.lastRunTimestamp = Date.now();
    this.errorList = [];
    
    try {
      this.deps.logger.info('Starting PromoAgent processing cycle');
      
      // Process any active promotions
      await this.processActivePromotions();
      
      // Clean up expired promotions
      const expiredCount = await this.cleanupExpired();
      this.expiredPromos += expiredCount;
      
      this.deps.logger.info('PromoAgent processing cycle completed', {
        activePromos: this.activePromos,
        expiredPromos: expiredCount,
        totalApplied: this.totalApplied
      });
    } catch (error) {
      this.deps.logger.error('Error in PromoAgent process:', error);
      errorCounter.inc();
      this.processingErrors++;
      
      if (error instanceof Error) {
        this.errorList.push(error);
      }
      
      throw error;
    } finally {
      stopTimer();
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

    this.activePromos = activePromos?.length || 0;
    activePromosGauge.set(this.activePromos);
    
    this.deps.logger.info(`Processing ${this.activePromos} active promotions`);

    let appliedCount = 0;
    let errorCount = 0;

    for (const promo of activePromos || []) {
      try {
        const result = await this.applyPromotion(promo);
        appliedCount += result ? 1 : 0;
        
        // Update metrics with promotion type
        promoCounter.inc({ status: 'processed', type: promo.type });
      } catch (error) {
        errorCount++;
        errorCounter.inc();
        this.processingErrors++;
        
        if (error instanceof Error) {
          this.errorList.push(error);
        }
        
        this.deps.logger.error(`Failed to process promotion ${promo.id}:`, error);
        promoCounter.inc({ status: 'error', type: promo.type });
      }
    }

    this.totalApplied += appliedCount;
    appliedPromosCounter.inc(appliedCount);
    
    this.deps.logger.info('Active promotions processed', {
      processed: activePromos?.length || 0,
      applied: appliedCount,
      errors: errorCount
    });
  }

  protected async cleanup(): Promise<void> {
    try {
      const expiredCount = await this.cleanupExpired();
      this.deps.logger.info('PromoAgent cleanup completed', {
        expiredPromos: expiredCount
      });
    } catch (error) {
      this.deps.logger.error('Error during PromoAgent cleanup:', error);
      errorCounter.inc();
      this.processingErrors++;
      
      if (error instanceof Error) {
        this.errorList.push(error);
      }
      
      throw error;
    }
  }

  protected async checkHealth(): Promise<HealthStatus> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Check database connectivity
      const { error } = await this.deps.supabase
        .from('promotions')
        .select('id')
        .limit(1);

      if (error) {
        errors.push(`Database connectivity issue: ${error.message}`);
      }
      
      // Check if we've run recently (within last 24 hours)
      const isRecentRun = Date.now() - this.lastRunTimestamp < 24 * 60 * 60 * 1000;
      if (!isRecentRun) {
        warnings.push(`No recent processing run. Last run: ${new Date(this.lastRunTimestamp).toISOString()}`);
      }
      
      // Check error rate
      if (this.processingErrors > 10) {
        warnings.push(`High error rate detected: ${this.processingErrors} errors`);
      }
      
      // Check active promotions count
      if (this.activePromos === 0) {
        warnings.push('No active promotions found');
      }
      
      // Determine overall health status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (errors.length > 0) {
        status = 'unhealthy';
      } else if (warnings.length > 0) {
        status = 'degraded';
      }
      
      return {
        status,
        timestamp: new Date().toISOString(),
        details: { 
          errors,
          warnings,
          metrics: {
            activePromos: this.activePromos,
            totalApplied: this.totalApplied,
            processingErrors: this.processingErrors,
            lastRunTimestamp: this.lastRunTimestamp ? new Date(this.lastRunTimestamp).toISOString() : null
          }
        }
      };
    } catch (error) {
      this.deps.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: { 
          errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }
      };
    }
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    try {
      // Get latest stats from the database
      const { data: promoStats, error } = await this.deps.supabase
        .from('promotions')
        .select('active, applied_count');

      if (error) throw error;

      const activeCount = promoStats?.filter(p => p.active).length || 0;
      const totalApplied = promoStats?.reduce((sum, p) => sum + (p.applied_count || 0), 0) || 0;

      // Get recent errors (last 24 hours)
      const recentErrors = this.errorList.filter(
        e => e.timestamp && Date.now() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000
      ).length;

      // Calculate processing time (if available)
      const processingTimeMs = this.lastRunTimestamp ? Date.now() - this.lastRunTimestamp : 0;

      return {
        successCount: totalApplied,
        errorCount: recentErrors,
        warningCount: 0,
        processingTimeMs,
        memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
        'custom.activePromos': activeCount,
        'custom.totalApplied': totalApplied,
        'custom.expiredPromos': this.expiredPromos,
        'custom.processingErrors': this.processingErrors
      };
    } catch (error) {
      this.deps.logger.error('Failed to collect metrics:', error);
      
      // Return basic metrics even if collection fails
      return {
        successCount: this.totalApplied,
        errorCount: this.processingErrors,
        warningCount: 0,
        processingTimeMs: 0,
        memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
        'custom.activePromos': this.activePromos,
        'custom.totalApplied': this.totalApplied,
        'custom.expiredPromos': this.expiredPromos,
        'custom.processingErrors': this.processingErrors
      };
    }
  }

  // Public methods for activities
  public async executePromotion(params: PromoParams): Promise<void> {
    const stopTimer = durationHistogram.startTimer({ phase: 'execute_promotion' });
    
    try {
      await this.validatePromo(params);
      await this.runPromotion(params);
      promoCounter.inc({ status: 'created', type: params.type });
      this.deps.logger.info('Promotion executed successfully', { name: params.name });
    } catch (error) {
      errorCounter.inc();
      this.processingErrors++;
      
      if (error instanceof Error) {
        this.errorList.push(error);
      }
      
      this.deps.logger.error('Failed to execute promotion:', error);
      throw error;
    } finally {
      stopTimer();
    }
  }

  public async validatePromo(params: PromoParams): Promise<void> {
    // Validate promotion parameters
    if (!params.name || !params.type || !params.value) {
      throw new Error('Invalid promotion parameters: missing required fields');
    }

    if (params.endDate && new Date(params.endDate) < new Date()) {
      throw new Error('Promotion end date must be in the future');
    }
    
    // Additional validations
    if (params.type === 'percentage' && (params.value <= 0 || params.value > 100)) {
      throw new Error('Percentage value must be between 0 and 100');
    }
    
    if (params.type === 'fixed' && params.value <= 0) {
      throw new Error('Fixed discount value must be greater than 0');
    }
    
    // Validate conditions if present
    if (params.conditions) {
      if (params.conditions.minAmount && params.conditions.minAmount < 0) {
        throw new Error('Minimum amount cannot be negative');
      }
      
      if (params.conditions.maxUses && params.conditions.maxUses < 1) {
        throw new Error('Maximum uses must be at least 1');
      }
    }
  }

  public async applyDiscounts(): Promise<void> {
    const stopTimer = durationHistogram.startTimer({ phase: 'apply_discounts' });
    
    try {
      await this.processActivePromotions();
      this.deps.logger.info('Discounts applied successfully');
    } catch (error) {
      errorCounter.inc();
      this.processingErrors++;
      
      if (error instanceof Error) {
        this.errorList.push(error);
      }
      
      this.deps.logger.error('Failed to apply discounts:', error);
      throw error;
    } finally {
      stopTimer();
    }
  }

  public async cleanupExpired(): Promise<number> {
    const stopTimer = durationHistogram.startTimer({ phase: 'cleanup_expired' });
    
    try {
      // Find expired promotions
      const { data, error } = await this.deps.supabase
        .from('promotions')
        .select('id')
        .eq('active', true)
        .lt('end_date', new Date().toISOString());

      if (error) {
        throw new Error(`Failed to fetch expired promotions: ${error.message}`);
      }

      const expiredCount = data?.length || 0;
      
      if (expiredCount > 0) {
        // Deactivate expired promotions
        const { error: updateError } = await this.deps.supabase
          .from('promotions')
          .update({ active: false, deactivated_at: new Date().toISOString() })
          .lt('end_date', new Date().toISOString())
          .eq('active', true);

        if (updateError) {
          throw new Error(`Failed to cleanup expired promotions: ${updateError.message}`);
        }
        
        promoCounter.inc({ status: 'expired', type: 'all' }, expiredCount);
        this.deps.logger.info(`Deactivated ${expiredCount} expired promotions`);
      }
      
      return expiredCount;
    } catch (error) {
      errorCounter.inc();
      this.processingErrors++;
      
      if (error instanceof Error) {
        this.errorList.push(error);
      }
      
      this.deps.logger.error('Failed to cleanup expired promotions:', error);
      throw error;
    } finally {
      stopTimer();
    }
  }

  private async runPromotion(config: PromotionConfig): Promise<void> {
    this.deps.logger.info('Running promotion', config.name);

    const result = await this.deps.supabase.from('promotions').insert({
      name: config.name,
      start_date: config.startDate,
      end_date: config.endDate,
      type: config.type,
      value: config.value,
      conditions: config.conditions,
      active: true,
      created_at: new Date().toISOString()
    });

    if (result.error) {
      this.deps.logger.error('Failed to insert promotion', result.error);
      throw result.error;
    }

    this.activePromos++;
    activePromosGauge.inc();
    this.deps.logger.info('Promotion recorded successfully');
  }

  private async applyPromotion(promo: any): Promise<boolean> {
    // Apply promotion logic here
    this.deps.logger.info(`Applying promotion: ${promo.name}`);
    
    try {
      // Find eligible users for this promotion
      const { data: eligibleUsers, error } = await this.deps.supabase
        .from('users')
        .select('id')
        .limit(100); // In a real implementation, would use proper filtering
      
      if (error) throw error;
      
      if (!eligibleUsers || eligibleUsers.length === 0) {
        this.deps.logger.info(`No eligible users found for promotion: ${promo.name}`);
        return false;
      }
      
      // Record promotion application
      const timestamp = new Date().toISOString();
      const applications = eligibleUsers.map(user => ({
        promotion_id: promo.id,
        user_id: user.id,
        applied_at: timestamp,
        value: promo.value,
        type: promo.type
      }));
      
      const { error: insertError } = await this.deps.supabase
        .from('promotion_applications')
        .insert(applications);
      
      if (insertError) throw insertError;
      
      // Update applied count
      const { error: updateError } = await this.deps.supabase
        .from('promotions')
        .update({ 
          applied_count: (promo.applied_count || 0) + eligibleUsers.length,
          last_applied_at: timestamp
        })
        .eq('id', promo.id);
      
      if (updateError) throw updateError;
      
      appliedPromosCounter.inc(eligibleUsers.length);
      this.deps.logger.info(`Applied promotion ${promo.name} to ${eligibleUsers.length} users`);
      
      return true;
    } catch (error) {
      this.deps.logger.error(`Failed to apply promotion ${promo.name}:`, error);
      throw error;
    }
  }

  // Public API
  public static getInstance(dependencies: BaseAgentDependencies): PromoAgent {
    if (!instance) {
      const config: BaseAgentConfig = {
        name: 'PromoAgent',
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
      instance = new PromoAgent(config, dependencies);
    }
    return instance;
  }
}

export function initializePromoAgent(dependencies: BaseAgentDependencies): PromoAgent {
  const config: BaseAgentConfig = {
    name: 'PromoAgent',
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
  return new PromoAgent(config, dependencies);
}
