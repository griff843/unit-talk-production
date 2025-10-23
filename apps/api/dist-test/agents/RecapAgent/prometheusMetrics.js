"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrometheusMetrics = void 0;
const http_1 = require("http");
const prom_client_1 = require("prom-client");
const picks_1 = require("../../types/picks");
/**
 * PrometheusMetrics - Exposes recap metrics for monitoring
 * Provides comprehensive metrics for production monitoring
 */
class PrometheusMetrics {
    constructor(port = 3001) {
        this.port = port;
        // Initialize metrics
        this.recapsSentCounter = new prom_client_1.Counter({
            name: 'recap_agent_recaps_sent_total',
            help: 'Total number of recaps sent successfully',
            labelNames: ['period', 'type']
        });
        this.recapsFailedCounter = new prom_client_1.Counter({
            name: 'recap_agent_recaps_failed_total',
            help: 'Total number of failed recap attempts',
            labelNames: ['period', 'error_type']
        });
        this.microRecapsCounter = new prom_client_1.Counter({
            name: 'recap_agent_micro_recaps_total',
            help: 'Total number of micro-recaps sent',
            labelNames: ['trigger']
        });
        this.slashCommandsCounter = new prom_client_1.Counter({
            name: 'recap_agent_slash_commands_total',
            help: 'Total number of slash commands processed',
            labelNames: ['command', 'period']
        });
        this.notionSyncsCounter = new prom_client_1.Counter({
            name: 'recap_agent_notion_syncs_total',
            help: 'Total number of Notion syncs completed',
            labelNames: ['period', 'status']
        });
        this.processingTimeHistogram = new prom_client_1.Histogram({
            name: 'recap_agent_processing_duration_seconds',
            help: 'Time spent processing recaps',
            labelNames: ['period', 'operation'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
        });
        this.activeRecapsGauge = new prom_client_1.Gauge({
            name: 'recap_agent_active_recaps',
            help: 'Number of recaps currently being processed',
            labelNames: ['period']
        });
        this.roiWatcherGauge = new prom_client_1.Gauge({
            name: 'recap_agent_roi_watcher_state',
            help: 'Current ROI watcher state',
            labelNames: ['metric']
        });
        // Collect default Node.js metrics
        (0, prom_client_1.collectDefaultMetrics)({ prefix: 'recap_agent_' });
    }
    /**
     * Initialize metrics server
     */
    async initialize() {
        try {
            this.server = (0, http_1.createServer)(async (req, res) => {
                if (req.url === '/metrics') {
                    res.setHeader('Content-Type', prom_client_1.register.contentType);
                    const metrics = await prom_client_1.register.metrics();
                    res.end(metrics);
                }
                else if (req.url === '/health') {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
                }
                else {
                    res.statusCode = 404;
                    res.end('Not Found');
                }
            });
            this.server.listen(this.port, () => {
                console.log(`Prometheus metrics server listening on port ${this.port}`);
            });
        }
        catch (error) {
            throw new picks_1.RecapError({
                code: 'METRICS_INIT_FAILED',
                message: `Failed to initialize metrics server: ${error}`,
                timestamp: new Date().toISOString(),
                severity: 'medium'
            });
        }
    }
    /**
     * Increment recaps sent counter
     */
    incrementRecapsSent(period, type = 'scheduled') {
        this.recapsSentCounter.inc({ period, type });
    }
    /**
     * Increment recaps failed counter
     */
    incrementRecapsFailed(period = 'unknown', errorType = 'unknown') {
        this.recapsFailedCounter.inc({ period, error_type: errorType });
    }
    /**
     * Increment micro-recaps counter
     */
    incrementMicroRecaps(trigger = 'unknown') {
        this.microRecapsCounter.inc({ trigger });
    }
    /**
     * Increment slash commands counter
     */
    incrementSlashCommands(command = 'recap', period = 'unknown') {
        this.slashCommandsCounter.inc({ command, period });
    }
    /**
     * Increment Notion syncs counter
     */
    incrementNotionSyncs(period, status = 'success') {
        this.notionSyncsCounter.inc({ period, status });
    }
    /**
     * Record processing time
     */
    recordProcessingTime(durationMs, period = 'unknown', operation = 'recap') {
        this.processingTimeHistogram.observe({ period, operation }, durationMs / 1000);
    }
    /**
     * Set active recaps gauge
     */
    setActiveRecaps(count, period) {
        this.activeRecapsGauge.set({ period }, count);
    }
    /**
     * Update ROI watcher state
     */
    updateRoiWatcherState(currentRoi, threshold, lastCheck) {
        this.roiWatcherGauge.set({ metric: 'current_roi' }, currentRoi);
        this.roiWatcherGauge.set({ metric: 'threshold' }, threshold);
        this.roiWatcherGauge.set({ metric: 'last_check_timestamp' }, lastCheck.getTime());
    }
    /**
     * Get current metrics as JSON
     */
    async getMetrics() {
        const metrics = await prom_client_1.register.getMetricsAsJSON();
        return {
            timestamp: new Date().toISOString(),
            metrics: metrics.reduce((acc, metric) => {
                acc[metric.name] = metric;
                return acc;
            }, {})
        };
    }
    /**
     * Reset all metrics (useful for testing)
     */
    resetMetrics() {
        prom_client_1.register.resetMetrics();
    }
    /**
     * Get metrics summary for health checks
     */
    async getMetricsSummary() {
        const metrics = await this.getMetrics();
        return {
            recapsSent: this.getMetricValue(metrics, 'recap_agent_recaps_sent_total'),
            recapsFailed: this.getMetricValue(metrics, 'recap_agent_recaps_failed_total'),
            microRecaps: this.getMetricValue(metrics, 'recap_agent_micro_recaps_total'),
            slashCommands: this.getMetricValue(metrics, 'recap_agent_slash_commands_total'),
            notionSyncs: this.getMetricValue(metrics, 'recap_agent_notion_syncs_total'),
            avgProcessingTime: this.getMetricValue(metrics, 'recap_agent_processing_duration_seconds'),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }
    /**
     * Helper to extract metric values
     */
    getMetricValue(metrics, metricName) {
        const metric = metrics.metrics[metricName];
        if (!metric || !metric.values) {
            return 0;
        }
        return metric.values.reduce((sum, value) => sum + (value.value || 0), 0);
    }
    /**
     * Create custom metric
     */
    createCustomCounter(name, help, labelNames = []) {
        return new prom_client_1.Counter({
            name: `recap_agent_${name}`,
            help,
            labelNames
        });
    }
    /**
     * Create custom histogram
     */
    createCustomHistogram(name, help, labelNames = [], buckets) {
        return new prom_client_1.Histogram({
            name: `recap_agent_${name}`,
            help,
            labelNames,
            ...(buckets && { buckets })
        });
    }
    /**
     * Create custom gauge
     */
    createCustomGauge(name, help, labelNames = []) {
        return new prom_client_1.Gauge({
            name: `recap_agent_${name}`,
            help,
            labelNames
        });
    }
    /**
     * Export metrics for external monitoring
     */
    async exportMetrics() {
        return await prom_client_1.register.metrics();
    }
    /**
     * Get server status
     */
    getServerStatus() {
        return {
            running: !!this.server,
            port: this.port,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('Prometheus metrics server stopped');
                    resolve();
                });
            });
        }
    }
}
exports.PrometheusMetrics = PrometheusMetrics;
