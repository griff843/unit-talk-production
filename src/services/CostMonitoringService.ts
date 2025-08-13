/**
 * Cost Monitoring Service - Provider usage tracking, budget enforcement, and throttling
 * Provides comprehensive cost control and anomaly detection
 */

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

export interface ProviderUsage {
  provider: string;
  service: string;
  resourceType: string;
  value: number;
  unit: string;
  metadata?: Record<string, any>;
}

export interface CostBudget {
  id: string;
  budgetName: string;
  budgetType: 'provider' | 'service' | 'environment' | 'global';
  budgetScope: string;
  monthlyBudgetUsd: number;
  currentSpendUsd: number;
  spendPercentage: number;
  enforcementMode: 'monitor' | 'throttle' | 'block';
  throttleAtPercent: number;
  blockAtPercent: number;
}

export interface RateLimit {
  provider: string;
  service: string;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  tokensPerMinute?: number;
  tokensPerHour?: number;
  isThrottled: boolean;
  throttledUntil?: Date;
}

export interface CostAlert {
  id: string;
  alertType: 'budget_exceeded' | 'threshold_reached' | 'anomaly' | 'rate_limit' | 'projection';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  provider?: string;
  service?: string;
  message: string;
  recommendation?: string;
  thresholdValue?: number;
  actualValue?: number;
}

export interface UsageAnomaly {
  id: string;
  provider: string;
  service: string;
  anomalyType: 'spike' | 'unusual_pattern' | 'new_service' | 'rate_change' | 'cost_spike';
  confidenceScore: number;
  baselineValue: number;
  anomalyValue: number;
  deviationPercent: number;
  estimatedCostImpact?: number;
}

export interface CostMetrics {
  totalSpend: number;
  dailyBurnRate: number;
  projectedMonthlySpend: number;
  budgetHealth: 'HEALTHY' | 'CAUTION' | 'WARNING' | 'CRITICAL' | 'EXCEEDED';
  topCostDrivers: Array<{
    provider: string;
    service: string;
    cost: number;
    percentage: number;
  }>;
  activeAlerts: number;
  anomaliesDetected: number;
}

interface RateLimitState {
  lastReset: Date;
  requestCount: number;
  tokenCount: number;
  throttleEndTime?: Date;
}

export class CostMonitoringService extends EventEmitter {
  private supabase: ReturnType<typeof createClient>;
  private logger: any;
  private rateLimitStates: Map<string, RateLimitState> = new Map();
  private budgetCache: Map<string, CostBudget> = new Map();
  private alertQueue: CostAlert[] = [];

  constructor(logger: any = console) {
    super();
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    this.logger = logger;
    
    // Start background monitoring
    this.startMonitoring();
  }

  /**
   * Record provider usage and check budgets
   */
  async recordUsage(usage: ProviderUsage): Promise<string> {
    this.logger.info('Recording provider usage', {
      provider: usage.provider,
      service: usage.service,
      value: usage.value
    });

    try {
      // Check rate limit first
      const allowed = await this.checkRateLimit(
        usage.provider,
        usage.service,
        1,
        usage.resourceType === 'tokens' ? usage.value : undefined
      );

      if (!allowed) {
        this.logger.warn('Rate limit exceeded, request blocked', {
          provider: usage.provider,
          service: usage.service
        });
        
        this.emit('rateLimitExceeded', {
          provider: usage.provider,
          service: usage.service,
          timestamp: new Date()
        });
        
        throw new Error(`Rate limit exceeded for ${usage.provider}/${usage.service}`);
      }

      // Record usage in database
      const { data: usageId, error } = await this.supabase.rpc('record_provider_usage', {
        p_provider_name: usage.provider,
        p_provider_service: usage.service,
        p_resource_type: usage.resourceType,
        p_usage_value: usage.value,
        p_usage_unit: usage.unit,
        p_environment: process.env.NODE_ENV || 'production',
        p_metadata: usage.metadata || {}
      });

      if (error) {
        throw new Error(`Failed to record usage: ${error.message}`);
      }

      // Check for anomalies
      await this.detectAnomaly(usage);

      // Check budget status
      const budget = await this.getBudgetStatus(usage.provider);
      if (budget) {
        await this.enforceBudget(budget);
        
        // Emit budget status
        this.emit('budgetUpdate', {
          provider: usage.provider,
          budget: budget,
          timestamp: new Date()
        });
      }

      return usageId;

    } catch (error) {
      this.logger.error('Failed to record usage', { error, usage });
      throw error;
    }
  }

  /**
   * Check rate limit for provider
   */
  async checkRateLimit(
    provider: string,
    service: string,
    requestCount: number = 1,
    tokenCount?: number
  ): Promise<boolean> {
    const key = `${provider}/${service}`;
    
    // Check local rate limit state first
    const state = this.rateLimitStates.get(key) || {
      lastReset: new Date(),
      requestCount: 0,
      tokenCount: 0
    };

    // Check if throttled
    if (state.throttleEndTime && state.throttleEndTime > new Date()) {
      return false;
    }

    // Reset counters if needed (every minute)
    const now = new Date();
    const minutesSinceReset = (now.getTime() - state.lastReset.getTime()) / 60000;
    
    if (minutesSinceReset >= 1) {
      state.lastReset = now;
      state.requestCount = 0;
      state.tokenCount = 0;
    }

    // Check database rate limit
    const { data: allowed, error } = await this.supabase.rpc('check_rate_limit', {
      p_provider_name: provider,
      p_provider_service: service,
      p_request_count: requestCount,
      p_token_count: tokenCount
    });

    if (error) {
      this.logger.error('Failed to check rate limit', { error });
      return true; // Allow on error to prevent blocking
    }

    // Update local state
    if (allowed) {
      state.requestCount += requestCount;
      state.tokenCount += tokenCount || 0;
      this.rateLimitStates.set(key, state);
    }

    return allowed;
  }

  /**
   * Get budget status for provider or service
   */
  async getBudgetStatus(scope: string): Promise<CostBudget | null> {
    // Check cache first
    const cached = this.budgetCache.get(scope);
    if (cached && (Date.now() - (cached as any).cachedAt) < 60000) {
      return cached;
    }

    const { data: budget, error } = await this.supabase
      .from('cost_budget_status')
      .select('*')
      .eq('budget_scope', scope)
      .single();

    if (error) {
      this.logger.error('Failed to get budget status', { error, scope });
      return null;
    }

    if (budget) {
      const costBudget: CostBudget = {
        id: budget.id,
        budgetName: budget.budget_name,
        budgetType: budget.budget_type,
        budgetScope: budget.budget_scope,
        monthlyBudgetUsd: budget.monthly_budget_usd,
        currentSpendUsd: budget.current_spend_usd,
        spendPercentage: budget.spend_percentage,
        enforcementMode: budget.enforcement_mode,
        throttleAtPercent: budget.throttle_at_percent || 80,
        blockAtPercent: budget.block_at_percent || 100
      };

      // Cache for 1 minute
      this.budgetCache.set(scope, { ...costBudget, cachedAt: Date.now() } as any);
      return costBudget;
    }

    return null;
  }

  /**
   * Enforce budget rules (throttling/blocking)
   */
  private async enforceBudget(budget: CostBudget): Promise<void> {
    const { spendPercentage, enforcementMode, throttleAtPercent, blockAtPercent } = budget;

    if (enforcementMode === 'monitor') {
      return; // Only monitoring, no enforcement
    }

    if (spendPercentage >= blockAtPercent && enforcementMode === 'block') {
      // Block all requests
      this.logger.error('Budget exceeded, blocking requests', {
        budget: budget.budgetName,
        spend: spendPercentage
      });

      // Update rate limits to block
      await this.blockProvider(budget.budgetScope);
      
      // Create critical alert
      await this.createAlert({
        alertType: 'budget_exceeded',
        severity: 'critical',
        provider: budget.budgetScope,
        message: `Budget exceeded for ${budget.budgetName}: ${spendPercentage.toFixed(2)}% of $${budget.monthlyBudgetUsd}`,
        recommendation: 'All requests are being blocked. Immediate action required.',
        thresholdValue: budget.monthlyBudgetUsd,
        actualValue: budget.currentSpendUsd
      });

    } else if (spendPercentage >= throttleAtPercent && enforcementMode === 'throttle') {
      // Throttle requests
      this.logger.warn('Budget threshold reached, throttling requests', {
        budget: budget.budgetName,
        spend: spendPercentage
      });

      await this.throttleProvider(budget.budgetScope);
      
      // Create high alert
      await this.createAlert({
        alertType: 'threshold_reached',
        severity: 'high',
        provider: budget.budgetScope,
        message: `Throttling enabled for ${budget.budgetName}: ${spendPercentage.toFixed(2)}% of budget consumed`,
        recommendation: 'Requests are being throttled to reduce costs.',
        thresholdValue: budget.monthlyBudgetUsd * (throttleAtPercent / 100),
        actualValue: budget.currentSpendUsd
      });
    }
  }

  /**
   * Detect usage anomalies
   */
  private async detectAnomaly(usage: ProviderUsage): Promise<void> {
    const { data: anomalyId, error } = await this.supabase.rpc('detect_usage_anomaly', {
      p_provider_name: usage.provider,
      p_provider_service: usage.service,
      p_current_value: usage.value,
      p_resource_type: usage.resourceType
    });

    if (error) {
      this.logger.error('Failed to detect anomaly', { error });
      return;
    }

    if (anomalyId) {
      this.logger.warn('Usage anomaly detected', {
        provider: usage.provider,
        service: usage.service,
        value: usage.value
      });

      this.emit('anomalyDetected', {
        anomalyId,
        provider: usage.provider,
        service: usage.service,
        value: usage.value,
        timestamp: new Date()
      });
    }
  }

  /**
   * Block provider requests
   */
  private async blockProvider(provider: string): Promise<void> {
    await this.supabase
      .from('provider_rate_limits')
      .update({
        is_throttled: true,
        throttled_until: new Date(Date.now() + 3600000).toISOString(), // Block for 1 hour
        throttle_reason: 'Budget exceeded - requests blocked',
        requests_per_minute: 0,
        updated_at: new Date().toISOString()
      })
      .eq('provider_name', provider);

    // Update local state
    const services = await this.getProviderServices(provider);
    for (const service of services) {
      const key = `${provider}/${service}`;
      const state = this.rateLimitStates.get(key) || {
        lastReset: new Date(),
        requestCount: 0,
        tokenCount: 0
      };
      state.throttleEndTime = new Date(Date.now() + 3600000);
      this.rateLimitStates.set(key, state);
    }
  }

  /**
   * Throttle provider requests
   */
  private async throttleProvider(provider: string): Promise<void> {
    // Reduce rate limits by 50%
    const { data: limits } = await this.supabase
      .from('provider_rate_limits')
      .select('*')
      .eq('provider_name', provider);

    if (limits) {
      for (const limit of limits) {
        await this.supabase
          .from('provider_rate_limits')
          .update({
            is_throttled: true,
            throttled_until: new Date(Date.now() + 1800000).toISOString(), // Throttle for 30 minutes
            throttle_reason: 'Budget threshold reached - throttling enabled',
            requests_per_minute: limit.requests_per_minute ? Math.floor(limit.requests_per_minute * 0.5) : null,
            tokens_per_minute: limit.tokens_per_minute ? Math.floor(limit.tokens_per_minute * 0.5) : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', limit.id);
      }
    }
  }

  /**
   * Get provider services
   */
  private async getProviderServices(provider: string): Promise<string[]> {
    const { data: services } = await this.supabase
      .from('provider_rate_limits')
      .select('provider_service')
      .eq('provider_name', provider);

    return services ? services.map(s => s.provider_service) : [];
  }

  /**
   * Create cost alert
   */
  private async createAlert(alert: Omit<CostAlert, 'id'>): Promise<void> {
    const { error } = await this.supabase
      .from('cost_alerts')
      .insert({
        alert_type: alert.alertType,
        severity: alert.severity,
        provider_name: alert.provider,
        service_name: alert.service,
        alert_message: alert.message,
        recommendation: alert.recommendation,
        threshold_value: alert.thresholdValue,
        actual_value: alert.actualValue
      });

    if (error) {
      this.logger.error('Failed to create alert', { error, alert });
    }

    // Queue alert for notification
    this.alertQueue.push({ ...alert, id: crypto.randomUUID() });
    
    // Emit alert event
    this.emit('alertCreated', alert);
  }

  /**
   * Get cost metrics summary
   */
  async getCostMetrics(): Promise<CostMetrics> {
    // Get overall budget status
    const { data: globalBudget } = await this.supabase
      .from('cost_budget_status')
      .select('*')
      .eq('budget_type', 'global')
      .single();

    // Get top cost drivers
    const { data: topDrivers } = await this.supabase
      .from('top_cost_drivers')
      .select('*')
      .limit(5);

    // Get active alerts count
    const { data: alerts } = await this.supabase
      .from('cost_alerts')
      .select('id')
      .eq('status', 'open');

    // Get recent anomalies
    const { data: anomalies } = await this.supabase
      .from('usage_anomalies')
      .select('id')
      .eq('investigated', false)
      .gte('detected_at', new Date(Date.now() - 86400000).toISOString());

    const totalSpend = globalBudget?.current_spend_usd || 0;
    const dailyBurnRate = globalBudget?.daily_burn_rate_usd || 0;
    const projectedMonthlySpend = globalBudget?.projected_monthly_spend_usd || 0;
    const budgetHealth = globalBudget?.budget_health || 'HEALTHY';

    return {
      totalSpend,
      dailyBurnRate,
      projectedMonthlySpend,
      budgetHealth,
      topCostDrivers: topDrivers?.map(d => ({
        provider: d.provider_name,
        service: d.provider_service,
        cost: d.total_cost_usd,
        percentage: (d.total_cost_usd / totalSpend) * 100
      })) || [],
      activeAlerts: alerts?.length || 0,
      anomaliesDetected: anomalies?.length || 0
    };
  }

  /**
   * Get usage history
   */
  async getUsageHistory(
    provider?: string,
    days: number = 30
  ): Promise<any[]> {
    let query = this.supabase
      .from('provider_usage_summary')
      .select('*')
      .gte('usage_date', new Date(Date.now() - days * 86400000).toISOString())
      .order('usage_date', { ascending: false });

    if (provider) {
      query = query.eq('provider_name', provider);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get usage history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get cost alerts
   */
  async getAlerts(
    status: 'open' | 'acknowledged' | 'resolved' = 'open',
    limit: number = 50
  ): Promise<CostAlert[]> {
    const { data: alerts, error } = await this.supabase
      .from('cost_alerts')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get alerts: ${error.message}`);
    }

    return alerts?.map(a => ({
      id: a.id,
      alertType: a.alert_type,
      severity: a.severity,
      provider: a.provider_name,
      service: a.service_name,
      message: a.alert_message,
      recommendation: a.recommendation,
      thresholdValue: a.threshold_value,
      actualValue: a.actual_value
    })) || [];
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('cost_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: acknowledgedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (error) {
      throw new Error(`Failed to acknowledge alert: ${error.message}`);
    }
  }

  /**
   * Update budget
   */
  async updateBudget(
    budgetScope: string,
    updates: Partial<{
      monthlyBudgetUsd: number;
      throttleAtPercent: number;
      blockAtPercent: number;
      enforcementMode: 'monitor' | 'throttle' | 'block';
    }>
  ): Promise<void> {
    const updateData: any = { updated_at: new Date().toISOString() };

    if (updates.monthlyBudgetUsd !== undefined) {
      updateData.monthly_budget_usd = updates.monthlyBudgetUsd;
    }
    if (updates.throttleAtPercent !== undefined) {
      updateData.throttle_at_percent = updates.throttleAtPercent;
    }
    if (updates.blockAtPercent !== undefined) {
      updateData.block_at_percent = updates.blockAtPercent;
    }
    if (updates.enforcementMode !== undefined) {
      updateData.enforcement_mode = updates.enforcementMode;
    }

    const { error } = await this.supabase
      .from('cost_budgets')
      .update(updateData)
      .eq('budget_scope', budgetScope);

    if (error) {
      throw new Error(`Failed to update budget: ${error.message}`);
    }

    // Clear cache
    this.budgetCache.delete(budgetScope);
  }

  /**
   * Process alert queue
   */
  private async processAlertQueue(): Promise<void> {
    while (this.alertQueue.length > 0) {
      const alert = this.alertQueue.shift();
      if (alert) {
        // Send notifications based on severity
        if (alert.severity === 'critical') {
          await this.sendCriticalNotification(alert);
        } else if (alert.severity === 'high') {
          await this.sendHighPriorityNotification(alert);
        }
      }
    }
  }

  /**
   * Send critical notification
   */
  private async sendCriticalNotification(alert: CostAlert): Promise<void> {
    this.logger.error('CRITICAL COST ALERT', alert);
    
    // TODO: Integrate with notification service (Discord, email, etc.)
    this.emit('criticalAlert', alert);
  }

  /**
   * Send high priority notification
   */
  private async sendHighPriorityNotification(alert: CostAlert): Promise<void> {
    this.logger.warn('HIGH PRIORITY COST ALERT', alert);
    
    // TODO: Integrate with notification service
    this.emit('highPriorityAlert', alert);
  }

  /**
   * Start background monitoring
   */
  private startMonitoring(): void {
    // Process alert queue every 30 seconds
    setInterval(() => {
      this.processAlertQueue();
    }, 30000);

    // Refresh budget cache every 5 minutes
    setInterval(() => {
      this.budgetCache.clear();
    }, 300000);

    // Check for anomalies every hour
    setInterval(async () => {
      try {
        const metrics = await this.getCostMetrics();
        this.emit('metricsUpdate', metrics);
      } catch (error) {
        this.logger.error('Failed to update metrics', { error });
      }
    }, 3600000);
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(): Promise<RateLimit[]> {
    const { data: limits, error } = await this.supabase
      .from('rate_limit_status')
      .select('*');

    if (error) {
      throw new Error(`Failed to get rate limit status: ${error.message}`);
    }

    return limits?.map(l => ({
      provider: l.provider_name,
      service: l.provider_service,
      requestsPerMinute: l.rpm_limit,
      requestsPerHour: l.requests_per_hour,
      requestsPerDay: l.requests_per_day,
      tokensPerMinute: l.tpm_limit,
      tokensPerHour: l.tokens_per_hour,
      isThrottled: l.is_throttled,
      throttledUntil: l.throttled_until ? new Date(l.throttled_until) : undefined
    })) || [];
  }

  /**
   * Get anomalies
   */
  async getAnomalies(investigated: boolean = false): Promise<UsageAnomaly[]> {
    const { data: anomalies, error } = await this.supabase
      .from('usage_anomalies')
      .select('*')
      .eq('investigated', investigated)
      .order('detected_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to get anomalies: ${error.message}`);
    }

    return anomalies?.map(a => ({
      id: a.id,
      provider: a.provider_name,
      service: a.provider_service,
      anomalyType: a.anomaly_type,
      confidenceScore: a.confidence_score,
      baselineValue: a.baseline_value,
      anomalyValue: a.anomaly_value,
      deviationPercent: a.deviation_percent,
      estimatedCostImpact: a.estimated_cost_impact
    })) || [];
  }
}

// Export for easy integration
export async function createCostMonitoringService(logger?: any): Promise<CostMonitoringService> {
  return new CostMonitoringService(logger);
}