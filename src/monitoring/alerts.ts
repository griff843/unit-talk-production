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
  cooldownMinutes?: number; // Optional cooldown for this specific alert
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

export type AlertTemplate = NotificationTemplate | { title: string; body: string };

export class EnhancedAlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private channels: Map<string, AlertChannel> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private cooldowns: Map<string, number> = new Map();
  private escalationChains: Map<string, string[]> = new Map([
    ['critical', ['sms-oncall', 'email-critical', 'discord-alerts']],
    ['warning', ['email-business', 'discord-alerts']],
    ['info', ['discord-alerts']]
  ]);

  constructor() {
    this.initializeDefaultRules();
    this.initializeDefaultChannels();
    this.initializeDefaultTemplates();
    this.startAlertProcessor();
  }

  // Public method to get template
  public getTemplate(channelType: string, severity: string): AlertTemplate {
    // Simplified template selection logic
    const templates: Record<string, Record<string, AlertTemplate>> = {
      sms: {
        critical: {
          title: 'CRITICAL ALERT',
          body: 'Urgent action required: {message}'
        },
        warning: {
          title: 'High Priority Alert',
          body: 'Important: {message}'
        },
        info: {
          title: 'Alert',
          body: '{message}'
        }
      },
      discord: {
        critical: {
          id: 'discord-critical',
          name: 'Discord Critical Alert',
          channel: 'discord',
          severity: 'critical',
          template: `🚨 **CRITICAL Alert: {{title}}**\n\n{{description}}\n\nValue: {{value}} (Threshold: {{threshold}})\nTime: {{timestamp}}\nTags: {{tags}}`,
          variables: ['title', 'description', 'value', 'threshold', 'timestamp', 'tags']
        },
        warning: {
          id: 'discord-warning',
          name: 'Discord Warning Alert',
          channel: 'discord',
          severity: 'warning',
          template: `⚠️ **Warning Alert: {{title}}**\n\n{{description}}\n\nValue: {{value}} (Threshold: {{threshold}})\nTime: {{timestamp}}\nTags: {{tags}}`,
          variables: ['title', 'description', 'value', 'threshold', 'timestamp', 'tags']
        },
        info: {
          id: 'discord-info',
          name: 'Discord Info Alert',
          channel: 'discord',
          severity: 'info',
          template: `ℹ️ **Info Alert: {{title}}**\n\n{{description}}\n\nValue: {{value}} (Threshold: {{threshold}})\nTime: {{timestamp}}\nTags: {{tags}}`,
          variables: ['title', 'description', 'value', 'threshold', 'timestamp', 'tags']
        }
      }
    };

    // Ensure channelType exists, default to 'discord'
    const channelTypeKey = Object.keys(templates).includes(channelType) ? channelType : 'discord';
    const channelTemplates = templates[channelTypeKey] || templates['discord'];

    // Ensure severity exists, default to 'info'
    const severityKey = channelTemplates && Object.keys(channelTemplates).includes(severity) ? severity : 'info';

    if (!channelTemplates) {
      return {
        title: 'Default Alert',
        body: 'No templates configured for this channel type: {message}'
      };
    }

    const template = channelTemplates[severityKey];
    if (!template) {
      return {
        title: 'Default Alert',
        body: 'No templates configured for this severity: {message}'
      };
    }

    // Guaranteed to return a template
    return template;
  }

  // Public method to render alert message
  public renderAlertMessage(alert: Alert, template: AlertTemplate): string {
    if ('template' in template) {
      // Notification template case
      let renderedTemplate = template.template;
      template.variables.forEach(variable => {
        const value = alert[variable as keyof Alert] || alert.metadata?.[variable] || 'N/A';
        renderedTemplate = renderedTemplate.replace(`{{${variable}}}`, String(value));
      });
      return renderedTemplate;
    } else {
      // Simple title/body template case
      return template.body.replace('{message}', `${alert.title}: ${alert.description}`);
    }
  }

  // Public method to initialize default rules
  public initializeDefaultRules(): void {
    // Placeholder for default rules initialization
    const defaultRules: AlertRule[] = [
      {
        id: 'system-critical',
        name: 'System Critical Alert',
        condition: 'system_health < 0.5',
        threshold: 0.5,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 30,
        channels: ['discord-alerts', 'sms-oncall'],
        tags: ['system', 'health'],
        description: 'System health is critically low'
      }
    ];

    defaultRules.forEach(rule => this.rules.set(rule.id, rule));
  }

  // Public method to initialize default channels
  public initializeDefaultChannels(): void {
    // Placeholder for default channels initialization
    const defaultChannels: AlertChannel[] = [
      {
        id: 'discord-alerts',
        name: 'Discord Alerts',
        type: 'discord',
        config: { ['webhookUrl']: process.env['DISCORD_WEBHOOK_URL'] },
        enabled: true,
        severityFilter: ['info', 'warning', 'critical']
      },
      {
        id: 'sms-oncall',
        name: 'SMS On-Call',
        type: 'sms',
        config: { ['phoneNumber']: process.env['ONCALL_PHONE_NUMBER'] },
        enabled: true,
        severityFilter: ['critical']
      }
    ];

    defaultChannels.forEach(channel => this.channels.set(channel.id, channel));
  }

  // Public method to initialize default templates
  public initializeDefaultTemplates(): void {
    // Placeholder for default templates initialization
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'discord-critical',
        name: 'Discord Critical Alert Template',
        channel: 'discord',
        severity: 'critical',
        template: `🚨 **CRITICAL Alert: {{title}}**\n\n{{description}}\n\nValue: {{value}} (Threshold: {{threshold}})\nTime: {{timestamp}}\nTags: {{tags}}`,
        variables: ['title', 'description', 'value', 'threshold', 'timestamp', 'tags']
      }
    ];

    defaultTemplates.forEach(template => this.templates.set(template.id, template));
  }

  // Public method to start alert processor
  public startAlertProcessor(): void {
    // Placeholder for alert processing logic
    // Could include periodic cleanup of old alerts, checking for unresolved critical alerts, etc.
    const cleanupInterval = setInterval(() => {
      // Remove alerts older than 24 hours
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
      this.alertHistory = this.alertHistory.filter(alert => 
        new Date(alert.timestamp).getTime() > cutoffTime
      );

      // Check and reset cooldowns
      for (const [ruleId, cooldownTime] of this.cooldowns.entries()) {
        if (Date.now() > cooldownTime) {
          this.cooldowns.delete(ruleId);
        }
      }
    }, 60 * 60 * 1000); // Run every hour

    // Prevent the interval from keeping the process running
    if (typeof (globalThis as any).ref === 'function') {
      (globalThis as any).ref(cleanupInterval);
    }
  }

  // Public method to send alert to a specific channel
  public async sendAlert(channel: AlertChannel, message: string, alert: Alert): Promise<void> {
    switch (channel.type) {
      case 'sms':
        await this.sendSMSAlert(channel, message, alert);
        break;
      case 'email':
        await this.sendEmailAlert(channel, message, alert);
        break;
      case 'discord':
        await this.sendDiscordAlert(channel, message, alert);
        break;
      case 'webhook':
        await this.sendWebhookAlert(channel, alert);
        break;
      default:
        logger.warn(`Unsupported channel type: ${channel.type}`);
    }
  }

  // Public method to send SMS alert
  public async sendSMSAlert(channel: AlertChannel, message: string, alert: Alert): Promise<void> {
    // Placeholder for SMS alert sending logic
    logger.info(`Sending SMS alert to ${channel.config['phoneNumber']}`, { message, alertId: alert.id });
    // Implement actual SMS sending logic here
  }

  // Public method to send email alert
  public async sendEmailAlert(channel: AlertChannel, message: string, alert: Alert): Promise<void> {
    // Placeholder for email alert sending logic
    logger.info(`Sending email alert to ${channel.config['email']}`, { message, alertId: alert.id });
    // Implement actual email sending logic here
  }

  // Public method to send Discord alert
  public async sendDiscordAlert(channel: AlertChannel, message: string, alert: Alert): Promise<void> {
    // Placeholder for Discord alert sending logic
    logger.info(`Sending Discord alert to ${channel.config['webhookUrl']}`, { message, alertId: alert.id });
    // Implement actual Discord webhook sending logic here
  }

  // Public method to send webhook alert
  public async sendWebhookAlert(channel: AlertChannel, alert: Alert): Promise<void> {
    // Placeholder for webhook alert sending logic
    logger.info(`Sending webhook alert to ${channel.config['webhookUrl']}`, { alertId: alert.id });
    // Implement actual webhook sending logic here
  }

  // Public method to send notifications
  public async sendNotifications(alert: Alert): Promise<void> {
    // Determine escalation chain based on alert severity
    const escalationChain = this.escalationChains.get(alert.severity) || [];

    // Filter activeChannels by escalationChain order
    for (const channelType of escalationChain) {
      // Find channels for this type in alert.channels and enabled
      const channels = alert.channels
        .map(chId => this.channels.get(chId))
        .filter(ch => ch && ch.type === channelType && ch.enabled && ch.severityFilter.includes(alert.severity));

      for (const channel of channels) {
        try {
          const template = this.getTemplate(channel!.type, alert.severity);
          const message = this.renderAlertMessage(alert, template);

          // Send alert to the channel using new sendAlert method
          await this.sendAlert(channel!, message, alert);
          logger.info(`Alert sent to channel via escalation: ${channel!.name}`, { alertId: alert.id });

          // Once sent to a channel in this step of escalation, break to next escalation step
          break;
        } catch (error) {
          logger.error(`Failed to send alert to channel ${channel!.name}:`, error);
          metrics.recordAgentError('AlertManager', 'notification_failed');
        }
      }
    }
  }

  // Public method to add an alert to the system
  public async createAlert(alert: Alert): Promise<void> {
    // Check if the alert is already in cooldown
    if (this.cooldowns.has(alert.ruleId)) {
      logger.info(`Alert rule ${alert.ruleId} is in cooldown`, { alertId: alert.id });
      return;
    }

    // Add alert to active alerts and history
    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Set cooldown for the alert rule
    const cooldownMinutes = alert.cooldownMinutes ?? 30;
    this.cooldowns.set(alert.ruleId, Date.now() + cooldownMinutes * 60 * 1000);

    // Send notifications
    await this.sendNotifications(alert);
  }

  // Public method to resolve an active alert
  public resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      this.activeAlerts.delete(alertId);
    }
  }

  // Public method to get active alerts
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  // Public method to get alert history
  public getAlertHistory(): Alert[] {
    return this.alertHistory;
  }
}

// Export singleton instance
export const alertManager = new EnhancedAlertManager();