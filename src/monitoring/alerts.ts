import { logger } from '../services/logging';
import { metrics } from '../monitoring/Dashboard';

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  channels: string[];
  tags: string[];
  description: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  value: number;
  threshold: number;
  status: 'active' | 'resolved' | 'acknowledged';
  channels: string[];
  tags: string[];
  metadata: Record<string, any>;
}

export interface AlertChannel {
  id: string;
  name: string;
  type: 'discord' | 'slack' | 'email' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
  severityFilter: ('info' | 'warning' | 'critical')[];
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: string;
  severity: string;
  template: string;
  variables: string[];
}

// Enhanced Alert Manager with intelligent routing and escalation
export class EnhancedAlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private channels: Map<string, AlertChannel> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private cooldowns: Map<string, number> = new Map();
  private escalationChains: Map<string, string[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
    this.initializeDefaultChannels();
    this.initializeDefaultTemplates();
    this.startAlertProcessor();
  }

  private initializeDefaultRules(): void {
    // High error rate alert
    this.addRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      condition: 'error_rate > threshold',
      threshold: 0.05, // 5% error rate
      severity: 'critical',
      enabled: true,
      cooldownMinutes: 15,
      channels: ['discord-alerts', 'email-critical'],
      tags: ['system', 'errors'],
      description: 'Alert when system error rate exceeds 5%'
    });

    // High processing time alert
    this.addRule({
      id: 'high-processing-time',
      name: 'High Processing Time',
      condition: 'avg_processing_time > threshold',
      threshold: 30, // 30 seconds
      severity: 'warning',
      enabled: true,
      cooldownMinutes: 10,
      channels: ['discord-alerts'],
      tags: ['performance'],
      description: 'Alert when average processing time exceeds 30 seconds'
    });

    // Agent health check failure
    this.addRule({
      id: 'agent-unhealthy',
      name: 'Agent Health Check Failed',
      condition: 'agent_health == 0',
      threshold: 0,
      severity: 'critical',
      enabled: true,
      cooldownMinutes: 5,
      channels: ['discord-alerts', 'email-critical', 'sms-oncall'],
      tags: ['agent', 'health'],
      description: 'Alert when an agent fails health checks'
    });

    // AI model failure rate
    this.addRule({
      id: 'ai-model-failures',
      name: 'AI Model High Failure Rate',
      condition: 'ai_model_error_rate > threshold',
      threshold: 0.1, // 10% failure rate
      severity: 'warning',
      enabled: true,
      cooldownMinutes: 20,
      channels: ['discord-alerts'],
      tags: ['ai', 'models'],
      description: 'Alert when AI model failure rate exceeds 10%'
    });

    // Low pick accuracy
    this.addRule({
      id: 'low-pick-accuracy',
      name: 'Low Pick Accuracy',
      condition: 'pick_accuracy < threshold',
      threshold: 0.6, // 60% accuracy
      severity: 'warning',
      enabled: true,
      cooldownMinutes: 60,
      channels: ['discord-alerts', 'email-business'],
      tags: ['business', 'accuracy'],
      description: 'Alert when pick accuracy drops below 60%'
    });

    // Database connection issues
    this.addRule({
      id: 'database-connections',
      name: 'Database Connection Issues',
      condition: 'db_connection_errors > threshold',
      threshold: 5,
      severity: 'critical',
      enabled: true,
      cooldownMinutes: 5,
      channels: ['discord-alerts', 'email-critical', 'sms-oncall'],
      tags: ['database', 'infrastructure'],
      description: 'Alert when database connection errors exceed threshold'
    });

    // Rate limit hits
    this.addRule({
      id: 'rate-limit-hits',
      name: 'Rate Limit Exceeded',
      condition: 'rate_limit_hits > threshold',
      threshold: 10,
      severity: 'warning',
      enabled: true,
      cooldownMinutes: 30,
      channels: ['discord-alerts'],
      tags: ['rate-limiting', 'api'],
      description: 'Alert when rate limits are frequently exceeded'
    });
  }

  private initializeDefaultChannels(): void {
    // Discord alerts channel
    this.addChannel({
      id: 'discord-alerts',
      name: 'Discord Alerts',
      type: 'discord',
      config: {
        webhookUrl: process.env.DISCORD_ALERT_WEBHOOK,
        username: 'Unit Talk Alerts',
        avatar: '🚨'
      },
      enabled: true,
      severityFilter: ['info', 'warning', 'critical']
    });

    // Critical email alerts
    this.addChannel({
      id: 'email-critical',
      name: 'Critical Email Alerts',
      type: 'email',
      config: {
        recipients: process.env.CRITICAL_EMAIL_RECIPIENTS?.split(',') || [],
        subject: '[CRITICAL] Unit Talk Alert',
        from: process.env.ALERT_EMAIL_FROM || 'alerts@unittalk.com'
      },
      enabled: true,
      severityFilter: ['critical']
    });

    // Business email alerts
    this.addChannel({
      id: 'email-business',
      name: 'Business Email Alerts',
      type: 'email',
      config: {
        recipients: process.env.BUSINESS_EMAIL_RECIPIENTS?.split(',') || [],
        subject: '[ALERT] Unit Talk Business Alert',
        from: process.env.ALERT_EMAIL_FROM || 'alerts@unittalk.com'
      },
      enabled: true,
      severityFilter: ['warning', 'critical']
    });

    // SMS for critical on-call alerts
    this.addChannel({
      id: 'sms-oncall',
      name: 'SMS On-Call',
      type: 'sms',
      config: {
        recipients: process.env.ONCALL_PHONE_NUMBERS?.split(',') || [],
        provider: 'twilio',
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER
      },
      enabled: true,
      severityFilter: ['critical']
    });

    // Webhook for external integrations
    this.addChannel({
      id: 'webhook-external',
      name: 'External Webhook',
      type: 'webhook',
      config: {
        url: process.env.EXTERNAL_WEBHOOK_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXTERNAL_WEBHOOK_TOKEN}`
        }
      },
      enabled: !!process.env.EXTERNAL_WEBHOOK_URL,
      severityFilter: ['warning', 'critical']
    });
  }

  private initializeDefaultTemplates(): void {
    // Discord template
    this.addTemplate({
      id: 'discord-default',
      name: 'Discord Default',
      channel: 'discord',
      severity: 'all',
      template: `🚨 **{{severity}}** Alert: {{title}}

**Description:** {{description}}
**Value:** {{value}} (Threshold: {{threshold}})
**Time:** {{timestamp}}
**Tags:** {{tags}}

{{#if metadata.agent}}**Agent:** {{metadata.agent}}{{/if}}
{{#if metadata.component}}**Component:** {{metadata.component}}{{/if}}`,
      variables: ['severity', 'title', 'description', 'value', 'threshold', 'timestamp', 'tags', 'metadata']
    });

    // Email template
    this.addTemplate({
      id: 'email-default',
      name: 'Email Default',
      channel: 'email',
      severity: 'all',
      template: `Alert: {{title}}

Severity: {{severity}}
Description: {{description}}
Current Value: {{value}}
Threshold: {{threshold}}
Timestamp: {{timestamp}}
Tags: {{tags}}

{{#if metadata}}
Additional Information:
{{#each metadata}}
- {{@key}}: {{this}}
{{/each}}
{{/if}}

This is an automated alert from the Unit Talk monitoring system.`,
      variables: ['severity', 'title', 'description', 'value', 'threshold', 'timestamp', 'tags', 'metadata']
    });

    // SMS template (short)
    this.addTemplate({
      id: 'sms-default',
      name: 'SMS Default',
      channel: 'sms',
      severity: 'all',
      template: `🚨 {{severity}}: {{title}} - Value: {{value}} (Threshold: {{threshold}}) at {{timestamp}}`,
      variables: ['severity', 'title', 'value', 'threshold', 'timestamp']
    });
  }

  // Public methods for managing rules, channels, and templates
  public addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`Added alert rule: ${rule.name}`, { ruleId: rule.id });
  }

  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info(`Removed alert rule: ${ruleId}`);
  }

  public addChannel(channel: AlertChannel): void {
    this.channels.set(channel.id, channel);
    logger.info(`Added alert channel: ${channel.name}`, { channelId: channel.id });
  }

  public removeChannel(channelId: string): void {
    this.channels.delete(channelId);
    logger.info(`Removed alert channel: ${channelId}`);
  }

  public addTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
    logger.info(`Added notification template: ${template.name}`, { templateId: template.id });
  }

  // Main alert evaluation method
  public async evaluateMetrics(metricsData: Record<string, any>): Promise<void> {
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = await this.evaluateRule(rule, metricsData);
        
        if (shouldAlert) {
          await this.triggerAlert(rule, metricsData);
        }
      } catch (error) {
        logger.error(`Failed to evaluate rule ${ruleId}:`, error);
        metrics.recordAgentError('AlertManager', 'rule_evaluation_failed');
      }
    }
  }

  private async evaluateRule(rule: AlertRule, metricsData: Record<string, any>): Promise<boolean> {
    // Check cooldown
    const lastAlert = this.cooldowns.get(rule.id);
    if (lastAlert && Date.now() - lastAlert < rule.cooldownMinutes * 60 * 1000) {
      return false;
    }

    // Evaluate condition based on rule type
    switch (rule.condition) {
      case 'error_rate > threshold':
        return this.evaluateErrorRate(metricsData) > rule.threshold;
      
      case 'avg_processing_time > threshold':
        return this.evaluateProcessingTime(metricsData) > rule.threshold;
      
      case 'agent_health == 0':
        return this.evaluateAgentHealth(metricsData) === 0;
      
      case 'ai_model_error_rate > threshold':
        return this.evaluateAIModelErrorRate(metricsData) > rule.threshold;
      
      case 'pick_accuracy < threshold':
        return this.evaluatePickAccuracy(metricsData) < rule.threshold;
      
      case 'db_connection_errors > threshold':
        return this.evaluateDBConnectionErrors(metricsData) > rule.threshold;
      
      case 'rate_limit_hits > threshold':
        return this.evaluateRateLimitHits(metricsData) > rule.threshold;
      
      default:
        logger.warn(`Unknown rule condition: ${rule.condition}`);
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, metricsData: Record<string, any>): Promise<void> {
    const alertId = `${rule.id}-${Date.now()}`;
    const currentValue = this.getCurrentValue(rule, metricsData);
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      title: rule.name,
      description: rule.description,
      severity: rule.severity,
      timestamp: new Date().toISOString(),
      value: currentValue,
      threshold: rule.threshold,
      status: 'active',
      channels: rule.channels,
      tags: rule.tags,
      metadata: this.extractMetadata(rule, metricsData)
    };

    // Store alert
    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);
    
    // Set cooldown
    this.cooldowns.set(rule.id, Date.now());

    // Send notifications
    await this.sendNotifications(alert);

    // Record metrics
    metrics.recordAgentError('AlertManager', 'alert_triggered');
    
    logger.warn(`Alert triggered: ${rule.name}`, {
      alertId,
      ruleId: rule.id,
      severity: rule.severity,
      value: currentValue,
      threshold: rule.threshold
    });
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const promises = alert.channels.map(async (channelId) => {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) {
        logger.warn(`Channel not found or disabled: ${channelId}`);
        return;
      }

      // Check severity filter
      if (!channel.severityFilter.includes(alert.severity)) {
        return;
      }

      try {
        await this.sendToChannel(channel, alert);
        logger.info(`Alert sent to channel: ${channel.name}`, { alertId: alert.id });
      } catch (error) {
        logger.error(`Failed to send alert to channel ${channel.name}:`, error);
        metrics.recordAgentError('AlertManager', 'notification_failed');
      }
    });

    await Promise.allSettled(promises);
  }

  private async sendToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
    const template = this.getTemplate(channel.type, alert.severity);
    const message = this.renderTemplate(template, alert);

    switch (channel.type) {
      case 'discord':
        await this.sendDiscordAlert(channel, message, alert);
        break;
      
      case 'email':
        await this.sendEmailAlert(channel, message, alert);
        break;
      
      case 'sms':
        await this.sendSMSAlert(channel, message, alert);
        break;
      
      case 'webhook':
        await this.sendWebhookAlert(channel, alert);
        break;
      
      default:
        logger.warn(`Unsupported channel type: ${channel.type}`);
    }
  }

  private async sendDiscordAlert(channel: AlertChannel, message: string, alert: Alert): Promise<void> {
    const webhookUrl = channel.config.webhookUrl;
    if (!webhookUrl) {
      throw new Error('Discord webhook URL not configured');
    }

    const embed = {
      title: `🚨 ${alert.severity.toUpperCase()}: ${alert.title}`,
      description: message,
      color: this.getSeverityColor(alert.severity),
      timestamp: alert.timestamp,
      fields: [
        { name: 'Value', value: alert.value.toString(), inline: true },
        { name: 'Threshold', value: alert.threshold.toString(), inline: true },
        { name: 'Tags', value: alert.tags.join(', '), inline: true }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: channel.config.username || 'Unit Talk Alerts',
        embeds: [embed]
      })
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.statusText}`);
    }
  }

  private async sendEmailAlert(channel: AlertChannel, message: string, alert: Alert): Promise<void> {
    // This would integrate with your email service (SendGrid, SES, etc.)
    logger.info('Email alert would be sent here', {
      recipients: channel.config.recipients,
      subject: `${channel.config.subject} - ${alert.title}`,
      message
    });
  }

  private async sendSMSAlert(channel: AlertChannel, message: string, alert: Alert): Promise<void> {
    // This would integrate with Twilio or similar SMS service
    logger.info('SMS alert would be sent here', {
      recipients: channel.config.recipients,
      message
    });
  }

  private async sendWebhookAlert(channel: AlertChannel, alert: Alert): Promise<void> {
    const response = await fetch(channel.config.url, {
      method: channel.config.method || 'POST',
      headers: channel.config.headers || { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert,
        timestamp: new Date().toISOString(),
        source: 'unit-talk-alerts'
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }
  }

  // Helper methods for metric evaluation
  private evaluateErrorRate(metricsData: Record<string, any>): number {
    // Calculate error rate from metrics
    const totalRequests = metricsData.totalRequests || 1;
    const totalErrors = metricsData.totalErrors || 0;
    return totalErrors / totalRequests;
  }

  private evaluateProcessingTime(metricsData: Record<string, any>): number {
    return metricsData.avgProcessingTime || 0;
  }

  private evaluateAgentHealth(metricsData: Record<string, any>): number {
    // Return 0 if any agent is unhealthy, 1 if all healthy
    const unhealthyAgents = metricsData.unhealthyAgents || 0;
    return unhealthyAgents > 0 ? 0 : 1;
  }

  private evaluateAIModelErrorRate(metricsData: Record<string, any>): number {
    const totalAIRequests = metricsData.totalAIRequests || 1;
    const totalAIErrors = metricsData.totalAIErrors || 0;
    return totalAIErrors / totalAIRequests;
  }

  private evaluatePickAccuracy(metricsData: Record<string, any>): number {
    return metricsData.pickAccuracy || 1;
  }

  private evaluateDBConnectionErrors(metricsData: Record<string, any>): number {
    return metricsData.dbConnectionErrors || 0;
  }

  private evaluateRateLimitHits(metricsData: Record<string, any>): number {
    return metricsData.rateLimitHits || 0;
  }

  private getCurrentValue(rule: AlertRule, metricsData: Record<string, any>): number {
    switch (rule.condition) {
      case 'error_rate > threshold':
        return this.evaluateErrorRate(metricsData);
      case 'avg_processing_time > threshold':
        return this.evaluateProcessingTime(metricsData);
      case 'agent_health == 0':
        return this.evaluateAgentHealth(metricsData);
      case 'ai_model_error_rate > threshold':
        return this.evaluateAIModelErrorRate(metricsData);
      case 'pick_accuracy < threshold':
        return this.evaluatePickAccuracy(metricsData);
      case 'db_connection_errors > threshold':
        return this.evaluateDBConnectionErrors(metricsData);
      case 'rate_limit_hits > threshold':
        return this.evaluateRateLimitHits(metricsData);
      default:
        return 0;
    }
  }

  private extractMetadata(rule: AlertRule, metricsData: Record<string, any>): Record<string, any> {
    return {
      rule: rule.name,
      condition: rule.condition,
      evaluatedAt: new Date().toISOString(),
      metricsSnapshot: {
        totalRequests: metricsData.totalRequests,
        totalErrors: metricsData.totalErrors,
        avgProcessingTime: metricsData.avgProcessingTime,
        unhealthyAgents: metricsData.unhealthyAgents
      }
    };
  }

  private getTemplate(channelType: string, severity: string): NotificationTemplate {
    const templateId = `${channelType}-default`;
    return this.templates.get(templateId) || this.templates.get('discord-default')!;
  }

  private renderTemplate(template: NotificationTemplate, alert: Alert): string {
    let rendered = template.template;
    
    // Simple template rendering (in production, use a proper template engine)
    rendered = rendered.replace(/\{\{severity\}\}/g, alert.severity.toUpperCase());
    rendered = rendered.replace(/\{\{title\}\}/g, alert.title);
    rendered = rendered.replace(/\{\{description\}\}/g, alert.description);
    rendered = rendered.replace(/\{\{value\}\}/g, alert.value.toString());
    rendered = rendered.replace(/\{\{threshold\}\}/g, alert.threshold.toString());
    rendered = rendered.replace(/\{\{timestamp\}\}/g, alert.timestamp);
    rendered = rendered.replace(/\{\{tags\}\}/g, alert.tags.join(', '));
    
    return rendered;
  }

  private getSeverityColor(severity: string): number {
    switch (severity) {
      case 'critical': return 0xff0000; // Red
      case 'warning': return 0xffa500;  // Orange
      case 'info': return 0x0099ff;     // Blue
      default: return 0x808080;         // Gray
    }
  }

  private startAlertProcessor(): void {
    // Process alerts every 30 seconds
    setInterval(async () => {
      try {
        // This would typically get metrics from your monitoring system
        const metricsData = await this.gatherCurrentMetrics();
        await this.evaluateMetrics(metricsData);
      } catch (error) {
        logger.error('Alert processor error:', error);
      }
    }, 30000);
  }

  private async gatherCurrentMetrics(): Promise<Record<string, any>> {
    // This would gather actual metrics from your system
    // For now, return mock data
    return {
      totalRequests: 1000,
      totalErrors: 5,
      avgProcessingTime: 2.5,
      unhealthyAgents: 0,
      totalAIRequests: 100,
      totalAIErrors: 2,
      pickAccuracy: 0.75,
      dbConnectionErrors: 0,
      rateLimitHits: 3
    };
  }

  // Public methods for alert management
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  public getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  public acknowledgeAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'acknowledged';
      logger.info(`Alert acknowledged: ${alertId}`);
    }
  }

  public resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      this.activeAlerts.delete(alertId);
      logger.info(`Alert resolved: ${alertId}`);
    }
  }

  public getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  public getChannels(): AlertChannel[] {
    return Array.from(this.channels.values());
  }
}

// Export singleton instance
export const alertManager = new EnhancedAlertManager();