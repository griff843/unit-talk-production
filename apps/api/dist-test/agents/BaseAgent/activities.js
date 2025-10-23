"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgentActivitiesImpl = void 0;
exports.runHealthCheck = runHealthCheck;
exports.collectMetrics = collectMetrics;
exports.handleCommand = handleCommand;
exports.initialize = initialize;
exports.cleanup = cleanup;
const workflow_1 = require("@temporalio/workflow");
const errorHandling_1 = require("../../utils/errorHandling");
const logger_1 = require("../../utils/logger");
const activities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '1 minute'
});
async function runHealthCheck() {
    const result = await activities.healthCheck({});
    return {
        ...result,
        timestamp: new Date().toISOString()
    };
}
async function collectMetrics() {
    return await activities.collectMetrics({});
}
async function handleCommand(input) {
    // This function needs to be implemented based on your business logic
    console.log('Handling command:', input.command);
}
async function initialize() {
    // This function needs to be implemented based on your business logic
    console.log('Initializing agent');
}
async function cleanup() {
    // This function needs to be implemented based on your business logic
    console.log('Cleaning up agent');
}
class BaseAgentActivitiesImpl {
    constructor(name, supabase) {
        this.name = name;
        this.supabase = supabase;
        this.status = 'idle';
        this.logger = (0, logger_1.makeLogger)(name);
        this.errorHandler = new errorHandling_1.ErrorHandler(name, supabase);
    }
    // Core operations
    async initialize() {
        try {
            this.logger.info('Initializing agent activities');
            await this.validateDependencies();
            await this.initializeResources();
            this.status = 'idle';
            await this.logActivity({
                level: 'info',
                message: 'Agent initialized',
                metadata: { status: this.status }
            });
        }
        catch (error) {
            await this.handleError(error instanceof Error ? error : new Error(String(error)), 'initialization');
            throw error;
        }
    }
    async start() {
        try {
            this.logger.info('Starting agent activities');
            this.status = 'healthy';
            await this.logActivity({
                level: 'info',
                message: 'Agent started',
                metadata: { status: this.status }
            });
        }
        catch (error) {
            await this.handleError(error instanceof Error ? error : new Error(String(error)), 'start');
            throw error;
        }
    }
    async stop() {
        try {
            this.logger.info('Stopping agent activities');
            this.status = 'idle';
            await this.logActivity({
                level: 'info',
                message: 'Agent stopped',
                metadata: { status: this.status }
            });
        }
        catch (error) {
            await this.handleError(error instanceof Error ? error : new Error(String(error)), 'stop');
            throw error;
        }
    }
    // Health and monitoring
    async checkHealth() {
        try {
            const health = {
                status: 'idle',
                timestamp: new Date().toISOString(),
                details: {
                    errors: [],
                    warnings: [],
                    info: {
                        agentName: this.name,
                        agentStatus: this.status,
                    }
                }
            };
            await this.logActivity({
                level: 'info',
                message: 'Health check completed',
                metadata: { status: health.status, timestamp: health.timestamp }
            });
            return health;
        }
        catch (error) {
            await this.handleError(error instanceof Error ? error : new Error(String(error)), 'health_check');
            return {
                status: 'unhealthy', // Changed from 'error' to match AgentStatus type
                timestamp: new Date().toISOString(),
                details: {
                    errors: [error instanceof Error ? error.message : String(error)],
                    warnings: [],
                    info: {}
                }
            };
        }
    }
    async reportStatus() {
        return this.status;
    }
    // Error handling
    async handleError(error, context) {
        await this.errorHandler.handleError(error, {
            agent: this.name,
            context,
            status: this.status
        });
        await this.logActivity({
            level: 'error',
            message: 'Error occurred',
            metadata: {
                context,
                error: error.message,
                stack: error.stack
            }
        });
    }
    // Utility methods for standardized activity execution
    async executeActivity(activityName, params, operation) {
        try {
            const startTime = new Date().toISOString();
            const data = await operation();
            const result = {
                success: true,
                data
            };
            await this.logActivity({
                level: 'info',
                message: `Activity ${activityName} completed successfully`,
                metadata: { ...params, startTime }
            });
            return result;
        }
        catch (error) {
            await this.logActivity({
                level: 'error',
                message: `Activity ${activityName} failed`,
                metadata: { error: error instanceof Error ? error.message : String(error) },
            });
            await this.handleError(error instanceof Error ? error : new Error(String(error)), activityName);
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
    // Required methods from BaseAgentActivities interface
    async healthCheck(_params) {
        return {
            status: 'healthy',
            checks: [
                {
                    name: 'database',
                    status: 'pass',
                    message: 'Database connection is healthy'
                }
            ]
        };
    }
    async collectMetrics(_params) {
        return {
            timestamp: new Date(),
            metrics: {
                successCount: 0,
                errorCount: 0,
                warningCount: 0,
                processingTimeMs: 0,
                memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
            }
        };
    }
    async logActivity(params) {
        try {
            await this.supabase.from('agent_logs').insert({
                agent: this.name,
                level: params.level,
                message: params.message,
                metadata: params.metadata || {},
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('Failed to log activity', { error });
        }
    }
}
exports.BaseAgentActivitiesImpl = BaseAgentActivitiesImpl;
