"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const logger_1 = require("../utils/logger");
class BaseAgent {
    constructor(dependencies) {
        this.status = 'idle';
        this.metrics = {
            successCount: 0,
            warningCount: 0,
            errorCount: 0,
            status: 'idle',
            agentName: '',
            timestamp: new Date().toISOString()
        };
        this.supabase = dependencies.supabase;
        this.logger = dependencies.logger || (0, logger_1.createLogger)(this.constructor.name);
        this.config = dependencies.config;
    }
    async runHealthCheck() {
        try {
            const health = await this.healthCheck();
            this.status = health.status;
            await this.recordHealth(health);
        }
        catch (error) {
            this.logger.error('Health check failed:', { err: error instanceof Error ? error.message : String(error) });
            this.status = 'unhealthy';
        }
    }
    async runMetricsCollection() {
        try {
            this.metrics = await this.collectMetrics();
            await this.recordMetrics(this.metrics);
        }
        catch (error) {
            this.logger.error('Metrics collection failed:', { err: error instanceof Error ? error.message : String(error) });
            this.metrics.status = 'unhealthy';
        }
    }
    async recordHealth(health) {
        try {
            await this.supabase.from('agent_health').insert([{
                    agent: this.config.name,
                    status: health.status,
                    details: health.details,
                    timestamp: health.timestamp || new Date().toISOString()
                }]);
        }
        catch (error) {
            this.logger.error('Failed to record health check:', { err: error instanceof Error ? error.message : String(error) });
            this.status = 'unhealthy';
        }
    }
    async recordMetrics(metrics) {
        try {
            await this.supabase.from('agent_metrics').insert([{
                    agent: this.config.name,
                    ...metrics,
                    timestamp: new Date().toISOString()
                }]);
        }
        catch (error) {
            this.logger.error('Failed to record metrics:', { err: error instanceof Error ? error.message : String(error) });
        }
    }
    async start() {
        try {
            await this.validateDependencies();
            await this.initializeResources();
            // Start health checks
            if (this.config.healthCheckInterval) {
                this.healthCheckInterval = setInterval(() => this.runHealthCheck(), this.config.healthCheckInterval);
            }
            // Start metrics collection
            if (this.config.metricsConfig?.interval) {
                this.metricsInterval = setInterval(() => this.runMetricsCollection(), this.config.metricsConfig.interval);
            }
            this.status = 'healthy';
            this.logger.info(`${this.config.name} started successfully`);
        }
        catch (error) {
            this.status = 'unhealthy';
            this.logger.error(`Failed to start ${this.config.name}:`, { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    async stop() {
        try {
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
            }
            if (this.metricsInterval) {
                clearInterval(this.metricsInterval);
            }
            await this.cleanup();
            this.status = 'idle';
            this.logger.info(`${this.config.name} stopped successfully`);
        }
        catch (error) {
            this.logger.error(`Failed to stop ${this.config.name}:`, { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
}
exports.BaseAgent = BaseAgent;
