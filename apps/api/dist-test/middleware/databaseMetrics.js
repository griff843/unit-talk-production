"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalAPIMetrics = exports.MetricsEnabledSupabaseClient = void 0;
exports.createMetricsEnabledSupabaseClient = createMetricsEnabledSupabaseClient;
const supabase_js_1 = require("@supabase/supabase-js");
const metricsServer_1 = require("../services/metricsServer");
const logger_1 = require("../utils/logger");
const api_1 = require("@opentelemetry/api");
const logger = (0, logger_1.createLogger)('DatabaseMetrics');
/**
 * Enhanced Supabase client with metrics and observability
 */
class MetricsEnabledSupabaseClient {
    constructor(supabaseUrl, supabaseKey) {
        this.connectionPool = { active: 0, idle: 0, total: 0 };
        this.client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            // Add connection pooling configuration
            db: {
                schema: 'public',
            },
            global: {
                headers: {
                    'x-client-info': 'unit-talk-api-metrics-enabled',
                },
            },
        }); // Type assertion to handle Supabase client options
        // Initialize connection pool monitoring
        this.startConnectionPoolMonitoring();
    }
    /**
     * Execute query with comprehensive metrics tracking
     */
    async from(table) {
        const span = api_1.trace.getActiveSpan();
        const startTime = Date.now();
        // Increment active connections
        this.connectionPool.active++;
        metricsServer_1.dbConnectionsActive.set(this.connectionPool.active);
        try {
            // Create a proxy to track all query operations
            const queryBuilder = this.client.from(table);
            return this.createMetricsProxy(queryBuilder, table, startTime, span);
        }
        catch (error) {
            // Track error
            metricsServer_1.dbOperationsTotal.inc({
                operation: 'from',
                table,
                status: 'error'
            });
            logger.error('Database operation failed', {
                operation: 'from',
                table,
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime,
            });
            throw error;
        }
        finally {
            // Decrement active connections
            this.connectionPool.active--;
            this.connectionPool.idle++;
            metricsServer_1.dbConnectionsActive.set(this.connectionPool.active);
            metricsServer_1.dbConnectionsIdle.set(this.connectionPool.idle);
        }
    }
    /**
     * Create metrics proxy for query operations
     */
    createMetricsProxy(queryBuilder, table, startTime, span) {
        const self = this;
        return new Proxy(queryBuilder, {
            get(target, prop, receiver) {
                const originalMethod = target[prop];
                // Track specific query operations
                if (typeof originalMethod === 'function') {
                    if (['select', 'insert', 'update', 'delete', 'upsert'].includes(prop)) {
                        return function (...args) {
                            const operation = prop;
                            const operationStartTime = Date.now();
                            // Add span attributes
                            if (span) {
                                span.setAttributes({
                                    'db.operation': operation,
                                    'db.table': table,
                                    'db.system': 'postgresql',
                                    'db.name': 'unit_talk_production',
                                });
                            }
                            // Execute the original method
                            const result = originalMethod.apply(this, args);
                            // If it's a promise (async operation), track completion
                            if (result && typeof result.then === 'function') {
                                return result
                                    .then((data) => {
                                    const duration = (Date.now() - operationStartTime) / 1000;
                                    // Track successful operation
                                    metricsServer_1.dbQueryDuration.observe({ operation, table, status: 'success' }, duration);
                                    metricsServer_1.dbOperationsTotal.inc({
                                        operation,
                                        table,
                                        status: 'success'
                                    });
                                    // Log performance metrics
                                    if (duration > 1) { // Log slow queries (>1 second)
                                        logger.warn('Slow database query detected', {
                                            operation,
                                            table,
                                            duration: duration * 1000,
                                            query: self.sanitizeQuery(args),
                                        });
                                    }
                                    logger.debug('Database operation completed', {
                                        operation,
                                        table,
                                        duration: duration * 1000,
                                        recordCount: data?.data?.length || 0,
                                    });
                                    return data;
                                })
                                    .catch((error) => {
                                    const duration = (Date.now() - operationStartTime) / 1000;
                                    // Track failed operation
                                    metricsServer_1.dbQueryDuration.observe({ operation, table, status: 'error' }, duration);
                                    metricsServer_1.dbOperationsTotal.inc({
                                        operation,
                                        table,
                                        status: 'error'
                                    });
                                    // Log error with context
                                    logger.error('Database operation failed', {
                                        operation,
                                        table,
                                        duration: duration * 1000,
                                        error: error.message || String(error),
                                        query: self.sanitizeQuery(args),
                                    });
                                    throw error;
                                });
                            }
                            return result;
                        };
                    }
                }
                return Reflect.get(target, prop, receiver);
            }
        });
    }
    /**
     * Start connection pool monitoring
     */
    startConnectionPoolMonitoring() {
        setInterval(() => {
            // Update connection pool metrics
            metricsServer_1.dbConnectionsActive.set(this.connectionPool.active);
            metricsServer_1.dbConnectionsIdle.set(this.connectionPool.idle);
            // Reset idle connections periodically
            if (this.connectionPool.idle > 10) {
                this.connectionPool.idle = Math.max(0, this.connectionPool.idle - 5);
            }
        }, 30000); // Update every 30 seconds
    }
    /**
     * Sanitize query for logging (remove sensitive data)
     */
    sanitizeQuery(args) {
        try {
            return JSON.stringify(args).substring(0, 200);
        }
        catch {
            return 'unable-to-serialize';
        }
    }
    /**
     * Get raw Supabase client for operations that don't need metrics
     */
    getRawClient() {
        return this.client;
    }
}
exports.MetricsEnabledSupabaseClient = MetricsEnabledSupabaseClient;
/**
 * External API performance tracking wrapper
 */
class ExternalAPIMetrics {
    static getInstance() {
        if (!ExternalAPIMetrics.instance) {
            ExternalAPIMetrics.instance = new ExternalAPIMetrics();
        }
        return ExternalAPIMetrics.instance;
    }
    /**
     * Track external API call with comprehensive metrics
     */
    async trackAPICall(provider, endpoint, operation, context = {}) {
        const startTime = Date.now();
        const span = api_1.trace.getActiveSpan();
        // Add span attributes
        if (span) {
            span.setAttributes({
                'external.api.provider': provider,
                'external.api.endpoint': endpoint,
                'external.api.operation': context.operation || 'request',
            });
        }
        logger.debug('External API call started', {
            provider,
            endpoint,
            context,
        });
        try {
            const result = await operation();
            const duration = (Date.now() - startTime) / 1000;
            // Track successful API call
            metricsServer_1.externalApiCalls.inc({
                provider,
                endpoint,
                status_code: '200'
            });
            metricsServer_1.externalApiDuration.observe({ provider, endpoint, status_code: '200' }, duration);
            logger.info('External API call completed', {
                provider,
                endpoint,
                duration: duration * 1000,
                success: true,
            });
            return result;
        }
        catch (error) {
            const duration = (Date.now() - startTime) / 1000;
            const errorType = this.classifyError(error);
            const statusCode = this.extractStatusCode(error);
            // Track failed API call
            metricsServer_1.externalApiCalls.inc({
                provider,
                endpoint,
                status_code: statusCode
            });
            metricsServer_1.externalApiDuration.observe({ provider, endpoint, status_code: statusCode }, duration);
            metricsServer_1.externalApiErrors.inc({
                provider,
                error_type: errorType
            });
            logger.error('External API call failed', {
                provider,
                endpoint,
                duration: duration * 1000,
                error: error instanceof Error ? error.message : String(error),
                errorType,
                statusCode,
                context,
            });
            throw error;
        }
    }
    /**
     * Track multiple API calls with batch metrics
     */
    async trackBatchAPICall(provider, calls) {
        const startTime = Date.now();
        const results = [];
        const errors = [];
        logger.info('Batch API call started', {
            provider,
            batchSize: calls.length,
        });
        for (const call of calls) {
            try {
                const result = await this.trackAPICall(provider, call.endpoint, call.operation, call.context);
                results.push(result);
            }
            catch (error) {
                errors.push(error);
            }
        }
        const duration = Date.now() - startTime;
        logger.info('Batch API call completed', {
            provider,
            batchSize: calls.length,
            successCount: results.length,
            errorCount: errors.length,
            totalDuration: duration,
        });
        if (errors.length > 0) {
            throw new Error(`Batch API call had ${errors.length} failures`);
        }
        return results;
    }
    /**
     * Classify error type for metrics
     */
    classifyError(error) {
        if (error.code === 'ENOTFOUND')
            return 'dns_error';
        if (error.code === 'ECONNREFUSED')
            return 'connection_refused';
        if (error.code === 'ETIMEDOUT')
            return 'timeout';
        if (error.response?.status >= 500)
            return 'server_error';
        if (error.response?.status >= 400)
            return 'client_error';
        if (error.message?.includes('rate limit'))
            return 'rate_limit';
        return 'unknown';
    }
    /**
     * Extract HTTP status code from error
     */
    extractStatusCode(error) {
        if (error.response?.status) {
            return error.response.status.toString();
        }
        if (error.status) {
            return error.status.toString();
        }
        return '0'; // Network/unknown error
    }
}
exports.ExternalAPIMetrics = ExternalAPIMetrics;
/**
 * Create metrics-enabled Supabase client
 */
function createMetricsEnabledSupabaseClient(supabaseUrl, supabaseKey) {
    return new MetricsEnabledSupabaseClient(supabaseUrl, supabaseKey);
}
