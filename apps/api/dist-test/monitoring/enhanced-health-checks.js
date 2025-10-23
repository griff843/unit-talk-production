"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHealthCheck = exports.healthCheckMiddleware = exports.healthChecker = exports.EnhancedHealthChecker = void 0;
const enhanced_cache_1 = require("../cache/enhanced-cache");
const enhanced_circuit_breaker_1 = require("../services/enhanced-circuit-breaker");
const logger_1 = require("../shared/logger");
/**
 * Enhanced health check system with dependency validation,
 * circuit breaker integration, and comprehensive monitoring
 */
class EnhancedHealthChecker {
    constructor() {
        this.dependencies = new Map();
        this.lastResults = new Map();
        this.checkIntervals = new Map();
        this.systemStartTime = Date.now();
        this.registerCoreDependencies();
        this.startPeriodicChecks();
    }
    /**
     * Register core system dependencies
     */
    registerCoreDependencies() {
        // Database dependencies
        this.registerDependency({
            name: 'supabase',
            critical: true,
            timeout: 5000,
            checkInterval: 30000, // 30 seconds
            healthCheckFn: async () => {
                const startTime = Date.now();
                try {
                    // Check if we have env vars
                    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
                        throw new Error('Missing Supabase configuration');
                    }
                    // Use circuit breaker for Supabase check
                    const _result = await enhanced_circuit_breaker_1.circuitBreaker.executeCall(// Circuit breaker test
                    'supabase-health', async () => {
                        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
                        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
                        // Simple connectivity test
                        const { error } = await supabase
                            .from('unified_picks')
                            .select('count')
                            .limit(1);
                        if (error) {
                            throw new Error(`Supabase query failed: ${error.message}`);
                        }
                        return { success: true };
                    });
                    return {
                        healthy: true,
                        responseTime: Date.now() - startTime,
                        metadata: {
                            url: process.env.SUPABASE_URL,
                            circuit_state: enhanced_circuit_breaker_1.circuitBreaker.getServiceStatus('supabase')?.state
                        }
                    };
                }
                catch (error) {
                    return {
                        healthy: false,
                        responseTime: Date.now() - startTime,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            }
        });
        // Redis cache dependency
        this.registerDependency({
            name: 'redis',
            critical: false, // Not critical - system can work without cache
            timeout: 3000,
            checkInterval: 20000, // 20 seconds
            healthCheckFn: async () => {
                const startTime = Date.now();
                try {
                    const result = await enhanced_cache_1.redisCache.healthCheck();
                    return {
                        healthy: result,
                        responseTime: Date.now() - startTime,
                        error: result ? undefined : 'Redis health check failed',
                        metadata: await enhanced_cache_1.redisCache.getStats()
                    };
                }
                catch (error) {
                    return {
                        healthy: false,
                        responseTime: Date.now() - startTime,
                        error: error instanceof Error ? error.message : 'Redis check failed'
                    };
                }
            }
        });
        // OpenAI API dependency
        this.registerDependency({
            name: 'openai',
            critical: false, // Can fallback to simpler advice
            timeout: 10000,
            checkInterval: 60000, // 1 minute
            healthCheckFn: async () => {
                const startTime = Date.now();
                try {
                    if (!process.env.OPENAI_API_KEY) {
                        throw new Error('Missing OpenAI API key');
                    }
                    const serviceStatus = enhanced_circuit_breaker_1.circuitBreaker.getServiceStatus('openai');
                    const isHealthy = serviceStatus?.state !== 'OPEN';
                    return {
                        healthy: isHealthy,
                        responseTime: Date.now() - startTime,
                        metadata: {
                            circuit_state: serviceStatus?.state,
                            recent_failures: serviceStatus?.metrics.recentErrors.length,
                            api_key_configured: !!process.env.OPENAI_API_KEY
                        }
                    };
                }
                catch (error) {
                    return {
                        healthy: false,
                        responseTime: Date.now() - startTime,
                        error: error instanceof Error ? error.message : 'OpenAI check failed'
                    };
                }
            }
        });
        // Discord API dependency
        this.registerDependency({
            name: 'discord',
            critical: true, // Critical for alerts
            timeout: 8000,
            checkInterval: 45000, // 45 seconds
            healthCheckFn: async () => {
                const startTime = Date.now();
                try {
                    if (!process.env.DISCORD_TOKEN) {
                        throw new Error('Missing Discord bot token');
                    }
                    const serviceStatus = enhanced_circuit_breaker_1.circuitBreaker.getServiceStatus('discord');
                    const isHealthy = serviceStatus?.state !== 'OPEN';
                    return {
                        healthy: isHealthy,
                        responseTime: Date.now() - startTime,
                        metadata: {
                            circuit_state: serviceStatus?.state,
                            recent_failures: serviceStatus?.metrics.recentErrors.length,
                            token_configured: !!process.env.DISCORD_TOKEN
                        }
                    };
                }
                catch (error) {
                    return {
                        healthy: false,
                        responseTime: Date.now() - startTime,
                        error: error instanceof Error ? error.message : 'Discord check failed'
                    };
                }
            }
        });
        // Memory and system resources
        this.registerDependency({
            name: 'system_resources',
            critical: true,
            timeout: 1000,
            checkInterval: 15000, // 15 seconds
            healthCheckFn: async () => {
                const startTime = Date.now();
                try {
                    const memUsage = process.memoryUsage();
                    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
                    const maxMemoryMB = 1024; // 1GB threshold
                    const isHealthy = memUsageMB < maxMemoryMB;
                    return {
                        healthy: isHealthy,
                        responseTime: Date.now() - startTime,
                        metadata: {
                            memory_usage_mb: Math.round(memUsageMB * 100) / 100,
                            memory_limit_mb: maxMemoryMB,
                            heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
                            external_mb: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
                            uptime_seconds: Math.round(process.uptime())
                        },
                        error: isHealthy ? undefined : `Memory usage ${memUsageMB}MB exceeds limit ${maxMemoryMB}MB`
                    };
                }
                catch (error) {
                    return {
                        healthy: false,
                        responseTime: Date.now() - startTime,
                        error: error instanceof Error ? error.message : 'System resource check failed'
                    };
                }
            }
        });
        logger_1.logger.info('🏥 Enhanced health checker initialized with dependencies', {
            dependencies: Array.from(this.dependencies.keys()),
            critical: Array.from(this.dependencies.values()).filter(d => d.critical).map(d => d.name)
        });
    }
    /**
     * Register a new dependency for health checking
     */
    registerDependency(config) {
        this.dependencies.set(config.name, config);
        // Start periodic checking for this dependency
        if (this.checkIntervals.has(config.name)) {
            clearInterval(this.checkIntervals.get(config.name));
        }
        const interval = setInterval(async () => {
            await this.checkDependency(config.name);
        }, config.checkInterval);
        this.checkIntervals.set(config.name, interval);
        logger_1.logger.info('📋 Dependency registered for health checking', {
            name: config.name,
            critical: config.critical,
            checkInterval: config.checkInterval
        });
    }
    /**
     * Check health of a specific dependency
     */
    async checkDependency(name) {
        const config = this.dependencies.get(name);
        if (!config) {
            return null;
        }
        try {
            const result = await Promise.race([
                config.healthCheckFn(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), config.timeout))
            ]);
            const healthCheck = {
                name,
                status: result.healthy ? 'healthy' : 'unhealthy',
                responseTime: result.responseTime,
                error: result.error,
                metadata: result.metadata,
                critical: config.critical,
                lastCheck: new Date().toISOString()
            };
            this.lastResults.set(name, healthCheck);
            // Log unhealthy critical dependencies
            if (!result.healthy && config.critical) {
                logger_1.logger.error('🚨 Critical dependency unhealthy', {
                    dependency: name,
                    error: result.error,
                    responseTime: result.responseTime
                });
            }
            return healthCheck;
        }
        catch (error) {
            const healthCheck = {
                name,
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                critical: config.critical,
                lastCheck: new Date().toISOString()
            };
            this.lastResults.set(name, healthCheck);
            if (config.critical) {
                logger_1.logger.error('🚨 Critical dependency check failed', {
                    dependency: name,
                    error: healthCheck.error
                });
            }
            return healthCheck;
        }
    }
    /**
     * Get comprehensive system health status
     */
    async getSystemHealth() {
        // Check all dependencies in parallel
        const checkPromises = Array.from(this.dependencies.keys()).map(name => this.checkDependency(name));
        const results = await Promise.all(checkPromises);
        const checks = results.filter((check) => check !== null);
        // Calculate summary statistics
        const summary = {
            total: checks.length,
            healthy: checks.filter(c => c.status === 'healthy').length,
            degraded: checks.filter(c => c.status === 'degraded').length,
            unhealthy: checks.filter(c => c.status === 'unhealthy').length,
            critical_failures: checks.filter(c => c.status === 'unhealthy' && c.critical).length
        };
        // Determine overall system status
        let systemStatus;
        if (summary.critical_failures > 0) {
            systemStatus = 'unhealthy';
        }
        else if (summary.unhealthy > 0 || summary.degraded > 0) {
            systemStatus = 'degraded';
        }
        else {
            systemStatus = 'healthy';
        }
        // Calculate performance metrics
        const memUsage = process.memoryUsage();
        const avgResponseTime = checks
            .filter(c => c.responseTime !== undefined)
            .reduce((sum, c) => sum + (c.responseTime || 0), 0) /
            Math.max(1, checks.filter(c => c.responseTime !== undefined).length);
        const health = {
            status: systemStatus,
            timestamp: new Date().toISOString(),
            uptime: Math.round((Date.now() - this.systemStartTime) / 1000),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            checks,
            summary,
            performance: {
                memory_usage_mb: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
                response_time_avg_ms: Math.round(avgResponseTime * 100) / 100
            }
        };
        return health;
    }
    /**
     * Get health status for a specific dependency
     */
    getDependencyHealth(name) {
        return this.lastResults.get(name) || null;
    }
    /**
     * Start periodic health checks for all dependencies
     */
    startPeriodicChecks() {
        // Initial check for all dependencies
        setTimeout(async () => {
            for (const name of this.dependencies.keys()) {
                await this.checkDependency(name);
            }
        }, 1000); // Wait 1 second after initialization
        logger_1.logger.info('🔄 Periodic health checks started');
    }
    /**
     * Stop all periodic health checks
     */
    stopPeriodicChecks() {
        for (const interval of this.checkIntervals.values()) {
            clearInterval(interval);
        }
        this.checkIntervals.clear();
        logger_1.logger.info('⏹️ Periodic health checks stopped');
    }
    /**
     * Get health check summary for logging/monitoring
     */
    getHealthSummary() {
        const checks = Array.from(this.lastResults.values());
        return {
            status: checks.every(c => c.status === 'healthy') ? 'healthy' :
                checks.some(c => c.status === 'unhealthy' && c.critical) ? 'unhealthy' : 'degraded',
            healthy_dependencies: checks.filter(c => c.status === 'healthy').map(c => c.name),
            unhealthy_dependencies: checks.filter(c => c.status === 'unhealthy').map(c => c.name),
            critical_issues: checks
                .filter(c => c.status === 'unhealthy' && c.critical)
                .map(c => `${c.name}: ${c.error}`)
        };
    }
    /**
     * Reset health status for a specific dependency
     */
    resetDependency(name) {
        this.lastResults.delete(name);
        logger_1.logger.info('🔄 Dependency health status reset', { dependency: name });
    }
    /**
     * Update dependency configuration
     */
    updateDependencyConfig(name, updates) {
        const current = this.dependencies.get(name);
        if (!current) {
            throw new Error(`Dependency ${name} not found`);
        }
        const updated = { ...current, ...updates };
        this.dependencies.set(name, updated);
        // Restart periodic checking with new interval if changed
        if (updates.checkInterval && updates.checkInterval !== current.checkInterval) {
            if (this.checkIntervals.has(name)) {
                clearInterval(this.checkIntervals.get(name));
            }
            const interval = setInterval(async () => {
                await this.checkDependency(name);
            }, updated.checkInterval);
            this.checkIntervals.set(name, interval);
        }
        logger_1.logger.info('⚙️ Dependency configuration updated', {
            dependency: name,
            updates: Object.keys(updates)
        });
    }
}
exports.EnhancedHealthChecker = EnhancedHealthChecker;
// Global health checker instance
exports.healthChecker = new EnhancedHealthChecker();
// Health check middleware for Express routes
const healthCheckMiddleware = async (req, res, next) => {
    try {
        const health = await exports.healthChecker.getSystemHealth();
        // Add health info to request for logging
        req.systemHealth = health;
        // Set appropriate status code
        const statusCode = health.status === 'healthy' ? 200 :
            health.status === 'degraded' ? 200 : 503;
        res.status(statusCode);
        next();
    }
    catch (error) {
        logger_1.logger.error('Health check middleware error', error);
        res.status(503);
        next();
    }
};
exports.healthCheckMiddleware = healthCheckMiddleware;
// Health check route handler
const handleHealthCheck = async (_req, res) => {
    try {
        const health = await exports.healthChecker.getSystemHealth();
        // Set cache headers
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        // Return appropriate status code
        const statusCode = health.status === 'healthy' ? 200 :
            health.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(health);
    }
    catch (error) {
        logger_1.logger.error('Health check handler error', error);
        res.status(503).json({
            status: 'unhealthy',
            error: 'Health check system failure',
            timestamp: new Date().toISOString()
        });
    }
};
exports.handleHealthCheck = handleHealthCheck;
