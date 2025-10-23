"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tracedLogger = exports.tracer = exports.DistributedTracer = void 0;
exports.Traced = Traced;
const async_hooks_1 = require("async_hooks");
const crypto_1 = require("crypto");
const logger_1 = require("../shared/logger");
/**
 * Distributed tracing system with correlation IDs
 * Features:
 * - Request correlation across services
 * - Span hierarchy for operation tracing
 * - Performance metrics collection
 * - Error tracking and debugging
 * - Integration with logging system
 */
class DistributedTracer {
    constructor() {
        this.contextStorage = new async_hooks_1.AsyncLocalStorage();
        this.activeSpans = new Map();
        this.completedSpans = new Map();
        this.maxSpansPerTrace = 1000;
        this.spanRetentionMs = 3600000; // 1 hour
        this.startCleanupInterval();
    }
    static getInstance() {
        if (!DistributedTracer.instance) {
            DistributedTracer.instance = new DistributedTracer();
        }
        return DistributedTracer.instance;
    }
    /**
     * Start a new trace with a root span
     */
    startTrace(operation, service, metadata) {
        const traceId = this.generateTraceId();
        const spanId = this.generateSpanId();
        const context = {
            traceId,
            spanId,
            operation,
            service,
            startTime: Date.now(),
            metadata
        };
        const span = {
            traceId,
            spanId,
            operation,
            service,
            startTime: context.startTime,
            tags: metadata || {},
            events: []
        };
        this.activeSpans.set(spanId, span);
        logger_1.logger.info('🚀 Trace started', {
            traceId,
            spanId,
            operation,
            service,
            metadata
        });
        return traceId;
    }
    /**
     * Start a new span within the current trace context
     */
    startSpan(operation, service, tags) {
        const currentContext = this.getCurrentContext();
        const spanId = this.generateSpanId();
        const context = {
            traceId: currentContext?.traceId || this.generateTraceId(),
            spanId,
            parentSpanId: currentContext?.spanId,
            operation,
            service: service || currentContext?.service || 'unknown',
            startTime: Date.now(),
            metadata: tags
        };
        const span = {
            traceId: context.traceId,
            spanId,
            parentSpanId: context.parentSpanId,
            operation,
            service: context.service,
            startTime: context.startTime,
            tags: tags || {},
            events: []
        };
        this.activeSpans.set(spanId, span);
        logger_1.logger.debug('📊 Span started', {
            traceId: context.traceId,
            spanId,
            parentSpanId: context.parentSpanId,
            operation,
            service: context.service
        });
        return spanId;
    }
    /**
     * Execute a function within a trace context
     */
    async runInTrace(operation, service, fn, metadata) {
        const traceId = this.startTrace(operation, service, metadata);
        const context = this.getTraceContext(traceId);
        if (!context) {
            throw new Error('Failed to create trace context');
        }
        try {
            return await this.contextStorage.run(context, async () => {
                const result = await fn();
                this.finishSpan(context.spanId, { success: true });
                return result;
            });
        }
        catch (error) {
            this.finishSpan(context.spanId, {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Execute a function within a span context
     */
    async runInSpan(operation, fn, service, tags) {
        const spanId = this.startSpan(operation, service, tags);
        const span = this.activeSpans.get(spanId);
        if (!span) {
            throw new Error('Failed to create span');
        }
        const context = {
            traceId: span.traceId,
            spanId,
            parentSpanId: span.parentSpanId,
            operation,
            service: span.service,
            startTime: span.startTime,
            metadata: tags
        };
        try {
            return await this.contextStorage.run(context, async () => {
                const result = await fn();
                this.finishSpan(spanId, { success: true });
                return result;
            });
        }
        catch (error) {
            this.finishSpan(spanId, {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Finish a span with metrics
     */
    finishSpan(spanId, metrics) {
        const span = this.activeSpans.get(spanId);
        if (!span) {
            logger_1.logger.warn('⚠️ Attempted to finish non-existent span', { spanId });
            return;
        }
        const endTime = Date.now();
        const duration = endTime - span.startTime;
        span.endTime = endTime;
        span.duration = duration;
        span.success = metrics?.success ?? true;
        span.error = metrics?.error;
        if (metrics?.tags) {
            span.tags = { ...span.tags, ...metrics.tags };
        }
        // Move from active to completed
        this.activeSpans.delete(spanId);
        if (!this.completedSpans.has(span.traceId)) {
            this.completedSpans.set(span.traceId, []);
        }
        const traceSpans = this.completedSpans.get(span.traceId);
        traceSpans.push(span);
        // Limit spans per trace
        if (traceSpans.length > this.maxSpansPerTrace) {
            traceSpans.shift(); // Remove oldest span
        }
        logger_1.logger.debug('📈 Span finished', {
            traceId: span.traceId,
            spanId,
            operation: span.operation,
            service: span.service,
            duration,
            success: span.success,
            error: span.error
        });
        // Log slow operations
        if (duration > 5000) { // 5 seconds
            logger_1.logger.warn('🐌 Slow operation detected', {
                traceId: span.traceId,
                spanId,
                operation: span.operation,
                service: span.service,
                duration
            });
        }
    }
    /**
     * Add an event to the current span
     */
    addEvent(name, attributes) {
        const context = this.getCurrentContext();
        if (!context) {
            return;
        }
        const span = this.activeSpans.get(context.spanId);
        if (!span) {
            return;
        }
        span.events.push({
            timestamp: Date.now(),
            name,
            attributes: attributes || {}
        });
        logger_1.logger.debug('📝 Span event added', {
            traceId: context.traceId,
            spanId: context.spanId,
            event: name,
            attributes
        });
    }
    /**
     * Add tags to the current span
     */
    addTags(tags) {
        const context = this.getCurrentContext();
        if (!context) {
            return;
        }
        const span = this.activeSpans.get(context.spanId);
        if (!span) {
            return;
        }
        span.tags = { ...span.tags, ...tags };
    }
    /**
     * Set error on current span
     */
    setError(error) {
        const context = this.getCurrentContext();
        if (!context) {
            return;
        }
        const span = this.activeSpans.get(context.spanId);
        if (!span) {
            return;
        }
        span.error = error instanceof Error ? error.message : error;
        span.success = false;
        this.addEvent('error', {
            error_message: span.error,
            error_type: error instanceof Error ? error.constructor.name : 'string'
        });
    }
    /**
     * Get current trace context
     */
    getCurrentContext() {
        return this.contextStorage.getStore();
    }
    /**
     * Get current trace ID
     */
    getCurrentTraceId() {
        const context = this.getCurrentContext();
        return context?.traceId;
    }
    /**
     * Get current span ID
     */
    getCurrentSpanId() {
        const context = this.getCurrentContext();
        return context?.spanId;
    }
    /**
     * Get trace context by trace ID
     */
    getTraceContext(traceId) {
        // Find active span for this trace
        for (const span of this.activeSpans.values()) {
            if (span.traceId === traceId) {
                return {
                    traceId: span.traceId,
                    spanId: span.spanId,
                    parentSpanId: span.parentSpanId,
                    operation: span.operation,
                    service: span.service,
                    startTime: span.startTime,
                    metadata: span.tags
                };
            }
        }
        return undefined;
    }
    /**
     * Get all spans for a trace
     */
    getTraceSpans(traceId) {
        const completedSpans = this.completedSpans.get(traceId) || [];
        const activeSpans = Array.from(this.activeSpans.values())
            .filter(span => span.traceId === traceId);
        return [...completedSpans, ...activeSpans];
    }
    /**
     * Get trace statistics
     */
    getTraceStats(traceId) {
        const spans = this.getTraceSpans(traceId);
        if (spans.length === 0) {
            return null;
        }
        const completedSpans = spans.filter(s => s.endTime !== undefined);
        const totalDuration = completedSpans.reduce((sum, s) => sum + (s.duration || 0), 0);
        const errorCount = completedSpans.filter(s => s.success === false).length;
        return {
            totalSpans: spans.length,
            totalDuration,
            avgDuration: completedSpans.length > 0 ? totalDuration / completedSpans.length : 0,
            errorCount,
            successRate: completedSpans.length > 0 ?
                (completedSpans.length - errorCount) / completedSpans.length : 1
        };
    }
    /**
     * Extract correlation headers for HTTP requests
     */
    getCorrelationHeaders() {
        const context = this.getCurrentContext();
        if (!context) {
            return {};
        }
        return {
            'x-trace-id': context.traceId,
            'x-span-id': context.spanId,
            'x-parent-span-id': context.parentSpanId || '',
            'x-correlation-id': context.traceId // Alias for compatibility
        };
    }
    /**
     * Inject correlation headers into HTTP request options
     */
    injectHeaders(headers = {}) {
        return {
            ...headers,
            ...this.getCorrelationHeaders()
        };
    }
    /**
     * Extract trace context from HTTP headers
     */
    extractFromHeaders(headers) {
        const traceId = headers['x-trace-id'] || headers['x-correlation-id'];
        const spanId = headers['x-span-id'];
        const parentSpanId = headers['x-parent-span-id'];
        if (!traceId) {
            return null;
        }
        return {
            traceId,
            spanId: spanId || this.generateSpanId(),
            parentSpanId: parentSpanId || undefined,
            operation: 'http_request',
            service: 'unknown',
            startTime: Date.now()
        };
    }
    /**
     * Create child context from extracted headers
     */
    createChildContext(headers, operation, service) {
        const parentContext = this.extractFromHeaders(headers);
        if (!parentContext) {
            return null;
        }
        return {
            traceId: parentContext.traceId,
            spanId: this.generateSpanId(),
            parentSpanId: parentContext.spanId,
            operation,
            service,
            startTime: Date.now()
        };
    }
    // Private helper methods
    generateTraceId() {
        return (0, crypto_1.randomUUID)().replace(/-/g, '');
    }
    generateSpanId() {
        return (0, crypto_1.randomUUID)().replace(/-/g, '').substring(0, 16);
    }
    startCleanupInterval() {
        setInterval(() => {
            this.cleanupOldSpans();
        }, 300000); // 5 minutes
    }
    cleanupOldSpans() {
        const cutoff = Date.now() - this.spanRetentionMs;
        let removedTraces = 0;
        for (const [traceId, spans] of this.completedSpans.entries()) {
            const oldestSpan = spans.reduce((oldest, span) => span.startTime < oldest.startTime ? span : oldest);
            if (oldestSpan.startTime < cutoff) {
                this.completedSpans.delete(traceId);
                removedTraces++;
            }
        }
        if (removedTraces > 0) {
            logger_1.logger.debug('🧹 Cleaned up old trace spans', { removedTraces });
        }
    }
}
exports.DistributedTracer = DistributedTracer;
// Global tracer instance
exports.tracer = DistributedTracer.getInstance();
// Decorator for automatic span creation
function Traced(operation, service) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        const spanOperation = operation || `${target.constructor.name}.${propertyName}`;
        const spanService = service || target.constructor.name.toLowerCase().replace(/agent$/, '');
        descriptor.value = async function (...args) {
            return exports.tracer.runInSpan(spanOperation, () => method.apply(this, args), spanService, { method: propertyName, args: args.length });
        };
    };
}
// Logger integration
exports.tracedLogger = {
    ...logger_1.logger,
    info: (message, meta) => {
        const context = exports.tracer.getCurrentContext();
        logger_1.logger.info(message, {
            ...meta,
            traceId: context?.traceId,
            spanId: context?.spanId
        });
    },
    warn: (message, meta) => {
        const context = exports.tracer.getCurrentContext();
        logger_1.logger.warn(message, {
            ...meta,
            traceId: context?.traceId,
            spanId: context?.spanId
        });
    },
    error: (message, meta) => {
        const context = exports.tracer.getCurrentContext();
        exports.tracer.setError(message);
        logger_1.logger.error(message, {
            ...meta,
            traceId: context?.traceId,
            spanId: context?.spanId
        });
    },
    debug: (message, meta) => {
        const context = exports.tracer.getCurrentContext();
        logger_1.logger.debug(message, {
            ...meta,
            traceId: context?.traceId,
            spanId: context?.spanId
        });
    }
};
