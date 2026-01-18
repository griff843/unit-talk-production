/**
 * Revenue Alert Agent
 * Monitors usage overages, payment failures, and churn risk
 * 
 * Phase 15: Analytics and Monetization Engine
 * Date: 2025-01-25
 */

import { BaseAgent, BaseMetrics, BaseAgentConfig, BaseAgentDependencies } from '../BaseAgent';

interface RevenueAlertMetrics extends BaseMetrics {
  overageAlertsTriggered: number;
  churnRiskAlertsTriggered: number;
  paymentFailureAlertsTriggered: number;
  trialEndingAlertsTriggered: number;
}

interface UsageOverage {
  userId: string;
  resourceType: string;
  currentUsage: number;
  limit: number;
  overageAmount: number;
  overagePercentage: number;
}

interface ChurnRiskUser {
  userId: string;
  username: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
}

export class RevenueAlertAgent extends BaseAgent {
  declare protected metrics: RevenueAlertMetrics;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    this.metrics = {
      agentName: config.name,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0,
      overageAlertsTriggered: 0,
      churnRiskAlertsTriggered: 0,
      paymentFailureAlertsTriggered: 0,
      trialEndingAlertsTriggered: 0,
    };
  }

  protected async initialize(): Promise<void> {
    // Initialize revenue alert monitoring
  }

  protected async process(): Promise<void> {
    const startTime = Date.now();

    try {
      // Check for usage overages
      await this.checkUsageOverages();

      // Check for churn risk
      await this.checkChurnRisk();

      // Check for payment failures
      await this.checkPaymentFailures();

      // Check for trials ending soon
      await this.checkTrialsEndingSoon();

      this.metrics.successCount++;
      this.metrics.processingTimeMs = Date.now() - startTime;

      this.logger.info('Revenue alert check completed', {
        duration: this.metrics.processingTimeMs,
        overageAlerts: this.metrics.overageAlertsTriggered,
        churnAlerts: this.metrics.churnRiskAlertsTriggered,
        paymentAlerts: this.metrics.paymentFailureAlertsTriggered,
        trialAlerts: this.metrics.trialEndingAlertsTriggered,
      });
    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error('Revenue alert check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check for users exceeding usage limits
   */
  private async checkUsageOverages(): Promise<void> {
    try {
      // Get all active subscriptions with usage data
      const { data: subscriptions, error } = await this.supabase
        .from('user_subscriptions')
        .select('user_id, usage_this_period, plan_id, subscription_plans(limits, name)')
        .in('status', ['active', 'trialing']);

      if (error) throw error;

      const overages: UsageOverage[] = [];

      for (const sub of subscriptions || []) {
        const usage = sub.usage_this_period || {};
        const limits = (sub.subscription_plans as any)?.limits || {};

        // Check each resource type
        for (const [resourceType, limit] of Object.entries(limits)) {
          const limitValue = limit as number;
          if (limitValue === -1) continue; // Unlimited

          const currentUsage = usage[resourceType] || 0;
          const overageAmount = currentUsage - limitValue;

          if (overageAmount > 0) {
            const overagePercentage = (overageAmount / limitValue) * 100;

            overages.push({
              userId: sub.user_id,
              resourceType,
              currentUsage,
              limit: limitValue,
              overageAmount,
              overagePercentage,
            });
          }
        }
      }

      // Send alerts for overages
      for (const overage of overages) {
        await this.sendOverageAlert(overage);
        this.metrics.overageAlertsTriggered++;
      }

      if (overages.length > 0) {
        this.logger.info('Usage overages detected', { count: overages.length });
      }
    } catch (error) {
      this.logger.error('Failed to check usage overages', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check for users at risk of churning
   */
  private async checkChurnRisk(): Promise<void> {
    try {
      // Get unresolved churn risk scores
      const { data: churnRisks, error } = await this.supabase
        .from('churn_risk_scores')
        .select('*, users(username, email)')
        .eq('resolved', false)
        .eq('alert_sent', false)
        .in('risk_level', ['high', 'critical'])
        .order('risk_score', { ascending: false });

      if (error) throw error;

      for (const risk of churnRisks || []) {
        const churnRiskUser: ChurnRiskUser = {
          userId: risk.user_id,
          username: (risk.users as any)?.username || 'Unknown',
          riskScore: risk.risk_score,
          riskLevel: risk.risk_level,
          factors: Object.entries(risk.factors || {})
            .filter(([_, value]) => value === true)
            .map(([key]) => key),
        };

        await this.sendChurnRiskAlert(churnRiskUser);

        // Mark alert as sent
        await this.supabase
          .from('churn_risk_scores')
          .update({ alert_sent: true, alert_sent_at: new Date().toISOString() })
          .eq('id', risk.id);

        this.metrics.churnRiskAlertsTriggered++;
      }

      if (churnRisks && churnRisks.length > 0) {
        this.logger.info('Churn risk alerts sent', { count: churnRisks.length });
      }
    } catch (error) {
      this.logger.error('Failed to check churn risk', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check for payment failures
   */
  private async checkPaymentFailures(): Promise<void> {
    try {
      // Get subscriptions with past_due status
      const { data: pastDueSubscriptions, error } = await this.supabase
        .from('user_subscriptions')
        .select('*, users(username, email)')
        .eq('status', 'past_due');

      if (error) throw error;

      for (const sub of pastDueSubscriptions || []) {
        await this.sendPaymentFailureAlert({
          userId: sub.user_id,
          username: (sub.users as any)?.username || 'Unknown',
          email: (sub.users as any)?.email,
          subscriptionId: sub.id,
          currentPeriodEnd: new Date(sub.current_period_end),
        });

        this.metrics.paymentFailureAlertsTriggered++;
      }

      if (pastDueSubscriptions && pastDueSubscriptions.length > 0) {
        this.logger.info('Payment failure alerts sent', { count: pastDueSubscriptions.length });
      }
    } catch (error) {
      this.logger.error('Failed to check payment failures', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check for trials ending soon (within 3 days)
   */
  private async checkTrialsEndingSoon(): Promise<void> {
    try {
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const { data: endingTrials, error } = await this.supabase
        .from('user_subscriptions')
        .select('*, users(username, email), subscription_plans(name)')
        .eq('status', 'trialing')
        .lte('trial_end', threeDaysFromNow.toISOString())
        .gte('trial_end', new Date().toISOString());

      if (error) throw error;

      for (const sub of endingTrials || []) {
        await this.sendTrialEndingAlert({
          userId: sub.user_id,
          username: (sub.users as any)?.username || 'Unknown',
          email: (sub.users as any)?.email,
          planName: (sub.subscription_plans as any)?.name || 'Unknown',
          trialEnd: new Date(sub.trial_end),
        });

        this.metrics.trialEndingAlertsTriggered++;
      }

      if (endingTrials && endingTrials.length > 0) {
        this.logger.info('Trial ending alerts sent', { count: endingTrials.length });
      }
    } catch (error) {
      this.logger.error('Failed to check trials ending soon', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send overage alert
   */
  private async sendOverageAlert(overage: UsageOverage): Promise<void> {
    const message = `🚨 **Usage Overage Alert**

User: ${overage.userId}
Resource: ${overage.resourceType}
Current Usage: ${overage.currentUsage}
Limit: ${overage.limit}
Overage: ${overage.overageAmount} (${overage.overagePercentage.toFixed(1)}%)

Action Required: Contact user about upgrading plan or reducing usage.`;

    await this.sendSlackAlert(message, 'warning');

    this.logger.warn('Usage overage detected', {
      userId: overage.userId,
      resourceType: overage.resourceType,
      overagePercentage: overage.overagePercentage,
    });
  }

  /**
   * Send churn risk alert
   */
  private async sendChurnRiskAlert(user: ChurnRiskUser): Promise<void> {
    const emoji = user.riskLevel === 'critical' ? '🔴' : '🟡';
    const message = `${emoji} **Churn Risk Alert**

User: ${user.username} (${user.userId})
Risk Level: ${user.riskLevel.toUpperCase()}
Risk Score: ${user.riskScore}/100

Contributing Factors:
${user.factors.map((f) => `• ${f.replace(/_/g, ' ')}`).join('\n')}

Action Required: Reach out to user to address concerns and prevent churn.`;

    await this.sendSlackAlert(message, user.riskLevel === 'critical' ? 'error' : 'warning');

    this.logger.warn('Churn risk detected', {
      userId: user.userId,
      riskLevel: user.riskLevel,
      riskScore: user.riskScore,
    });
  }

  /**
   * Send payment failure alert
   */
  private async sendPaymentFailureAlert(data: {
    userId: string;
    username: string;
    email?: string;
    subscriptionId: string;
    currentPeriodEnd: Date;
  }): Promise<void> {
    const message = `💳 **Payment Failure Alert**

User: ${data.username} (${data.userId})
Email: ${data.email || 'N/A'}
Subscription: ${data.subscriptionId}
Period Ends: ${data.currentPeriodEnd.toLocaleDateString()}

Action Required: Contact user to update payment method.`;

    await this.sendSlackAlert(message, 'error');

    this.logger.error('Payment failure detected', {
      userId: data.userId,
      subscriptionId: data.subscriptionId,
    });
  }

  /**
   * Send trial ending alert
   */
  private async sendTrialEndingAlert(data: {
    userId: string;
    username: string;
    email?: string;
    planName: string;
    trialEnd: Date;
  }): Promise<void> {
    const daysRemaining = Math.ceil(
      (data.trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    const message = `⏰ **Trial Ending Soon**

User: ${data.username} (${data.userId})
Email: ${data.email || 'N/A'}
Plan: ${data.planName}
Trial Ends: ${data.trialEnd.toLocaleDateString()} (${daysRemaining} days)

Action Required: Send conversion email to encourage subscription.`;

    await this.sendSlackAlert(message, 'info');

    this.logger.info('Trial ending soon', {
      userId: data.userId,
      daysRemaining,
    });
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(
    message: string,
    severity: 'info' | 'warning' | 'error'
  ): Promise<void> {
    const webhookUrl = process.env.SLACK_REVENUE_ALERTS_WEBHOOK;
    if (!webhookUrl) {
      this.logger.warn('Slack webhook not configured for revenue alerts');
      return;
    }

    try {
      const color = severity === 'error' ? 'danger' : severity === 'warning' ? 'warning' : 'good';

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [
            {
              color,
              text: message,
              footer: 'Revenue Alert Agent',
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      });
    } catch (error) {
      this.logger.error('Failed to send Slack alert', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  protected async cleanup(): Promise<void> {
    // Cleanup revenue alert resources
    this.logger.info('Revenue Alert Agent cleanup completed');
  }

  public async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown>; timestamp?: string }> {
    return {
      status: 'healthy',
      details: {
        overageAlerts: this.metrics.overageAlertsTriggered,
        churnAlerts: this.metrics.churnRiskAlertsTriggered,
        paymentAlerts: this.metrics.paymentFailureAlertsTriggered,
        trialAlerts: this.metrics.trialEndingAlertsTriggered
      },
      timestamp: new Date().toISOString()
    };
  }

  public async collectMetrics(): Promise<BaseMetrics> {
    return {
      agentName: this.metrics.agentName,
      successCount: this.metrics.successCount,
      errorCount: this.metrics.errorCount,
      warningCount: this.metrics.warningCount,
      processingTimeMs: this.metrics.processingTimeMs,
      memoryUsageMb: this.metrics.memoryUsageMb
    };
  }
}

