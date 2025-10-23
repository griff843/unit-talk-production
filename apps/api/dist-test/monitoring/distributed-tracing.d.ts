export interface TraceContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operation: string;
    service: string;
    startTime: number;
    metadata?: Record<string, any>;
}
export interface SpanMetrics {
    duration: number;
    success: boolean;
    error?: string;
    tags: Record<string, any>;
}
export interface TraceSpan {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operation: string;
    service: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    success?: boolean;
    error?: string;
    tags: Record<string, any>;
    events: Array<{
        timestamp: number;
        name: string;
        attributes: Record<string, any>;
    }>;
}
/**
 * Distributed tracing system with correlation IDs
 * Features:
 * - Request correlation across services
 * - Span hierarchy for operation tracing
 * - Performance metrics collection
 * - Error tracking and debugging
 * - Integration with logging system
 */
export declare class DistributedTracer {
    private static instance;
    private contextStorage;
    private activeSpans;
    private completedSpans;
    private maxSpansPerTrace;
    private spanRetentionMs;
    private constructor();
    static getInstance(): DistributedTracer;
    /**
     * Start a new trace with a root span
     */
    startTrace(operation: string, service: string, metadata?: Record<string, any>): string;
    /**
     * Start a new span within the current trace context
     */
    startSpan(operation: string, service?: string, tags?: Record<string, any>): string;
    /**
     * Execute a function within a trace context
     */
    runInTrace<T>(operation: string, service: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T>;
    /**
     * Execute a function within a span context
     */
    runInSpan<T>(operation: string, fn: () => Promise<T>, service?: string, tags?: Record<string, any>): Promise<T>;
    /**
     * Finish a span with metrics
     */
    finishSpan(spanId: string, metrics?: Partial<SpanMetrics>): void;
    /**
     * Add an event to the current span
     */
    addEvent(name: string, attributes?: Record<string, any>): void;
    /**
     * Add tags to the current span
     */
    addTags(tags: Record<string, any>): void;
    /**
     * Set error on current span
     */
    setError(error: Error | string): void;
    /**
     * Get current trace context
     */
    getCurrentContext(): TraceContext | undefined;
    /**
     * Get current trace ID
     */
    getCurrentTraceId(): string | undefined;
    /**
     * Get current span ID
     */
    getCurrentSpanId(): string | undefined;
    /**
     * Get trace context by trace ID
     */
    getTraceContext(traceId: string): TraceContext | undefined;
    /**
     * Get all spans for a trace
     */
    getTraceSpans(traceId: string): TraceSpan[];
    /**
     * Get trace statistics
     */
    getTraceStats(traceId: string): {
        totalSpans: number;
        totalDuration: number;
        avgDuration: number;
        errorCount: number;
        successRate: number;
    } | null;
    /**
     * Extract correlation headers for HTTP requests
     */
    getCorrelationHeaders(): Record<string, string>;
    /**
     * Inject correlation headers into HTTP request options
     */
    injectHeaders(headers?: Record<string, string>): Record<string, string>;
    /**
     * Extract trace context from HTTP headers
     */
    extractFromHeaders(headers: Record<string, string>): TraceContext | null;
    /**
     * Create child context from extracted headers
     */
    createChildContext(headers: Record<string, string>, operation: string, service: string): TraceContext | null;
    private generateTraceId;
    private generateSpanId;
    private startCleanupInterval;
    private cleanupOldSpans;
}
export declare const tracer: DistributedTracer;
export declare function Traced(operation?: string, service?: string): (target: any, propertyName: string, descriptor: PropertyDescriptor) => void;
export declare const tracedLogger: any;
//# sourceMappingURL=distributed-tracing.d.ts.map