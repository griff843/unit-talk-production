"use strict";
/**
 * Shared Agent Configuration Factory
 * Eliminates code duplication across agent implementations
 * Provides standardized, type-safe agent configurations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentConfigFactory = void 0;
exports.createAgentConfig = createAgentConfig;
class AgentConfigFactory {
    /**
     * Create standardized base agent configuration
     * Eliminates the repeated configuration patterns across agents
     */
    static createBaseConfig(options) {
        const { name, version = '1.0.0', enabled = true, logLevel = 'info', customMetrics = {}, customRetry = {}, customHealth = {} } = options;
        return {
            name,
            version,
            enabled,
            logLevel,
            // Standardized metrics configuration
            metrics: {
                enabled: true,
                interval: 60000, // 1 minute
                labels: {
                    agent: name,
                    version,
                    environment: process.env['NODE_ENV'] || 'development'
                },
                ...customMetrics
            },
            // Standardized retry configuration with exponential backoff
            retry: {
                enabled: true,
                maxRetries: 3,
                maxAttempts: 3,
                backoffMs: 200,
                backoff: 200,
                maxBackoffMs: 5000,
                exponential: true,
                jitter: true,
                shouldRetry: (error) => {
                    // Don't retry validation errors or auth failures
                    if (error.message.includes('validation') ||
                        error.message.includes('unauthorized') ||
                        error.message.includes('forbidden')) {
                        return false;
                    }
                    return true;
                },
                ...customRetry
            },
            // Standardized health check configuration
            health: {
                enabled: true,
                interval: 30000, // 30 seconds
                timeout: 5000, // 5 seconds
                checkDb: true,
                checkExternal: false,
                endpoint: '/health',
                ...customHealth
            }
        };
    }
    /**
     * Create configuration for high-frequency agents (like GradingAgent)
     */
    static createHighFrequencyConfig(options) {
        return this.createBaseConfig({
            ...options,
            customMetrics: {
                interval: 30000, // 30 seconds for high-frequency monitoring
                ...options.customMetrics
            },
            customHealth: {
                interval: 15000, // 15 seconds health checks
                ...options.customHealth
            }
        });
    }
    /**
     * Create configuration for background/batch agents (like AuditAgent)
     */
    static createBatchConfig(options) {
        return this.createBaseConfig({
            ...options,
            customMetrics: {
                interval: 300000, // 5 minutes for batch agents
                ...options.customMetrics
            },
            customHealth: {
                interval: 60000, // 1 minute health checks
                checkExternal: true, // Batch agents often check external services
                ...options.customHealth
            },
            customRetry: {
                maxRetries: 5, // More retries for batch operations
                maxBackoffMs: 30000, // Longer backoff for batch
                ...options.customRetry
            }
        });
    }
    /**
     * Create configuration for real-time agents (like AlertAgent)
     */
    static createRealTimeConfig(options) {
        return this.createBaseConfig({
            ...options,
            customMetrics: {
                interval: 10000, // 10 seconds for real-time monitoring
                ...options.customMetrics
            },
            customHealth: {
                interval: 10000, // 10 seconds health checks
                timeout: 2000, // Faster timeout for real-time
                ...options.customHealth
            },
            customRetry: {
                maxRetries: 2, // Fewer retries for real-time (fail fast)
                backoffMs: 100,
                maxBackoffMs: 1000,
                ...options.customRetry
            }
        });
    }
    /**
     * Create configuration for development/testing
     */
    static createDevConfig(options) {
        return this.createBaseConfig({
            ...options,
            logLevel: 'debug',
            customMetrics: {
                interval: 5000, // 5 seconds for development
                ...options.customMetrics
            },
            customHealth: {
                interval: 5000,
                ...options.customHealth
            }
        });
    }
    /**
     * Create configuration for production with enhanced monitoring
     */
    static createProductionConfig(options) {
        return this.createBaseConfig({
            ...options,
            logLevel: 'info',
            customMetrics: {
                interval: 60000,
                labels: {
                    ...options.customMetrics?.labels,
                    environment: 'production',
                    deployment: process.env['DEPLOYMENT_ID'] || 'unknown'
                },
                ...options.customMetrics
            },
            customHealth: {
                interval: 30000,
                checkExternal: true, // Production should check external dependencies
                ...options.customHealth
            },
            customRetry: {
                maxRetries: 5, // More resilience in production
                ...options.customRetry
            }
        });
    }
}
exports.AgentConfigFactory = AgentConfigFactory;
/**
 * Utility function for quick agent config creation
 */
function createAgentConfig(name, type = 'base', overrides = {}) {
    const options = { name, ...overrides };
    switch (type) {
        case 'high-frequency':
            return AgentConfigFactory.createHighFrequencyConfig(options);
        case 'batch':
            return AgentConfigFactory.createBatchConfig(options);
        case 'real-time':
            return AgentConfigFactory.createRealTimeConfig(options);
        case 'dev':
            return AgentConfigFactory.createDevConfig(options);
        case 'production':
            return AgentConfigFactory.createProductionConfig(options);
        default:
            return AgentConfigFactory.createBaseConfig(options);
    }
}
