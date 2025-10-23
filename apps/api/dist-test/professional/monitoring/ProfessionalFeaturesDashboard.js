"use strict";
/**
 * Professional Features Monitoring Dashboard
 * Real-time monitoring and analytics for all 8 professional features
 *
 * Provides comprehensive monitoring, alerting, and performance tracking
 * for the syndicate-level betting intelligence system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfessionalFeaturesDashboard = void 0;
const events_1 = require("events");
const logger_1 = require("../../utils/logger");
class ProfessionalFeaturesDashboard extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.alerts = new Map();
        this.metricsHistory = [];
        this.logger = (0, logger_1.createLogger)('ProfessionalFeaturesDashboard');
        this.startTime = Date.now();
        // Default configuration
        this.config = {
            updateInterval: 30000, // 30 seconds
            alertRetentionTime: 24, // 24 hours
            metricsRetentionDays: 7,
            alerting: {
                errorRateThreshold: 0.05, // 5%
                processingTimeThreshold: 2000, // 2 seconds
                clvThreshold: 0.02, // 2% minimum CLV
                complianceThreshold: 0.9 // 90% compliance
            },
            notifications: {
                enabled: true,
                emailRecipients: []
            },
            ...config
        };
        this.initializeMetrics();
        this.startMonitoring();
        this.logger.info('📊 Professional Features Dashboard initialized', {
            updateInterval: this.config.updateInterval,
            alerting: this.config.alerting,
            notifications: this.config.notifications.enabled
        });
    }
    /**
     * Initialize metrics structure
     */
    initializeMetrics() {
        this.metrics = {
            systemHealth: {
                status: 'HEALTHY',
                lastUpdate: new Date().toISOString(),
                uptime: 0,
                operationalFeatures: 8,
                totalFeatures: 8
            },
            features: {
                steamDetection: this.createFeatureMetrics('Steam Detection'),
                closingLinePrediction: this.createFeatureMetrics('Closing Line Prediction'),
                optimalTiming: this.createFeatureMetrics('Optimal Timing'),
                lineShopping: this.createFeatureMetrics('Line Shopping'),
                publicSharpSplit: this.createFeatureMetrics('Public Sharp Split'),
                marketTiming: this.createFeatureMetrics('Market Timing'),
                injuryTiming: this.createFeatureMetrics('Injury Timing'),
                crossMarketDiscrepancy: this.createFeatureMetrics('Cross Market Discrepancy')
            },
            performance: {
                totalProcessed: 0,
                avgProcessingTime: 0,
                throughputPerMinute: 0,
                errorRate: 0,
                successRate: 1,
                memoryUsage: 0,
                cpuUsage: 0
            },
            clvMetrics: {
                avgCLV: 0,
                positiveRate: 0,
                totalBets: 0,
                profitability: 0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                targetMet: false
            },
            compliance: {
                overallCompliance: 1,
                deviggingCompliance: 1,
                clvTrackingCompliance: 1,
                professionalGradingCompliance: 1,
                kellyCriterionCompliance: 1,
                rulesViolations: []
            },
            alerts: [],
            timestamp: new Date().toISOString()
        };
    }
    /**
     * Create feature metrics template
     */
    createFeatureMetrics(name) {
        return {
            name,
            enabled: true,
            operational: true,
            processed: 0,
            successRate: 1,
            avgProcessingTime: 0,
            accuracy: 0.8,
            confidence: 0.8,
            lastSuccess: new Date().toISOString(),
            health: 'HEALTHY'
        };
    }
    /**
     * Start monitoring with periodic updates
     */
    startMonitoring() {
        this.updateTimer = setInterval(() => {
            this.updateMetrics();
        }, this.config.updateInterval);
        this.logger.info('🔄 Dashboard monitoring started', {
            interval: `${this.config.updateInterval / 1000}s`
        });
    }
    /**
     * Stop monitoring
     */
    stop() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = undefined;
        }
        this.logger.info('⏹️ Dashboard monitoring stopped');
    }
    /**
     * Update all metrics
     */
    async updateMetrics() {
        try {
            // Update system health
            this.updateSystemHealth();
            // Update performance metrics
            this.updatePerformanceMetrics();
            // Update CLV metrics
            this.updateCLVMetrics();
            // Update compliance metrics
            this.updateComplianceMetrics();
            // Check for alerts
            this.checkAlerts();
            // Update timestamp
            this.metrics.timestamp = new Date().toISOString();
            // Store metrics history
            this.storeMetricsHistory();
            // Emit update event
            this.emit('metricsUpdated', this.metrics);
            this.logger.debug('📊 Dashboard metrics updated', {
                systemStatus: this.metrics.systemHealth.status,
                totalProcessed: this.metrics.performance.totalProcessed,
                errorRate: `${(this.metrics.performance.errorRate * 100).toFixed(1)}%`,
                clvRate: `${(this.metrics.clvMetrics.positiveRate * 100).toFixed(1)}%`
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to update dashboard metrics', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Update system health metrics
     */
    updateSystemHealth() {
        const uptime = (Date.now() - this.startTime) / 1000;
        // Count operational features
        const operationalFeatures = Object.values(this.metrics.features)
            .filter(feature => feature.operational).length;
        // Determine overall system status
        let status;
        const operationalRate = operationalFeatures / this.metrics.systemHealth.totalFeatures;
        if (operationalRate >= 0.9) {
            status = 'HEALTHY';
        }
        else if (operationalRate >= 0.7) {
            status = 'DEGRADED';
        }
        else {
            status = 'UNHEALTHY';
        }
        this.metrics.systemHealth = {
            status,
            lastUpdate: new Date().toISOString(),
            uptime,
            operationalFeatures,
            totalFeatures: this.metrics.systemHealth.totalFeatures
        };
    }
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        // Get memory usage
        const memUsage = process.memoryUsage();
        const memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
        // Simulate CPU usage (would be real in production)
        const cpuUsage = Math.random() * 0.3; // 0-30% CPU
        // Calculate throughput
        const avgProcessingTime = this.metrics.performance.avgProcessingTime;
        const throughputPerMinute = avgProcessingTime > 0 ?
            (60 * 1000) / avgProcessingTime : 0;
        this.metrics.performance = {
            ...this.metrics.performance,
            memoryUsage,
            cpuUsage,
            throughputPerMinute
        };
    }
    /**
     * Update CLV metrics
     */
    updateCLVMetrics() {
        // Simulate CLV data (would be real in production)
        const simulatedCLVs = Array.from({ length: 100 }, () => (Math.random() - 0.3) * 0.2 // -6% to +14% CLV range
        );
        const avgCLV = simulatedCLVs.reduce((sum, clv) => sum + clv, 0) / simulatedCLVs.length;
        const positiveCount = simulatedCLVs.filter(clv => clv > 0).length;
        const positiveRate = positiveCount / simulatedCLVs.length;
        // Simulate profitability metrics
        const profitability = avgCLV * 0.8; // Account for variance
        const sharpeRatio = profitability > 0 ? profitability / 0.15 : 0; // Assume 15% volatility
        const maxDrawdown = Math.abs(Math.min(...simulatedCLVs)) * 2;
        this.metrics.clvMetrics = {
            avgCLV,
            positiveRate,
            totalBets: this.metrics.performance.totalProcessed,
            profitability,
            sharpeRatio,
            maxDrawdown,
            targetMet: positiveRate >= 0.5 // 50% target
        };
    }
    /**
     * Update compliance metrics
     */
    updateComplianceMetrics() {
        // Simulate compliance checking (would be real in production)
        const deviggingCompliance = 0.98;
        const clvTrackingCompliance = 0.95;
        const professionalGradingCompliance = 0.97;
        const kellyCriterionCompliance = 0.92;
        const overallCompliance = (deviggingCompliance +
            clvTrackingCompliance +
            professionalGradingCompliance +
            kellyCriterionCompliance) / 4;
        const rulesViolations = [];
        if (deviggingCompliance < 0.95)
            rulesViolations.push('Devigging not applied to all props');
        if (clvTrackingCompliance < 0.95)
            rulesViolations.push('CLV tracking missing on some picks');
        if (professionalGradingCompliance < 0.95)
            rulesViolations.push('Some props bypassed professional grading');
        if (kellyCriterionCompliance < 0.90)
            rulesViolations.push('Kelly sizing not applied consistently');
        this.metrics.compliance = {
            overallCompliance,
            deviggingCompliance,
            clvTrackingCompliance,
            professionalGradingCompliance,
            kellyCriterionCompliance,
            rulesViolations
        };
    }
    /**
     * Check for alerts and create them
     */
    checkAlerts() {
        // Clear old alerts
        this.cleanupOldAlerts();
        // Check error rate
        if (this.metrics.performance.errorRate > this.config.alerting.errorRateThreshold) {
            this.createAlert('ERROR', 'system', `High error rate: ${(this.metrics.performance.errorRate * 100).toFixed(1)}%`, 'HIGH');
        }
        // Check processing time
        if (this.metrics.performance.avgProcessingTime > this.config.alerting.processingTimeThreshold) {
            this.createAlert('WARNING', 'performance', `Slow processing: ${this.metrics.performance.avgProcessingTime}ms`, 'MEDIUM');
        }
        // Check CLV performance
        if (this.metrics.clvMetrics.avgCLV < this.config.alerting.clvThreshold) {
            this.createAlert('WARNING', 'clv', `Low CLV performance: ${(this.metrics.clvMetrics.avgCLV * 100).toFixed(2)}%`, 'MEDIUM');
        }
        // Check CLV target
        if (!this.metrics.clvMetrics.targetMet) {
            this.createAlert('WARNING', 'clv', `CLV target not met: ${(this.metrics.clvMetrics.positiveRate * 100).toFixed(1)}% positive (need 50%+)`, 'HIGH');
        }
        // Check compliance
        if (this.metrics.compliance.overallCompliance < this.config.alerting.complianceThreshold) {
            this.createAlert('ERROR', 'compliance', `Professional grading compliance below threshold: ${(this.metrics.compliance.overallCompliance * 100).toFixed(1)}%`, 'CRITICAL');
        }
        // Check system health
        if (this.metrics.systemHealth.status === 'UNHEALTHY') {
            this.createAlert('ERROR', 'system', `System unhealthy: ${this.metrics.systemHealth.operationalFeatures}/${this.metrics.systemHealth.totalFeatures} features operational`, 'CRITICAL');
        }
        // Update alerts in metrics
        this.metrics.alerts = Array.from(this.alerts.values())
            .filter(alert => !alert.acknowledged)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 50); // Limit to 50 most recent
    }
    /**
     * Create a new alert
     */
    createAlert(type, feature, message, severity) {
        const id = `${feature}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const alert = {
            id,
            type,
            feature,
            message,
            timestamp: new Date().toISOString(),
            severity,
            acknowledged: false
        };
        this.alerts.set(id, alert);
        // Emit alert event
        this.emit('alertCreated', alert);
        // Send notification if enabled
        if (this.config.notifications.enabled) {
            this.sendNotification(alert);
        }
        this.logger.warn(`🚨 Alert created: ${alert.type}/${alert.severity}`, {
            feature: alert.feature,
            message: alert.message,
            severity: alert.severity
        });
    }
    /**
     * Send notification for alert
     */
    async sendNotification(alert) {
        try {
            // In a real implementation, this would send to webhook, Slack, email, etc.
            this.logger.info('📧 Notification sent', {
                alertId: alert.id,
                type: alert.type,
                severity: alert.severity,
                message: alert.message
            });
            // Emit notification event
            this.emit('notificationSent', alert);
        }
        catch (error) {
            this.logger.error('❌ Failed to send notification', {
                alertId: alert.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.acknowledged = true;
            this.emit('alertAcknowledged', alert);
            this.logger.info('✅ Alert acknowledged', {
                alertId,
                feature: alert.feature,
                message: alert.message
            });
            return true;
        }
        return false;
    }
    /**
     * Resolve an alert
     */
    resolveAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.resolvedAt = new Date().toISOString();
            this.emit('alertResolved', alert);
            this.logger.info('✅ Alert resolved', {
                alertId,
                feature: alert.feature,
                message: alert.message
            });
            return true;
        }
        return false;
    }
    /**
     * Clean up old alerts
     */
    cleanupOldAlerts() {
        const cutoffTime = Date.now() - (this.config.alertRetentionTime * 60 * 60 * 1000);
        for (const [id, alert] of this.alerts.entries()) {
            const alertTime = new Date(alert.timestamp).getTime();
            if (alertTime < cutoffTime) {
                this.alerts.delete(id);
            }
        }
    }
    /**
     * Store metrics history
     */
    storeMetricsHistory() {
        this.metricsHistory.push({ ...this.metrics });
        // Keep only recent history
        const maxHistory = this.config.metricsRetentionDays * 24 * (3600 / (this.config.updateInterval / 1000));
        if (this.metricsHistory.length > maxHistory) {
            this.metricsHistory = this.metricsHistory.slice(-maxHistory);
        }
    }
    /**
     * Update feature metrics
     */
    updateFeatureMetrics(featureName, update) {
        const current = this.metrics.features[featureName];
        this.metrics.features[featureName] = { ...current, ...update };
        this.emit('featureMetricsUpdated', featureName, this.metrics.features[featureName]);
    }
    /**
     * Record feature processing
     */
    recordProcessing(featureName, processingTime, success, confidence) {
        const feature = this.metrics.features[featureName];
        feature.processed++;
        feature.avgProcessingTime = (feature.avgProcessingTime + processingTime) / 2;
        if (success) {
            feature.lastSuccess = new Date().toISOString();
            if (confidence !== undefined) {
                feature.confidence = (feature.confidence + confidence) / 2;
            }
        }
        // Update success rate
        const totalAttempts = feature.processed;
        const successfulAttempts = Math.floor(totalAttempts * feature.successRate);
        const newSuccessfulAttempts = success ? successfulAttempts + 1 : successfulAttempts;
        feature.successRate = newSuccessfulAttempts / totalAttempts;
        // Update health status
        if (feature.successRate >= 0.95) {
            feature.health = 'HEALTHY';
        }
        else if (feature.successRate >= 0.85) {
            feature.health = 'DEGRADED';
        }
        else {
            feature.health = 'UNHEALTHY';
        }
        // Update performance metrics
        this.metrics.performance.totalProcessed++;
        this.metrics.performance.avgProcessingTime =
            (this.metrics.performance.avgProcessingTime + processingTime) / 2;
        // Update error rate
        const totalProcessed = this.metrics.performance.totalProcessed;
        const successfulProcessed = Math.floor(totalProcessed * this.metrics.performance.successRate);
        const newSuccessfulProcessed = success ? successfulProcessed + 1 : successfulProcessed;
        this.metrics.performance.successRate = newSuccessfulProcessed / totalProcessed;
        this.metrics.performance.errorRate = 1 - this.metrics.performance.successRate;
    }
    /**
     * Get current metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Get metrics history
     */
    getMetricsHistory(hours) {
        if (!hours) {
            return [...this.metricsHistory];
        }
        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
        return this.metricsHistory.filter(metrics => new Date(metrics.timestamp).getTime() >= cutoffTime);
    }
    /**
     * Get system status summary
     */
    getSystemStatus() {
        const uptime = Math.floor(this.metrics.systemHealth.uptime);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        return {
            status: this.metrics.systemHealth.status,
            uptime: `${hours}h ${minutes}m`,
            performance: `${Math.round(this.metrics.performance.avgProcessingTime)}ms avg`,
            clv: `${(this.metrics.clvMetrics.positiveRate * 100).toFixed(1)}% positive`,
            compliance: `${(this.metrics.compliance.overallCompliance * 100).toFixed(1)}%`,
            alerts: this.metrics.alerts.length
        };
    }
    /**
     * Export metrics for external systems
     */
    exportMetrics(format = 'json') {
        if (format === 'prometheus') {
            return this.toPrometheusFormat();
        }
        return JSON.stringify(this.metrics, null, 2);
    }
    /**
     * Convert metrics to Prometheus format
     */
    toPrometheusFormat() {
        const lines = [];
        // System metrics
        lines.push(`professional_features_uptime_seconds ${this.metrics.systemHealth.uptime}`);
        lines.push(`professional_features_operational_count ${this.metrics.systemHealth.operationalFeatures}`);
        // Performance metrics
        lines.push(`professional_features_processing_time_ms ${this.metrics.performance.avgProcessingTime}`);
        lines.push(`professional_features_error_rate ${this.metrics.performance.errorRate}`);
        lines.push(`professional_features_throughput_per_minute ${this.metrics.performance.throughputPerMinute}`);
        // CLV metrics
        lines.push(`professional_features_clv_avg ${this.metrics.clvMetrics.avgCLV}`);
        lines.push(`professional_features_clv_positive_rate ${this.metrics.clvMetrics.positiveRate}`);
        // Compliance metrics
        lines.push(`professional_features_compliance_overall ${this.metrics.compliance.overallCompliance}`);
        // Feature-specific metrics
        Object.entries(this.metrics.features).forEach(([name, feature]) => {
            lines.push(`professional_features_feature_processed{feature="${name}"} ${feature.processed}`);
            lines.push(`professional_features_feature_success_rate{feature="${name}"} ${feature.successRate}`);
            lines.push(`professional_features_feature_processing_time{feature="${name}"} ${feature.avgProcessingTime}`);
        });
        return lines.join('\n');
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.logger.info('⚙️ Dashboard configuration updated', {
            updatedFields: Object.keys(config)
        });
    }
}
exports.ProfessionalFeaturesDashboard = ProfessionalFeaturesDashboard;
