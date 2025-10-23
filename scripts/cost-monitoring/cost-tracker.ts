/**
 * Cost Monitoring & Guardrails for Unit Talk Platform
 * Phase 6 - Performance Execution & Hardening
 *
 * Features:
 * - Connection pool monitoring and limits
 * - Query budget enforcement
 * - Daily cost summaries to Discord
 * - Real-time cost tracking
 */

/* eslint-disable max-lines */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WebhookClient } from 'discord.js';

import { createLogger } from '../../apps/api/src/utils/logger';

const logger = createLogger('CostTracker');

interface CostConfig {
  database: {
    maxConnections: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
    maxQueryTimeMs: number;
  };
  budgets: {
    dailyQueryBudget: number; // Max queries per day
    dailyCostBudget: number; // Max cost in USD per day
    hourlyRateBudget: number; // Max queries per hour
  };
  alerts: {
    discordWebhookUrl: string;
    opsAlertsChannelId: string;
    thresholds: {
      connectionUsage: number; // Alert at 80% usage
      queryBudget: number; // Alert at 90% budget
      costBudget: number; // Alert at 90% budget
    };
  };
}

interface CostMetrics {
  timestamp: string;
  database: {
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
    connectionUtilization: number;
    slowQueries: number;
    avgQueryTime: number;
  };
  usage: {
    queriesExecuted: number;
    queryBudgetUsed: number;
    estimatedCost: number;
    costBudgetUsed: number;
  };
  alerts: Array<{
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    timestamp: string;
  }>;
}

export class CostTracker {
  private supabase: SupabaseClient;
  private discordWebhook?: WebhookClient;
  private config: CostConfig;
  private metrics: CostMetrics;

  constructor(config: CostConfig) {
    this.config = config;

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        db: {
          schema: 'public',
        },
        auth: {
          persistSession: false,
        },
      }
    );

    // Initialize Discord webhook
    if (config.alerts.discordWebhookUrl) {
      this.discordWebhook = new WebhookClient({
        url: config.alerts.discordWebhookUrl,
      });
    }

    // Initialize metrics
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): CostMetrics {
    return {
      timestamp: new Date().toISOString(),
      database: {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        connectionUtilization: 0,
        slowQueries: 0,
        avgQueryTime: 0,
      },
      usage: {
        queriesExecuted: 0,
        queryBudgetUsed: 0,
        estimatedCost: 0,
        costBudgetUsed: 0,
      },
      alerts: [],
    };
  }

  /**
   * Monitor database connection pool
   */
  async monitorConnectionPool(): Promise<void> {
    try {
      // Query pg_stat_activity for connection metrics
      const { data, error } = await this.supabase.rpc('get_connection_stats');

      if (error) {
        logger.error('Failed to get connection stats', { error });
        return;
      }

      const stats = data[0];
      this.metrics.database = {
        activeConnections: stats.active_connections,
        idleConnections: stats.idle_connections,
        totalConnections: stats.total_connections,
        connectionUtilization:
          (stats.total_connections / this.config.database.maxConnections) * 100,
        slowQueries: stats.slow_queries,
        avgQueryTime: stats.avg_query_time,
      };

      // Check connection usage threshold
      if (
        this.metrics.database.connectionUtilization >= this.config.alerts.thresholds.connectionUsage
      ) {
        await this.sendAlert({
          type: 'connection_pool',
          message: `Connection pool usage at ${this.metrics.database.connectionUtilization.toFixed(1)}% (${stats.total_connections}/${this.config.database.maxConnections})`,
          severity: this.metrics.database.connectionUtilization >= 95 ? 'critical' : 'warning',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info('Connection pool metrics updated', {
        utilization: `${this.metrics.database.connectionUtilization.toFixed(1)}%`,
        active: this.metrics.database.activeConnections,
        idle: this.metrics.database.idleConnections,
      });
    } catch (error) {
      logger.error('Error monitoring connection pool', { error });
    }
  }

  /**
   * Monitor query budget and costs
   */
  async monitorQueryBudget(): Promise<void> {
    try {
      // Query pg_stat_statements for query metrics
      const { data, error } = await this.supabase.rpc('get_query_stats');

      if (error) {
        logger.error('Failed to get query stats', { error });
        return;
      }

      const stats = data[0];
      this.metrics.usage = {
        queriesExecuted: stats.total_queries,
        queryBudgetUsed: (stats.total_queries / this.config.budgets.dailyQueryBudget) * 100,
        estimatedCost: stats.estimated_cost,
        costBudgetUsed: (stats.estimated_cost / this.config.budgets.dailyCostBudget) * 100,
      };

      // Check query budget threshold
      if (this.metrics.usage.queryBudgetUsed >= this.config.alerts.thresholds.queryBudget) {
        await this.sendAlert({
          type: 'query_budget',
          message: `Query budget at ${this.metrics.usage.queryBudgetUsed.toFixed(1)}% (${stats.total_queries}/${this.config.budgets.dailyQueryBudget} queries)`,
          severity: this.metrics.usage.queryBudgetUsed >= 95 ? 'critical' : 'warning',
          timestamp: new Date().toISOString(),
        });
      }

      // Check cost budget threshold
      if (this.metrics.usage.costBudgetUsed >= this.config.alerts.thresholds.costBudget) {
        await this.sendAlert({
          type: 'cost_budget',
          message: `Cost budget at ${this.metrics.usage.costBudgetUsed.toFixed(1)}% ($${stats.estimated_cost.toFixed(2)}/$${this.config.budgets.dailyCostBudget})`,
          severity: this.metrics.usage.costBudgetUsed >= 95 ? 'critical' : 'warning',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info('Query budget metrics updated', {
        queries: stats.total_queries,
        queryBudgetUsed: `${this.metrics.usage.queryBudgetUsed.toFixed(1)}%`,
        estimatedCost: `$${stats.estimated_cost.toFixed(2)}`,
        costBudgetUsed: `${this.metrics.usage.costBudgetUsed.toFixed(1)}%`,
      });
    } catch (error) {
      logger.error('Error monitoring query budget', { error });
    }
  }

  /**
   * Send alert to Discord
   */
  private async sendAlert(alert: CostMetrics['alerts'][0]): Promise<void> {
    this.metrics.alerts.push(alert);

    if (!this.discordWebhook) {
      logger.warn('Discord webhook not configured, skipping alert');
      return;
    }

    const color =
      alert.severity === 'critical' ? 0xff0000 : alert.severity === 'warning' ? 0xffa500 : 0x00ff00;
    const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';

    try {
      await this.discordWebhook.send({
        embeds: [
          {
            title: `${emoji} Cost Alert: ${alert.type}`,
            description: alert.message,
            color,
            fields: [
              {
                name: 'Severity',
                value: alert.severity.toUpperCase(),
                inline: true,
              },
              {
                name: 'Timestamp',
                value: alert.timestamp,
                inline: true,
              },
            ],
            footer: {
              text: 'Unit Talk Cost Monitoring',
            },
          },
        ],
      });

      logger.info('Alert sent to Discord', { type: alert.type, severity: alert.severity });
    } catch (error) {
      logger.error('Failed to send Discord alert', { error });
    }
  }

  /**
   * Generate daily cost summary
   */
  async generateDailySummary(): Promise<void> {
    logger.info('Generating daily cost summary...');
    const summary = this.buildSummary();
    await this.saveSummaryToFile(summary);
    await this.sendSummaryToDiscord(summary);
    logger.info('Daily cost summary generated');
  }

  /**
   * Build cost summary object
   */
  private buildSummary() {
    return {
      date: new Date().toISOString().split('T')[0],
      database: this.metrics.database,
      usage: this.metrics.usage,
      alerts: this.metrics.alerts,
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * Save summary to file
   */
  private async saveSummaryToFile(summary: any): Promise<void> {
    const fs = require('fs');
    const path = require('path');
    const outputPath = path.join(
      process.cwd(),
      'out/ops/perf',
      `cost-summary-${summary.date}.json`
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  }

  /**
   * Send summary to Discord
   */
  private async sendSummaryToDiscord(summary: any): Promise<void> {
    if (!this.discordWebhook) return;

    await this.discordWebhook.send({
      embeds: [
        {
          title: '📊 Daily Cost Summary',
          description: `Cost and usage summary for ${summary.date}`,
          color: 0x0099ff,
          fields: this.buildSummaryFields(),
          footer: { text: 'Unit Talk Cost Monitoring' },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  /**
   * Build summary fields for Discord embed
   */
  private buildSummaryFields() {
    return [
      {
        name: 'Database Connections',
        value: `${this.metrics.database.totalConnections}/${this.config.database.maxConnections} (${this.metrics.database.connectionUtilization.toFixed(1)}%)`,
        inline: true,
      },
      {
        name: 'Queries Executed',
        value: `${this.metrics.usage.queriesExecuted.toLocaleString()} (${this.metrics.usage.queryBudgetUsed.toFixed(1)}% of budget)`,
        inline: true,
      },
      {
        name: 'Estimated Cost',
        value: `$${this.metrics.usage.estimatedCost.toFixed(2)} (${this.metrics.usage.costBudgetUsed.toFixed(1)}% of budget)`,
        inline: true,
      },
      {
        name: 'Alerts',
        value: `${this.metrics.alerts.length} alerts (${this.metrics.alerts.filter(a => a.severity === 'critical').length} critical)`,
        inline: true,
      },
    ];
  }

  /**
   * Generate cost optimization recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.database.connectionUtilization > 80) {
      recommendations.push(
        'Consider increasing connection pool size or optimizing connection usage'
      );
    }

    if (this.metrics.database.slowQueries > 100) {
      recommendations.push(
        'High number of slow queries detected - review and optimize query performance'
      );
    }

    if (this.metrics.usage.queryBudgetUsed > 90) {
      recommendations.push(
        'Query budget nearly exhausted - review query patterns and implement caching'
      );
    }

    if (this.metrics.usage.costBudgetUsed > 90) {
      recommendations.push(
        'Cost budget nearly exhausted - review resource usage and optimize costs'
      );
    }

    return recommendations;
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    logger.info('Starting cost monitoring...', { intervalMs });

    // Initial monitoring
    await this.monitorConnectionPool();
    await this.monitorQueryBudget();

    // Set up periodic monitoring
    setInterval(async () => {
      await this.monitorConnectionPool();
      await this.monitorQueryBudget();
    }, intervalMs);

    // Set up daily summary (at midnight)
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.generateDailySummary();
      // Then schedule daily
      setInterval(() => this.generateDailySummary(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    logger.info('Cost monitoring started');
  }
}

// CLI execution
if (require.main === module) {
  const config: CostConfig = {
    database: {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '50'),
      idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '300000'),
      connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '30000'),
      maxQueryTimeMs: parseInt(process.env.DB_MAX_QUERY_TIME_MS || '5000'),
    },
    budgets: {
      dailyQueryBudget: parseInt(process.env.DAILY_QUERY_BUDGET || '1000000'),
      dailyCostBudget: parseFloat(process.env.DAILY_COST_BUDGET || '100'),
      hourlyRateBudget: parseInt(process.env.HOURLY_RATE_BUDGET || '50000'),
    },
    alerts: {
      discordWebhookUrl: process.env.DISCORD_OPS_WEBHOOK_URL || '',
      opsAlertsChannelId: process.env.OPS_ALERTS_CHANNEL_ID || '',
      thresholds: {
        connectionUsage: 80,
        queryBudget: 90,
        costBudget: 90,
      },
    },
  };

  const tracker = new CostTracker(config);
  tracker.startMonitoring().catch(error => {
    logger.error('Failed to start cost monitoring', { error });
    process.exit(1);
  });
}
