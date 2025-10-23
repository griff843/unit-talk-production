"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertManager = exports.EnhancedAlertManager = void 0;
const Dashboard_1 = require("../monitoring/Dashboard");
const logging_1 = require("../services/logging");
class EnhancedAlertManager {
    constructor() {
        this.rules = new Map();
        this.channels = new Map();
        this.templates = new Map();
        this.activeAlerts = new Map();
        this.alertHistory = [];
        this.cooldowns = new Map();
        this.escalationChains = new Map([
            ['critical', ['sms-oncall', 'email-critical', 'discord-alerts']],
            ['warning', ['email-business', 'discord-alerts']],
            ['info', ['discord-alerts']]
        ]);
        this.initializeDefaultRules();
        this.initializeDefaultChannels();
        this.initializeDefaultTemplates();
        this.startAlertProcessor();
    }
    // Public method to get template
    getTemplate(channelType, severity) {
        // Simplified template selection logic
        const templates = {
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
    renderAlertMessage(alert, template) {
        if ('template' in template) {
            // Notification template case
            let renderedTemplate = template.template;
            template.variables.forEach(variable => {
                const value = alert[variable] || alert.metadata?.[variable] || 'N/A';
                renderedTemplate = renderedTemplate.replace(`{{${variable}}}`, String(value));
            });
            return renderedTemplate;
        }
        else {
            // Simple title/body template case
            return template.body.replace('{message}', `${alert.title}: ${alert.description}`);
        }
    }
    // Public method to initialize default rules
    initializeDefaultRules() {
        // Placeholder for default rules initialization
        const defaultRules = [
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
    initializeDefaultChannels() {
        // Placeholder for default channels initialization
        const defaultChannels = [
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
    initializeDefaultTemplates() {
        // Placeholder for default templates initialization
        const defaultTemplates = [
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
    startAlertProcessor() {
        // Placeholder for alert processing logic
        // Could include periodic cleanup of old alerts, checking for unresolved critical alerts, etc.
        const cleanupInterval = setInterval(() => {
            // Remove alerts older than 24 hours
            const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
            this.alertHistory = this.alertHistory.filter(alert => new Date(alert.timestamp).getTime() > cutoffTime);
            // Check and reset cooldowns
            for (const [ruleId, cooldownTime] of this.cooldowns.entries()) {
                if (Date.now() > cooldownTime) {
                    this.cooldowns.delete(ruleId);
                }
            }
        }, 60 * 60 * 1000); // Run every hour
        // Prevent the interval from keeping the process running
        if (typeof globalThis.ref === 'function') {
            globalThis.ref(cleanupInterval);
        }
    }
    // Public method to send alert to a specific channel
    async sendAlert(channel, message, alert) {
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
                logging_1.logger.warn(`Unsupported channel type: ${channel.type}`);
        }
    }
    // Public method to send SMS alert
    async sendSMSAlert(channel, message, alert) {
        // Placeholder for SMS alert sending logic
        logging_1.logger.info(`Sending SMS alert to ${channel.config['phoneNumber']}`, { message, alertId: alert.id });
        // Implement actual SMS sending logic here
    }
    // Public method to send email alert
    async sendEmailAlert(channel, message, alert) {
        // Placeholder for email alert sending logic
        logging_1.logger.info(`Sending email alert to ${channel.config['email']}`, { message, alertId: alert.id });
        // Implement actual email sending logic here
    }
    // Public method to send Discord alert
    async sendDiscordAlert(channel, message, alert) {
        // Placeholder for Discord alert sending logic
        logging_1.logger.info(`Sending Discord alert to ${channel.config['webhookUrl']}`, { message, alertId: alert.id });
        // Implement actual Discord webhook sending logic here
    }
    // Public method to send webhook alert
    async sendWebhookAlert(channel, alert) {
        // Placeholder for webhook alert sending logic
        logging_1.logger.info(`Sending webhook alert to ${channel.config['webhookUrl']}`, { alertId: alert.id });
        // Implement actual webhook sending logic here
    }
    // Public method to send notifications
    async sendNotifications(alert) {
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
                    const template = this.getTemplate(channel.type, alert.severity);
                    const message = this.renderAlertMessage(alert, template);
                    // Send alert to the channel using new sendAlert method
                    await this.sendAlert(channel, message, alert);
                    logging_1.logger.info(`Alert sent to channel via escalation: ${channel.name}`, { alertId: alert.id });
                    // Once sent to a channel in this step of escalation, break to next escalation step
                    break;
                }
                catch (error) {
                    logging_1.logger.error(`Failed to send alert to channel ${channel.name}:`, error);
                    Dashboard_1.metrics.recordAgentError('AlertManager', 'notification_failed');
                }
            }
        }
    }
    // Public method to add an alert to the system
    async createAlert(alert) {
        // Check if the alert is already in cooldown
        if (this.cooldowns.has(alert.ruleId)) {
            logging_1.logger.info(`Alert rule ${alert.ruleId} is in cooldown`, { alertId: alert.id });
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
    resolveAlert(alertId) {
        const alert = this.activeAlerts.get(alertId);
        if (alert) {
            alert.status = 'resolved';
            this.activeAlerts.delete(alertId);
        }
    }
    // Public method to get active alerts
    getActiveAlerts() {
        return Array.from(this.activeAlerts.values());
    }
    // Public method to get alert history
    getAlertHistory() {
        return this.alertHistory;
    }
}
exports.EnhancedAlertManager = EnhancedAlertManager;
// Export singleton instance
exports.alertManager = new EnhancedAlertManager();
