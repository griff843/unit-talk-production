"use strict";
// @ts-nocheck
/**
 * CLV Alert Service
 * Monitors CLV performance and alerts admin when thresholds are breached
 * Private alerts only - never shown to public users
 *
 * @module CLVAlertService
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.clvAlertService = exports.CLVAlertService = void 0;
const logger_1 = require("../../utils/logger");
const CLVTrackingService_1 = require("../clv/CLVTrackingService");
const supabaseClient_1 = require("../supabaseClient");
class CLVAlertService {
    constructor() {
        // Default thresholds (configurable)
        this.thresholds = {
            critical: {
                clv: -2, // -2% CLV
                duration: 24 // 24 hours
            },
            warning: {
                clv: 0, // 0% CLV
                duration: 72 // 3 days
            },
            investigate: {
                clv: 2, // 2% CLV (below target)
                duration: 168 // 7 days
            }
        };
        // Alert channels
        this.alertChannels = {
            discord: process.env.ADMIN_DISCORD_WEBHOOK,
            email: process.env.ADMIN_ALERT_EMAIL,
            slack: process.env.ADMIN_SLACK_WEBHOOK,
            sms: process.env.ADMIN_ALERT_PHONE
        };
        this.logger = (0, logger_1.createLogger)('CLVAlertService');
    }
    static getInstance() {
        if (!CLVAlertService.instance) {
            CLVAlertService.instance = new CLVAlertService();
        }
        return CLVAlertService.instance;
    }
    /**
     * Main monitoring function - should run every hour
     */
    async monitorCLV() {
        try {
            this.logger.info('Running CLV monitoring...');
            // Check each threshold
            await this.checkCriticalThreshold();
            await this.checkWarningThreshold();
            await this.checkInvestigateThreshold();
            // Check for rapid decline
            await this.checkRapidDecline();
            // Check market-specific issues
            await this.checkMarketSpecificIssues();
            // Check book-specific issues
            await this.checkBookSpecificIssues();
        }
        catch (error) {
            this.logger.error('CLV monitoring failed', error);
            // Send alert about monitoring failure itself
            await this.sendAlert('critical', 'CLV monitoring system failure', {
                error: error.message
            });
        }
    }
    /**
     * Check critical threshold
     */
    async checkCriticalThreshold() {
        const performance = await CLVTrackingService_1.clvTrackingService.getRecentPerformance(this.thresholds.critical.duration);
        if (performance.avgCLV < this.thresholds.critical.clv) {
            const existingAlert = await this.getExistingAlert('critical', this.thresholds.critical.duration);
            if (!existingAlert) {
                await this.createAndSendAlert({
                    level: 'critical',
                    message: `CRITICAL: CLV at ${performance.avgCLV.toFixed(2)}% for ${this.thresholds.critical.duration}h`,
                    details: {
                        currentCLV: performance.avgCLV,
                        duration: this.thresholds.critical.duration,
                        trend: performance.trend
                    }
                });
            }
        }
    }
    /**
     * Check warning threshold
     */
    async checkWarningThreshold() {
        const performance = await CLVTrackingService_1.clvTrackingService.getRecentPerformance(this.thresholds.warning.duration);
        if (performance.avgCLV < this.thresholds.warning.clv) {
            const existingAlert = await this.getExistingAlert('warning', this.thresholds.warning.duration);
            if (!existingAlert) {
                await this.createAndSendAlert({
                    level: 'warning',
                    message: `WARNING: Negative CLV for ${this.thresholds.warning.duration / 24} days`,
                    details: {
                        currentCLV: performance.avgCLV,
                        duration: this.thresholds.warning.duration,
                        trend: performance.trend
                    }
                });
            }
        }
    }
    /**
     * Check investigate threshold
     */
    async checkInvestigateThreshold() {
        const performance = await CLVTrackingService_1.clvTrackingService.getRecentPerformance(this.thresholds.investigate.duration);
        if (performance.avgCLV < this.thresholds.investigate.clv) {
            const existingAlert = await this.getExistingAlert('investigate', this.thresholds.investigate.duration);
            if (!existingAlert) {
                await this.createAndSendAlert({
                    level: 'investigate',
                    message: `Below target CLV (${performance.avgCLV.toFixed(2)}%) for 1 week`,
                    details: {
                        currentCLV: performance.avgCLV,
                        duration: this.thresholds.investigate.duration,
                        trend: performance.trend
                    }
                });
            }
        }
    }
    /**
     * Check for rapid CLV decline
     */
    async checkRapidDecline() {
        // Compare last 24h to previous 24h
        const last24h = await CLVTrackingService_1.clvTrackingService.getRecentPerformance(24);
        const previous24h = await CLVTrackingService_1.clvTrackingService.getCLVStats({
            startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
        });
        const decline = previous24h.avgCLVPercentage - last24h.avgCLV;
        if (decline > 3) { // 3% drop in 24h
            await this.createAndSendAlert({
                level: 'warning',
                message: `Rapid CLV decline: -${decline.toFixed(2)}% in 24h`,
                details: {
                    currentCLV: last24h.avgCLV,
                    duration: 24,
                    trend: 'declining',
                    previousCLV: previous24h.avgCLVPercentage
                }
            });
        }
    }
    /**
     * Check market-specific CLV issues
     */
    async checkMarketSpecificIssues() {
        const stats = await CLVTrackingService_1.clvTrackingService.getCLVStats({
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        });
        const problematicMarkets = [];
        // Check each sport/market combination
        for (const [market, metrics] of stats.byMarket) {
            if (metrics.count > 20 && metrics.avgCLV < -1) {
                problematicMarkets.push(`${market} (${metrics.avgCLV.toFixed(2)}%)`);
            }
        }
        if (problematicMarkets.length > 0) {
            await this.createAndSendAlert({
                level: 'investigate',
                message: `Market-specific CLV issues detected`,
                details: {
                    currentCLV: stats.avgCLVPercentage,
                    duration: 168,
                    trend: 'stable',
                    affectedMarkets: problematicMarkets
                }
            });
        }
    }
    /**
     * Check book-specific CLV issues
     */
    async checkBookSpecificIssues() {
        const stats = await CLVTrackingService_1.clvTrackingService.getCLVStats({
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        });
        const problematicBooks = [];
        // Check each book
        for (const [book, metrics] of stats.byBook) {
            if (metrics.count > 30 && metrics.avgCLV < -2) {
                problematicBooks.push(`${book} (${metrics.avgCLV.toFixed(2)}%)`);
            }
        }
        if (problematicBooks.length > 0) {
            await this.createAndSendAlert({
                level: 'warning',
                message: `Book-specific CLV issues detected`,
                details: {
                    currentCLV: stats.avgCLVPercentage,
                    duration: 168,
                    trend: 'stable',
                    affectedBooks: problematicBooks
                }
            });
        }
    }
    /**
     * Check if similar alert already exists
     */
    async getExistingAlert(level, duration) {
        const { data } = await supabaseClient_1.supabaseClient
            .from('clv_alerts')
            .select('*')
            .eq('level', level)
            .eq('acknowledged', false)
            .gte('createdAt', new Date(Date.now() - duration * 60 * 60 * 1000).toISOString())
            .single();
        return data;
    }
    /**
     * Create and send alert
     */
    async createAndSendAlert(alert) {
        // Save to database
        const { data, error } = await supabaseClient_1.supabaseClient
            .from('clv_alerts')
            .insert({
            level: alert.level,
            message: alert.message,
            details: alert.details,
            createdAt: new Date().toISOString(),
            acknowledged: false
        })
            .select()
            .single();
        if (error) {
            this.logger.error('Failed to save alert', error);
        }
        // Send to configured channels
        await this.sendAlert(alert.level, alert.message, alert.details);
    }
    /**
     * Send alert to configured channels
     */
    async sendAlert(level, message, details) {
        const formattedMessage = this.formatAlertMessage(level, message, details);
        // Send to Discord webhook
        if (this.alertChannels.discord) {
            await this.sendDiscordAlert(level, formattedMessage);
        }
        // Send email for critical alerts
        if (level === 'critical' && this.alertChannels.email) {
            await this.sendEmailAlert(formattedMessage);
        }
        // Send SMS for critical alerts
        if (level === 'critical' && this.alertChannels.sms) {
            await this.sendSMSAlert(message);
        }
        // Send to Slack
        if (this.alertChannels.slack) {
            await this.sendSlackAlert(level, formattedMessage);
        }
        this.logger.warn(`CLV Alert sent: ${level} - ${message}`);
    }
    /**
     * Format alert message
     */
    formatAlertMessage(level, message, details) {
        const emoji = level === 'critical' ? '🚨' : level === 'warning' ? '⚠️' : '🔍';
        let formatted = `${emoji} **CLV ALERT - ${level.toUpperCase()}**\n\n`;
        formatted += `${message}\n\n`;
        formatted += `**Details:**\n`;
        formatted += `• Current CLV: ${details.currentCLV?.toFixed(2)}%\n`;
        formatted += `• Duration: ${details.duration}h\n`;
        formatted += `• Trend: ${details.trend}\n`;
        if (details.affectedMarkets?.length > 0) {
            formatted += `• Affected Markets: ${details.affectedMarkets.join(', ')}\n`;
        }
        if (details.affectedBooks?.length > 0) {
            formatted += `• Affected Books: ${details.affectedBooks.join(', ')}\n`;
        }
        formatted += `\n_Time: ${new Date().toISOString()}_`;
        return formatted;
    }
    /**
     * Send Discord alert
     */
    async sendDiscordAlert(level, message) {
        if (!this.alertChannels.discord)
            return;
        const color = level === 'critical' ? 0xFF0000 : level === 'warning' ? 0xFFFF00 : 0x0000FF;
        try {
            await fetch(this.alertChannels.discord, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                            color,
                            description: message,
                            timestamp: new Date().toISOString()
                        }]
                })
            });
        }
        catch (error) {
            this.logger.error('Failed to send Discord alert', error);
        }
    }
    /**
     * Send email alert
     */
    async sendEmailAlert(message) {
        // Implementation depends on email service
        // This is a placeholder
        this.logger.info('Email alert would be sent:', message);
    }
    /**
     * Send SMS alert
     */
    async sendSMSAlert(message) {
        // Implementation depends on SMS service (Twilio, etc.)
        // This is a placeholder
        this.logger.info('SMS alert would be sent:', message);
    }
    /**
     * Send Slack alert
     */
    async sendSlackAlert(level, message) {
        if (!this.alertChannels.slack)
            return;
        try {
            await fetch(this.alertChannels.slack, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: message,
                    icon_emoji: level === 'critical' ? ':rotating_light:' : ':warning:'
                })
            });
        }
        catch (error) {
            this.logger.error('Failed to send Slack alert', error);
        }
    }
    /**
     * Acknowledge an alert
     */
    async acknowledgeAlert(alertId, userId) {
        await supabaseClient_1.supabaseClient
            .from('clv_alerts')
            .update({
            acknowledged: true,
            acknowledgedBy: userId,
            acknowledgedAt: new Date().toISOString()
        })
            .eq('id', alertId);
    }
    /**
     * Get active alerts
     */
    async getActiveAlerts() {
        const { data, error } = await supabaseClient_1.supabaseClient
            .from('clv_alerts')
            .select('*')
            .eq('acknowledged', false)
            .order('createdAt', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    /**
     * Update alert thresholds
     */
    updateThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
        this.logger.info('Alert thresholds updated', this.thresholds);
    }
}
exports.CLVAlertService = CLVAlertService;
// Export singleton instance
exports.clvAlertService = CLVAlertService.getInstance();
