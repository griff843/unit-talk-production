"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthChecker = void 0;
const logging_1 = require("../../../services/logging");
class HealthChecker {
    constructor(supabase, performanceTracker) {
        this.supabase = supabase;
        this.performanceTracker = performanceTracker;
        this.version = '2.0.0';
        this.setupHealthCheck();
    }
    static getInstance(supabase, performanceTracker) {
        if (!HealthChecker.instance) {
            HealthChecker.instance = new HealthChecker(supabase, performanceTracker);
        }
        return HealthChecker.instance;
    }
    setupHealthCheck() {
        setInterval(() => this.check(), 30000); // Check every 30 seconds
    }
    async check() {
        const components = {
            database: await this.checkDatabase(),
            config: { status: 'healthy', last_success: new Date().toISOString() },
            metrics: await this.checkMetrics(),
            performance: await this.checkPerformance()
        };
        const status = this.determineOverallStatus(components);
        this.lastStatus = {
            status,
            components,
            last_check: new Date().toISOString(),
            version: this.version
        };
        if (status !== 'healthy') {
            logging_1.logger.warn('Health check detected issues:', this.lastStatus);
        }
        return this.lastStatus;
    }
    async checkDatabase() {
        const start = Date.now();
        try {
            const { error } = await this.supabase
                .from('health_checks')
                .select('count')
                .single();
            if (error) {
                throw error;
            }
            return {
                status: 'healthy',
                latency_ms: Date.now() - start,
                last_success: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error),
                latency_ms: Date.now() - start
            };
        }
    }
    async checkMetrics() {
        try {
            const metrics = await fetch('http://localhost:9002/metrics');
            if (!metrics.ok) {
                throw new Error('Metrics endpoint returned non-200 status');
            }
            return {
                status: 'healthy',
                ...(metrics.status === 200 && { latency_ms: 0 }),
                last_success: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async checkPerformance() {
        try {
            const metrics = this.performanceTracker.getMetrics();
            const failureRate = metrics.failed / (metrics.total_processed || 1);
            return {
                status: failureRate < 0.05 ? 'healthy' : failureRate < 0.1 ? 'degraded' : 'unhealthy',
                latency_ms: metrics.processing_time_ms / (metrics.total_processed || 1),
                last_success: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    determineOverallStatus(components) {
        const statuses = Object.values(components).map(c => c.status);
        if (statuses.some(s => s === 'unhealthy')) {
            return 'unhealthy';
        }
        if (statuses.some(s => s === 'degraded')) {
            return 'degraded';
        }
        return 'healthy';
    }
    getLastStatus() {
        return this.lastStatus;
    }
}
exports.HealthChecker = HealthChecker;
