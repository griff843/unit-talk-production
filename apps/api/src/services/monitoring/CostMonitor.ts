import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../logger';
import { WebhookClient } from 'discord.js';

export interface ResourceUsage {
  timestamp: Date;
  service: string;
  cpu: number;
  memory: number;
  storage: number;
  bandwidth: number;
  requests: number;
}

export interface CostEstimate {
  service: string;
  daily: number;
  monthly: number;
  breakdown: {
    compute: number;
    storage: number;
    bandwidth: number;
    database: number;
  };
}

export interface CostAlert {
  type: 'threshold' | 'anomaly' | 'forecast';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  currentSpend: number;
  threshold?: number;
  recommendation?: string;
}

export class CostMonitor {
  private logger: Logger;
  private supabase: SupabaseClient;
  private discordWebhook?: WebhookClient;
  
  // Cost configuration (per unit)
  private costConfig = {
    compute: {
      cpu: 0.05, // per vCPU hour
      memory: 0.01, // per GB hour
    },
    storage: {
      database: 0.15, // per GB month
      object: 0.02, // per GB month
    },
    bandwidth: {
      egress: 0.09, // per GB
      ingress: 0, // typically free
    },
    supabase: {
      tier: 'pro', // pro, team, or enterprise
      baseCost: 25, // monthly base
      overageRequests: 0.00001, // per request over limit
      overageStorage: 0.125, // per GB over limit
      overageBandwidth: 0.09, // per GB over limit
    },
  };

  constructor(
    supabase: SupabaseClient,
    webhookUrl?: string
  ) {
    this.supabase = supabase;
    this.logger = new Logger('CostMonitor');
    
    if (webhookUrl) {
      this.discordWebhook = new WebhookClient({ url: webhookUrl });
    }
  }

  /**
   * Collect resource usage metrics
   */
  async collectResourceUsage(): Promise<ResourceUsage[]> {
    const usage: ResourceUsage[] = [];

    try {
      // Collect API service usage
      const apiUsage = await this.getServiceUsage('api');
      usage.push(apiUsage);

      // Collect worker usage
      const workerUsage = await this.getServiceUsage('worker');
      usage.push(workerUsage);

      // Collect database usage
      const dbUsage = await this.getDatabaseUsage();
      usage.push(dbUsage);

      // Store metrics
      await this.storeUsageMetrics(usage);

      return usage;
    } catch (error) {
      this.logger.error('Failed to collect resource usage:', error);
      return usage;
    }
  }

  /**
   * Calculate cost estimates
   */
  async calculateCosts(): Promise<CostEstimate[]> {
    const estimates: CostEstimate[] = [];

    try {
      // Get last 24 hours of usage
      const { data: usage } = await this.supabase
        .from('resource_usage')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 86400000).toISOString())
        .order('timestamp', { ascending: false });

      if (!usage) return estimates;

      // Group by service
      const serviceUsage = this.groupByService(usage);

      for (const [service, metrics] of Object.entries(serviceUsage)) {
        const estimate = this.calculateServiceCost(service, metrics);
        estimates.push(estimate);
      }

      // Add Supabase costs
      const supabaseEstimate = await this.calculateSupabaseCosts();
      estimates.push(supabaseEstimate);

      return estimates;
    } catch (error) {
      this.logger.error('Failed to calculate costs:', error);
      return estimates;
    }
  }

  /**
   * Monitor costs and generate alerts
   */
  async monitorCosts(): Promise<CostAlert[]> {
    const alerts: CostAlert[] = [];

    try {
      const estimates = await this.calculateCosts();
      const totalDaily = estimates.reduce((sum, e) => sum + e.daily, 0);
      const totalMonthly = estimates.reduce((sum, e) => sum + e.monthly, 0);

      // Check against thresholds
      const thresholds = {
        daily: { warning: 100, critical: 200 },
        monthly: { warning: 2000, critical: 3000 },
      };

      if (totalDaily > thresholds.daily.critical) {
        alerts.push({
          type: 'threshold',
          severity: 'critical',
          message: `Daily spend ($${totalDaily.toFixed(2)}) exceeds critical threshold`,
          currentSpend: totalDaily,
          threshold: thresholds.daily.critical,
          recommendation: 'Immediate action required: Scale down non-critical services',
        });
      } else if (totalDaily > thresholds.daily.warning) {
        alerts.push({
          type: 'threshold',
          severity: 'high',
          message: `Daily spend ($${totalDaily.toFixed(2)}) exceeds warning threshold`,
          currentSpend: totalDaily,
          threshold: thresholds.daily.warning,
          recommendation: 'Review resource usage and optimize where possible',
        });
      }

      // Check for anomalies
      const anomalies = await this.detectAnomalies(estimates);
      alerts.push(...anomalies);

      // Forecast alerts
      const forecast = this.forecastCosts(totalDaily);
      if (forecast.projectedMonthly > thresholds.monthly.warning) {
        alerts.push({
          type: 'forecast',
          severity: 'medium',
          message: `Projected monthly spend ($${forecast.projectedMonthly.toFixed(2)}) exceeds budget`,
          currentSpend: totalMonthly,
          threshold: thresholds.monthly.warning,
          recommendation: 'Current trajectory will exceed monthly budget',
        });
      }

      // Send alerts
      for (const alert of alerts) {
        await this.sendAlert(alert);
      }

      return alerts;
    } catch (error) {
      this.logger.error('Cost monitoring failed:', error);
      return alerts;
    }
  }

  /**
   * Generate cost optimization recommendations
   */
  async generateOptimizationReport(): Promise<string> {
    const report: string[] = [];
    
    report.push('# Cost Optimization Report');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('');

    // Current costs
    const estimates = await this.calculateCosts();
    const totalDaily = estimates.reduce((sum, e) => sum + e.daily, 0);
    const totalMonthly = estimates.reduce((sum, e) => sum + e.monthly, 0);

    report.push('## Current Costs');
    report.push(`- Daily: $${totalDaily.toFixed(2)}`);
    report.push(`- Monthly (projected): $${totalMonthly.toFixed(2)}`);
    report.push('');

    // Breakdown by service
    report.push('## Cost Breakdown');
    for (const estimate of estimates) {
      report.push(`### ${estimate.service}`);
      report.push(`- Daily: $${estimate.daily.toFixed(2)}`);
      report.push(`- Monthly: $${estimate.monthly.toFixed(2)}`);
      report.push('- Breakdown:');
      report.push(`  - Compute: $${estimate.breakdown.compute.toFixed(2)}`);
      report.push(`  - Storage: $${estimate.breakdown.storage.toFixed(2)}`);
      report.push(`  - Bandwidth: $${estimate.breakdown.bandwidth.toFixed(2)}`);
      report.push(`  - Database: $${estimate.breakdown.database.toFixed(2)}`);
      report.push('');
    }

    // Optimization recommendations
    report.push('## Optimization Recommendations');
    
    const recommendations = await this.generateRecommendations(estimates);
    for (const rec of recommendations) {
      report.push(`- **${rec.area}**: ${rec.recommendation}`);
      report.push(`  - Potential savings: $${rec.savings.toFixed(2)}/month`);
      report.push(`  - Implementation: ${rec.implementation}`);
      report.push('');
    }

    // Resource efficiency
    report.push('## Resource Efficiency');
    const efficiency = await this.calculateResourceEfficiency();
    report.push(`- CPU Utilization: ${efficiency.cpu.toFixed(1)}%`);
    report.push(`- Memory Utilization: ${efficiency.memory.toFixed(1)}%`);
    report.push(`- Storage Efficiency: ${efficiency.storage.toFixed(1)}%`);
    report.push('');

    // Historical trends
    report.push('## Cost Trends (Last 30 Days)');
    const trends = await this.analyzeCostTrends();
    report.push(`- Average daily: $${trends.avgDaily.toFixed(2)}`);
    report.push(`- Trend: ${trends.trend}`);
    report.push(`- Peak day: ${trends.peakDay} ($${trends.peakCost.toFixed(2)})`);

    return report.join('\n');
  }

  /**
   * Get service resource usage
   */
  private async getServiceUsage(service: string): Promise<ResourceUsage> {
    // In production, this would query actual metrics
    // For now, simulated data
    return {
      timestamp: new Date(),
      service,
      cpu: Math.random() * 4, // vCPUs
      memory: Math.random() * 16, // GB
      storage: Math.random() * 100, // GB
      bandwidth: Math.random() * 50, // GB
      requests: Math.floor(Math.random() * 1000000),
    };
  }

  /**
   * Get database usage
   */
  private async getDatabaseUsage(): Promise<ResourceUsage> {
    try {
      const { data } = await this.supabase.rpc('get_database_size');
      
      return {
        timestamp: new Date(),
        service: 'database',
        cpu: 2, // Estimated based on tier
        memory: 8, // Estimated based on tier
        storage: data?.size_gb || 0,
        bandwidth: 0, // Included in API bandwidth
        requests: 0, // Tracked separately
      };
    } catch (error) {
      this.logger.error('Failed to get database usage:', error);
      return {
        timestamp: new Date(),
        service: 'database',
        cpu: 0,
        memory: 0,
        storage: 0,
        bandwidth: 0,
        requests: 0,
      };
    }
  }

  /**
   * Store usage metrics
   */
  private async storeUsageMetrics(usage: ResourceUsage[]): Promise<void> {
    try {
      await this.supabase
        .from('resource_usage')
        .insert(usage.map(u => ({
          ...u,
          timestamp: u.timestamp.toISOString(),
        })));
    } catch (error) {
      this.logger.error('Failed to store usage metrics:', error);
    }
  }

  /**
   * Group usage by service
   */
  private groupByService(usage: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const metric of usage) {
      if (!grouped[metric.service]) {
        grouped[metric.service] = [];
      }
      grouped[metric.service].push(metric);
    }
    
    return grouped;
  }

  /**
   * Calculate service cost
   */
  private calculateServiceCost(service: string, metrics: any[]): CostEstimate {
    let computeCost = 0;
    let storageCost = 0;
    let bandwidthCost = 0;
    
    for (const metric of metrics) {
      // Compute costs (hourly)
      computeCost += metric.cpu * this.costConfig.compute.cpu;
      computeCost += metric.memory * this.costConfig.compute.memory;
      
      // Storage costs (convert to monthly)
      storageCost += (metric.storage * this.costConfig.storage.database) / 730;
      
      // Bandwidth costs
      bandwidthCost += metric.bandwidth * this.costConfig.bandwidth.egress;
    }
    
    const daily = computeCost + storageCost + bandwidthCost;
    
    return {
      service,
      daily,
      monthly: daily * 30,
      breakdown: {
        compute: computeCost * 30,
        storage: storageCost * 30,
        bandwidth: bandwidthCost * 30,
        database: 0, // Included in Supabase costs
      },
    };
  }

  /**
   * Calculate Supabase costs
   */
  private async calculateSupabaseCosts(): Promise<CostEstimate> {
    const config = this.costConfig.supabase;
    let monthlyCost = config.baseCost;
    
    // Get usage statistics
    const { data: stats } = await this.supabase.rpc('get_usage_statistics');
    
    if (stats) {
      // Calculate overages
      const limits = this.getSupabaseLimits(config.tier);
      
      if (stats.requests > limits.requests) {
        const overage = stats.requests - limits.requests;
        monthlyCost += overage * config.overageRequests;
      }
      
      if (stats.storage_gb > limits.storage) {
        const overage = stats.storage_gb - limits.storage;
        monthlyCost += overage * config.overageStorage;
      }
      
      if (stats.bandwidth_gb > limits.bandwidth) {
        const overage = stats.bandwidth_gb - limits.bandwidth;
        monthlyCost += overage * config.overageBandwidth;
      }
    }
    
    return {
      service: 'supabase',
      daily: monthlyCost / 30,
      monthly: monthlyCost,
      breakdown: {
        compute: 0, // Included in base
        storage: (monthlyCost - config.baseCost) * 0.4,
        bandwidth: (monthlyCost - config.baseCost) * 0.3,
        database: config.baseCost + (monthlyCost - config.baseCost) * 0.3,
      },
    };
  }

  /**
   * Get Supabase tier limits
   */
  private getSupabaseLimits(tier: string): any {
    const limits = {
      pro: {
        requests: 50000000, // 50M/month
        storage: 100, // GB
        bandwidth: 250, // GB
      },
      team: {
        requests: 100000000, // 100M/month
        storage: 500, // GB
        bandwidth: 1000, // GB
      },
    };
    
    return limits[tier] || limits.pro;
  }

  /**
   * Detect cost anomalies
   */
  private async detectAnomalies(estimates: CostEstimate[]): Promise<CostAlert[]> {
    const alerts: CostAlert[] = [];
    
    // Get historical averages
    const { data: history } = await this.supabase
      .from('cost_history')
      .select('*')
      .gte('date', new Date(Date.now() - 30 * 86400000).toISOString())
      .order('date', { ascending: false });
    
    if (!history || history.length < 7) return alerts;
    
    // Calculate averages
    const avgByService: Record<string, number> = {};
    
    for (const record of history) {
      if (!avgByService[record.service]) {
        avgByService[record.service] = 0;
      }
      avgByService[record.service] += record.daily_cost;
    }
    
    // Check for anomalies (>50% increase)
    for (const estimate of estimates) {
      const avg = avgByService[estimate.service] / history.length;
      const increase = ((estimate.daily - avg) / avg) * 100;
      
      if (increase > 50) {
        alerts.push({
          type: 'anomaly',
          severity: 'high',
          message: `${estimate.service} costs increased by ${increase.toFixed(0)}%`,
          currentSpend: estimate.daily,
          recommendation: `Investigate ${estimate.service} resource usage spike`,
        });
      }
    }
    
    return alerts;
  }

  /**
   * Forecast future costs
   */
  private forecastCosts(
    currentDaily: number
  ): { projectedMonthly: number; confidence: number } {
    // Simple linear projection
    const daysInMonth = 30;
    const dayOfMonth = new Date().getDate();
    const remainingDays = daysInMonth - dayOfMonth;
    
    const projectedMonthly = (currentDaily * dayOfMonth) + (currentDaily * remainingDays * 1.1); // 10% growth factor
    
    return {
      projectedMonthly,
      confidence: dayOfMonth > 15 ? 0.8 : 0.5, // Higher confidence later in month
    };
  }

  /**
   * Generate optimization recommendations
   */
  private async generateRecommendations(
    estimates: CostEstimate[]
  ): Promise<any[]> {
    const recommendations = [];
    
    // Check for underutilized resources
    const efficiency = await this.calculateResourceEfficiency();
    
    if (efficiency.cpu < 50) {
      recommendations.push({
        area: 'Compute',
        recommendation: 'CPU utilization is low, consider reducing instance sizes',
        savings: estimates.reduce((sum, e) => sum + e.breakdown.compute, 0) * 0.3,
        implementation: 'Reduce replica counts or use smaller instance types',
      });
    }
    
    if (efficiency.memory < 60) {
      recommendations.push({
        area: 'Memory',
        recommendation: 'Memory utilization is low, optimize container limits',
        savings: estimates.reduce((sum, e) => sum + e.breakdown.compute, 0) * 0.2,
        implementation: 'Adjust memory limits in Kubernetes deployments',
      });
    }
    
    // Check for expensive queries
    const { data: slowQueries } = await this.supabase.rpc('get_expensive_queries');
    if (slowQueries && slowQueries.length > 0) {
      recommendations.push({
        area: 'Database',
        recommendation: 'Optimize expensive queries to reduce database load',
        savings: estimates.find(e => e.service === 'supabase')?.monthly || 0 * 0.15,
        implementation: 'Add indexes and optimize query patterns',
      });
    }
    
    return recommendations;
  }

  /**
   * Calculate resource efficiency
   */
  private async calculateResourceEfficiency(): Promise<{
    cpu: number;
    memory: number;
    storage: number;
  }> {
    // In production, query actual metrics
    // Simulated for now
    return {
      cpu: 45 + Math.random() * 30,
      memory: 50 + Math.random() * 30,
      storage: 70 + Math.random() * 20,
    };
  }

  /**
   * Analyze cost trends
   */
  private async analyzeCostTrends(): Promise<any> {
    const { data: history } = await this.supabase
      .from('cost_history')
      .select('*')
      .gte('date', new Date(Date.now() - 30 * 86400000).toISOString())
      .order('date', { ascending: true });
    
    if (!history || history.length === 0) {
      return {
        avgDaily: 0,
        trend: 'insufficient data',
        peakDay: 'N/A',
        peakCost: 0,
      };
    }
    
    const dailyCosts = history.map(h => h.total_daily);
    const avgDaily = dailyCosts.reduce((a, b) => a + b, 0) / dailyCosts.length;
    
    // Find peak
    let peakCost = 0;
    let peakDay = '';
    for (const record of history) {
      if (record.total_daily > peakCost) {
        peakCost = record.total_daily;
        peakDay = new Date(record.date).toLocaleDateString();
      }
    }
    
    // Calculate trend
    const firstWeek = dailyCosts.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
    const lastWeek = dailyCosts.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const change = ((lastWeek - firstWeek) / firstWeek) * 100;
    
    let trend = 'stable';
    if (change > 10) trend = `increasing (+${change.toFixed(0)}%)`;
    if (change < -10) trend = `decreasing (${change.toFixed(0)}%)`;
    
    return {
      avgDaily,
      trend,
      peakDay,
      peakCost,
    };
  }

  /**
   * Send cost alert
   */
  private async sendAlert(alert: CostAlert): Promise<void> {
    this.logger.warn(`Cost alert: ${alert.message}`);
    
    // Store alert
    await this.supabase
      .from('cost_alerts')
      .insert({
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        current_spend: alert.currentSpend,
        threshold: alert.threshold,
        recommendation: alert.recommendation,
        created_at: new Date().toISOString(),
      });
    
    // Send to Discord if configured
    if (this.discordWebhook && alert.severity !== 'low') {
      const color = {
        medium: 0xFFA500,
        high: 0xFF6347,
        critical: 0xFF0000,
      }[alert.severity] || 0xFFA500;
      
      await this.discordWebhook.send({
        embeds: [{
          title: `Cost Alert: ${alert.severity.toUpperCase()}`,
          description: alert.message,
          color,
          fields: [
            {
              name: 'Current Spend',
              value: `$${alert.currentSpend.toFixed(2)}`,
              inline: true,
            },
            {
              name: 'Threshold',
              value: alert.threshold ? `$${alert.threshold.toFixed(2)}` : 'N/A',
              inline: true,
            },
            {
              name: 'Recommendation',
              value: alert.recommendation || 'Monitor closely',
            },
          ],
          timestamp: new Date().toISOString(),
        }],
      });
    }
  }
}