"use strict";
// /utils/health.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitor = exports.HealthCheck = void 0;
class HealthCheck {
    constructor(logger) {
        this.checkIntervals = new Map();
        this.healthChecks = new Map();
        this.logger = logger;
    }
    registerHealthCheck(agentName, checkFn) {
        this.healthChecks.set(agentName, checkFn);
    }
    async performHealthCheck(agentName) {
        const checkFn = this.healthChecks.get(agentName);
        if (!checkFn) {
            const errorStatus = {
                status: 'unhealthy',
                details: { error: `No health check registered for agent: ${agentName}` },
                timestamp: new Date().toISOString()
            };
            this.logger.warn('Health check failed', { agentName, status: errorStatus });
            return errorStatus;
        }
        try {
            const status = await checkFn();
            this.logger.info('Health check performed', { agentName, status });
            return status;
        }
        catch (error) {
            const errorStatus = {
                status: 'unhealthy',
                details: { err: error instanceof Error ? error.message : String(error) },
                timestamp: new Date().toISOString()
            };
            this.logger.warn('Health check failed', { agentName, status: errorStatus });
            return errorStatus;
        }
    }
    startHealthCheck(agentName, interval) {
        const intervalId = setInterval(() => {
            // Perform health check for the specific agent
            this.performHealthCheck(agentName).catch(error => {
                this.logger.error('Unhandled error in health check', { agentName, error });
            });
        }, interval);
        this.checkIntervals.set(agentName, intervalId);
        return intervalId;
    }
    async cleanup() {
        for (const [, interval] of this.checkIntervals.entries()) {
            if (interval) {
                clearInterval(Number(interval)); // Explicitly cast to number
            }
        }
        this.checkIntervals.clear();
        this.healthChecks.clear();
    }
}
exports.HealthCheck = HealthCheck;
class HealthMonitor {
    constructor(logger) {
        this.checkIntervals = new Map();
        this.logger = logger;
    }
    startHealthCheck(agentName, interval) {
        const intervalId = setInterval(() => {
            // Perform health check for the specific agent
            this.performHealthCheck(agentName);
        }, interval);
        this.checkIntervals.set(agentName, intervalId);
        return intervalId;
    }
    performHealthCheck(agentName) {
        // Implement specific health check logic for the agent
        this.logger.info(`Performing health check for agent: ${agentName}`);
    }
    stopHealthCheck(agentName) {
        const intervalId = this.checkIntervals.get(agentName);
        if (intervalId) {
            clearInterval(Number(intervalId)); // Explicitly cast to number
            this.checkIntervals.delete(agentName);
        }
    }
}
exports.HealthMonitor = HealthMonitor;
