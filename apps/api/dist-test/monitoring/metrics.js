"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metrics = void 0;
const express_1 = __importDefault(require("express"));
const prom_client_1 = require("prom-client");
const logger_1 = require("../utils/logger");
class Metrics {
    constructor() {
        this.metrics = new Map();
        this.collectors = new Map();
        // Standard metrics that all agents should track
        this.standardMetrics = {
            activityExecutions: {
                name: 'activity_executions_total',
                help: 'Total number of activity executions',
                labelNames: ['agent', 'activity', 'status']
            },
            activityDuration: {
                name: 'activity_duration_seconds',
                help: 'Duration of activity executions',
                labelNames: ['agent', 'activity'],
                buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
            },
            errorCount: {
                name: 'error_count_total',
                help: 'Total number of errors',
                labelNames: ['agent', 'error_type']
            },
            healthStatus: {
                name: 'health_status',
                help: 'Current health status (1 for healthy, 0 for unhealthy)',
                labelNames: ['agent']
            },
            lastActivityTimestamp: {
                name: 'last_activity_timestamp',
                help: 'Timestamp of last activity execution',
                labelNames: ['agent', 'activity']
            }
        };
        this.registry = new prom_client_1.Registry();
        this.logger = (0, logger_1.createLogger)('Metrics');
        this.initializeStandardMetrics();
        this.initializeCustomMetrics();
    }
    static getInstance() {
        if (!Metrics.instance) {
            Metrics.instance = new Metrics();
        }
        return Metrics.instance;
    }
    initializeStandardMetrics() {
        try {
            this.registerMetric('activityExecutions', new prom_client_1.Counter(this.standardMetrics.activityExecutions));
            this.registerMetric('activityDuration', new prom_client_1.Histogram(this.standardMetrics.activityDuration));
            this.registerMetric('errorCount', new prom_client_1.Counter(this.standardMetrics.errorCount));
            this.registerMetric('healthStatus', new prom_client_1.Gauge(this.standardMetrics.healthStatus));
            this.registerMetric('lastActivityTimestamp', new prom_client_1.Gauge(this.standardMetrics.lastActivityTimestamp));
            this.registry.setDefaultLabels({ app: 'unit-talk' });
            this.logger.info('Standard metrics initialized');
        }
        catch (error) {
            this.logger.error('Failed to initialize standard metrics:', { err: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    initializeCustomMetrics() {
        // Operation metrics
        this.collectors.set('operations_total', new prom_client_1.Counter({
            name: 'operations_total',
            help: 'Total number of operations processed',
            labelNames: ['operation', 'status'],
            registers: [this.registry]
        }));
        this.collectors.set('operation_duration_seconds', new prom_client_1.Histogram({
            name: 'operation_duration_seconds',
            help: 'Duration of operations in seconds',
            labelNames: ['operation'],
            buckets: [0.1, 0.5, 1, 2, 5, 10],
            registers: [this.registry]
        }));
        this.collectors.set('errors_total', new prom_client_1.Counter({
            name: 'errors_total',
            help: 'Total number of errors',
            labelNames: ['operation', 'error_type'],
            registers: [this.registry]
        }));
        this.collectors.set('queue_size', new prom_client_1.Gauge({
            name: 'queue_size',
            help: 'Current size of the processing queue',
            labelNames: ['queue_type'],
            registers: [this.registry]
        }));
        this.collectors.set('resource_usage', new prom_client_1.Gauge({
            name: 'resource_usage',
            help: 'Resource usage metrics',
            labelNames: ['resource_type'],
            registers: [this.registry]
        }));
        this.collectors.set('business_metrics', new prom_client_1.Gauge({
            name: 'business_metrics',
            help: 'Business-related metrics',
            labelNames: ['metric_type'],
            registers: [this.registry]
        }));
    }
    registerMetric(name, metric) {
        this.metrics.set(name, metric);
        this.registry.registerMetric(metric);
    }
    async initialize() {
        await this.startServer();
    }
    async startServer() {
        const app = (0, express_1.default)();
        app.get('/metrics', async (_, res) => {
            try {
                res.set('Content-Type', this.registry.contentType);
                res.end(await this.registry.metrics());
            }
            catch (error) {
                this.logger.error('Failed to serve metrics:', { err: error instanceof Error ? error.message : String(error) });
                res.status(500).end();
            }
        });
        this.server = app.listen(9100, () => {
            this.logger.info('Metrics server listening on port 9100');
        });
    }
    trackOperation(operation, status) {
        const counter = this.collectors.get('operations_total');
        counter.labels(operation, status).inc();
    }
    trackDuration(operation, durationMs) {
        const histogram = this.collectors.get('operation_duration_seconds');
        histogram.labels(operation).observe(durationMs / 1000);
    }
    trackError(operation, errorType) {
        const counter = this.collectors.get('errors_total');
        counter.labels(operation, errorType).inc();
    }
    setQueueSize(queueType, size) {
        const gauge = this.collectors.get('queue_size');
        gauge.labels(queueType).set(size);
    }
    setResourceUsage(resourceType, value) {
        const gauge = this.collectors.get('resource_usage');
        gauge.labels(resourceType).set(value);
    }
    setBusinessMetric(metricType, value) {
        const gauge = this.collectors.get('business_metrics');
        gauge.labels(metricType).set(value);
    }
    async shutdown() {
        if (this.server) {
            await new Promise((resolve, reject) => {
                this.server?.close((err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
        }
    }
}
exports.Metrics = Metrics;
