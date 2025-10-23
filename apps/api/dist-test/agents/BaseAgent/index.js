"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = exports.createBaseAgentConfig = void 0;
const events_1 = require("events");
const distributed_tracing_1 = require("../../monitoring/distributed-tracing");
const enhanced_health_checks_1 = require("../../monitoring/enhanced-health-checks");
const enhanced_circuit_breaker_1 = require("../../services/enhanced-circuit-breaker");
const config_1 = require("./config");
var config_2 = require("./config");
Object.defineProperty(exports, "createBaseAgentConfig", { enumerable: true, get: function () { return config_2.createBaseAgentConfig; } });
/**
 * Production-grade BaseAgent with enhanced lifecycle management
 * Combines the robustness of the main repo with the clean architecture of the droid repo
 */
class BaseAgent extends events_1.EventEmitter {
    // Expose commonly used dependencies as protected properties
    get supabase() {
        return this.deps.supabase;
    }
    get logger() {
        return distributed_tracing_1.tracedLogger;
    }
    get errorHandler() {
        return this.deps.errorHandler;
    }
    constructor(config, deps) {
        super();
        this.status = 'idle';
        this.processLoopActive = false;
        this.deps = deps;
        // Validate and fix config using factory function
        try {
            this.config = (0, config_1.validateBaseAgentConfig)(config);
        }
        catch (error) {
            // If validation fails, use factory to create proper config
            if (deps?.logger) {
                deps.logger.warn('Config validation failed, using factory to create proper config', {
                    err: error instanceof Error ? error.message : String(error)
                });
            }
            this.config = (0, config_1.createBaseAgentConfig)(config);
        }
        // Initialize metrics
        this.metrics = {
            agentName: this.config.name,
            successCount: 0,
            errorCount: 0,
            warningCount: 0,
            processingTimeMs: 0,
            memoryUsageMb: 0
        };
        // Set up error handling
        this.on('error', (error) => {
            this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;
            if (this.deps.errorHandler) {
                this.deps.errorHandler.handleError(error, {
                    agentName: this.config.name,
                    status: this.status,
                    context: 'BaseAgent'
                });
            }
        });
    }
    // Enhanced health check that includes dependency validation
    async getEnhancedHealth() {
        try {
            // Get agent-specific health
            const agentHealth = await this.checkHealth();
            // Get dependency health checks
            const dependencies = [];
            // Check Supabase if agent uses it
            if (this.hasSupabase()) {
                const supabaseHealth = enhanced_health_checks_1.healthChecker.getDependencyHealth('supabase');
                if (supabaseHealth) {
                    dependencies.push(supabaseHealth);
                }
            }
            // Check circuit breaker status for services this agent might use
            const circuitBreakerHealth = enhanced_circuit_breaker_1.circuitBreaker.getHealthStatus();
            const relevantServices = circuitBreakerHealth.services.filter(s => s.name.includes('openai') || s.name.includes('discord') || s.name.includes('supabase'));
            // Add circuit breaker states as health checks
            relevantServices.forEach(service => {
                dependencies.push({
                    name: `circuit_breaker_${service.name}`,
                    status: service.healthy ? 'healthy' : 'degraded',
                    critical: false,
                    lastCheck: new Date().toISOString(),
                    metadata: {
                        circuit_state: service.state,
                        failure_rate: service.failureRate
                    }
                });
            });
            // Determine overall health
            const criticalDependenciesUnhealthy = dependencies
                .filter(d => d.critical && d.status === 'unhealthy').length > 0;
            const anyDependenciesUnhealthy = dependencies
                .filter(d => d.status === 'unhealthy').length > 0;
            const agentUnhealthy = agentHealth.status === 'unhealthy';
            let overall;
            if (agentUnhealthy || criticalDependenciesUnhealthy) {
                overall = 'unhealthy';
            }
            else if (anyDependenciesUnhealthy || agentHealth.status === 'degraded') {
                overall = 'degraded';
            }
            else {
                overall = 'healthy';
            }
            return {
                agent: agentHealth,
                dependencies,
                overall
            };
        }
        catch (error) {
            this.logger.error('Enhanced health check failed', {
                agentName: this.config.name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                agent: {
                    status: 'unhealthy',
                    timestamp: new Date().toISOString(),
                    details: { error: 'Health check system failure' }
                },
                dependencies: [],
                overall: 'unhealthy'
            };
        }
    }
    // Register agent with health check system
    registerAgentHealthCheck() {
        const agentName = this.config.name.toLowerCase().replace(/agent$/, '');
        enhanced_health_checks_1.healthChecker.registerDependency({
            name: `agent_${agentName}`,
            critical: true,
            timeout: 5000,
            checkInterval: 30000, // 30 seconds
            healthCheckFn: async () => {
                try {
                    const startTime = Date.now();
                    const health = await this.checkHealth();
                    return {
                        healthy: health.status === 'healthy',
                        responseTime: Date.now() - startTime,
                        error: health.status !== 'healthy' ?
                            JSON.stringify(health.details) : undefined,
                        metadata: {
                            agentStatus: this.status,
                            metrics: this.metrics,
                            ...health.details
                        }
                    };
                }
                catch (error) {
                    return {
                        healthy: false,
                        error: error instanceof Error ? error.message : 'Agent health check failed'
                    };
                }
            }
        });
        this.logger.debug('Agent registered with health check system', {
            agentName: this.config.name,
            healthCheckName: `agent_${agentName}`
        });
    }
    // Public lifecycle methods
    async start() {
        try {
            // Register with health check system
            this.registerAgentHealthCheck();
            this.status = 'starting';
            this.logger.info(`Starting ${this.config.name}...`);
            await this.initialize();
            // Start health checks if enabled
            if (this.config.health?.enabled) {
                this.healthCheckInterval = setInterval(() => this.runHealthCheck(), (this.config.health.interval || 30) * 1000);
            }
            // Start metrics collection if enabled
            if (this.config.metrics?.enabled) {
                this.metricsInterval = setInterval(() => this.runMetricsCollection(), (this.config.metrics.interval || 60) * 1000);
            }
            this.status = 'running';
            this.logger.info(`${this.config.name} started successfully`);
        }
        catch (error) {
            this.status = 'error';
            this.logger.error(`Failed to start ${this.config.name}:`, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async stop() {
        try {
            this.status = 'stopping';
            this.logger.info(`Stopping ${this.config.name}...`);
            // Clear intervals
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = undefined;
            }
            if (this.metricsInterval) {
                clearInterval(this.metricsInterval);
                this.metricsInterval = undefined;
            }
            // Stop process loop
            this.processLoopActive = false;
            // Run cleanup
            await this.cleanup();
            this.status = 'idle';
            this.logger.info(`${this.config.name} stopped successfully`);
        }
        catch (error) {
            this.status = 'error';
            this.logger.error(`Failed to stop ${this.config.name}:`, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    // Add the run method that agents are expecting
    async run() {
        try {
            this.processLoopActive = true;
            this.logger.info(`Running ${this.config.name} process...`);
            const startTime = Date.now();
            await this.process();
            const processingTime = Date.now() - startTime;
            this.metrics.processingTimeMs = processingTime;
            this.metrics.successCount = (this.metrics.successCount || 0) + 1;
            this.logger.info(`${this.config.name} process completed`, {
                processingTimeMs: processingTime
            });
        }
        catch (error) {
            this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;
            this.logger.error(`${this.config.name} process failed:`, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    // Health check runner
    async runHealthCheck() {
        try {
            const health = await this.checkHealth();
            this.status = health.status === 'healthy' ? 'running' : 'degraded';
            await this.recordHealth(health);
        }
        catch (error) {
            this.logger.error('Health check failed:', {
                err: error instanceof Error ? error.message : String(error)
            });
            this.status = 'error';
        }
    }
    // Metrics collection runner
    async runMetricsCollection() {
        try {
            this.metrics = await this.collectMetrics();
            this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
            await this.recordMetrics(this.metrics);
        }
        catch (error) {
            this.logger.error('Metrics collection failed:', {
                err: error instanceof Error ? error.message : String(error)
            });
        }
    }
    // Record health check results
    async recordHealth(health) {
        try {
            if (this.deps.supabase) {
                await this.deps.supabase.from('agent_health').insert([{
                        agent: this.config.name,
                        status: health.status,
                        details: health.details,
                        timestamp: health.timestamp || new Date().toISOString()
                    }]);
            }
        }
        catch (error) {
            this.logger.error('Failed to record health check:', {
                err: error instanceof Error ? error.message : String(error)
            });
        }
    }
    // Record metrics
    async recordMetrics(metrics) {
        try {
            if (this.deps.supabase) {
                await this.deps.supabase.from('agent_metrics').insert([{
                        agent: this.config.name,
                        ...metrics,
                        timestamp: new Date().toISOString()
                    }]);
            }
        }
        catch (error) {
            this.logger.error('Failed to record metrics:', {
                err: error instanceof Error ? error.message : String(error)
            });
        }
    }
    // Getters for status and metrics
    getStatus() {
        return this.status;
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getConfig() {
        return { ...this.config };
    }
    // Helper method to safely access supabase
    requireSupabase() {
        if (!this.supabase) {
            throw new Error(`${this.config.name}: Supabase client is required but not provided`);
        }
        return this.supabase;
    }
    // Helper method to check if supabase is available
    hasSupabase() {
        return !!this.supabase;
    }
    // Tracing helper methods
    getTraceId() {
        return distributed_tracing_1.tracer.getCurrentTraceId();
    }
    getSpanId() {
        return distributed_tracing_1.tracer.getCurrentSpanId();
    }
    addTraceEvent(name, attributes) {
        distributed_tracing_1.tracer.addEvent(name, attributes);
    }
    addTraceTags(tags) {
        distributed_tracing_1.tracer.addTags(tags);
    }
    // Helper method for wrapping operations with tracing
    async traceOperation(operation, fn, tags) {
        return distributed_tracing_1.tracer.runInSpan(operation, fn, this.config.name, tags);
    }
}
exports.BaseAgent = BaseAgent;
