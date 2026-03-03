import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

import { logger } from '../shared/logger';

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
export class DistributedTracer {
  private static instance: DistributedTracer;
  private contextStorage = new AsyncLocalStorage<TraceContext>();
  private activeSpans = new Map<string, TraceSpan>();
  private completedSpans = new Map<string, TraceSpan[]>();
  private maxSpansPerTrace = 1000;
  private spanRetentionMs = 3600000; // 1 hour

  private constructor() {
    this.startCleanupInterval();
  }

  public static getInstance(): DistributedTracer {
    if (!DistributedTracer.instance) {
      DistributedTracer.instance = new DistributedTracer();
    }
    return DistributedTracer.instance;
  }

  /**
   * Start a new trace with a root span
   */
  public startTrace(operation: string, service: string, metadata?: Record<string, any>): string {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();

    const context: TraceContext = {
      traceId,
      spanId,
      operation,
      service,
      startTime: Date.now(),
      metadata,
    };

    const span: TraceSpan = {
      traceId,
      spanId,
      operation,
      service,
      startTime: context.startTime,
      tags: metadata || {},
      events: [],
    };

    this.activeSpans.set(spanId, span);

    logger.info('🚀 Trace started', {
      traceId,
      spanId,
      operation,
      service,
      metadata,
    });

    return traceId;
  }

  /**
   * Start a new span within the current trace context
   */
  public startSpan(operation: string, service?: string, tags?: Record<string, any>): string {
    const currentContext = this.getCurrentContext();
    const spanId = this.generateSpanId();

    const context: TraceContext = {
      traceId: currentContext?.traceId || this.generateTraceId(),
      spanId,
      parentSpanId: currentContext?.spanId,
      operation,
      service: service || currentContext?.service || 'unknown',
      startTime: Date.now(),
      metadata: tags,
    };

    const span: TraceSpan = {
      traceId: context.traceId,
      spanId,
      parentSpanId: context.parentSpanId,
      operation,
      service: context.service,
      startTime: context.startTime,
      tags: tags || {},
      events: [],
    };

    this.activeSpans.set(spanId, span);

    logger.debug('📊 Span started', {
      traceId: context.traceId,
      spanId,
      parentSpanId: context.parentSpanId,
      operation,
      service: context.service,
    });

    return spanId;
  }

  /**
   * Execute a function within a trace context
   */
  public async runInTrace<T>(
    operation: string,
    service: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
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
    } catch (error) {
      this.finishSpan(context.spanId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Execute a function within a span context
   */
  public async runInSpan<T>(
    operation: string,
    fn: () => Promise<T>,
    service?: string,
    tags?: Record<string, any>
  ): Promise<T> {
    const spanId = this.startSpan(operation, service, tags);
    const span = this.activeSpans.get(spanId);

    if (!span) {
      throw new Error('Failed to create span');
    }

    const context: TraceContext = {
      traceId: span.traceId,
      spanId,
      parentSpanId: span.parentSpanId,
      operation,
      service: span.service,
      startTime: span.startTime,
      metadata: tags,
    };

    try {
      return await this.contextStorage.run(context, async () => {
        const result = await fn();
        this.finishSpan(spanId, { success: true });
        return result;
      });
    } catch (error) {
      this.finishSpan(spanId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Finish a span with metrics
   */
  public finishSpan(spanId: string, metrics?: Partial<SpanMetrics>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      logger.warn('⚠️ Attempted to finish non-existent span', { spanId });
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

    const traceSpans = this.completedSpans.get(span.traceId)!;
    traceSpans.push(span);

    // Limit spans per trace
    if (traceSpans.length > this.maxSpansPerTrace) {
      traceSpans.shift(); // Remove oldest span
    }

    logger.debug('📈 Span finished', {
      traceId: span.traceId,
      spanId,
      operation: span.operation,
      service: span.service,
      duration,
      success: span.success,
      error: span.error,
    });

    // Log slow operations
    if (duration > 5000) {
      // 5 seconds
      logger.warn('🐌 Slow operation detected', {
        traceId: span.traceId,
        spanId,
        operation: span.operation,
        service: span.service,
        duration,
      });
    }
  }

  /**
   * Add an event to the current span
   */
  public addEvent(name: string, attributes?: Record<string, any>): void {
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
      attributes: attributes || {},
    });

    logger.debug('📝 Span event added', {
      traceId: context.traceId,
      spanId: context.spanId,
      event: name,
      attributes,
    });
  }

  /**
   * Add tags to the current span
   */
  public addTags(tags: Record<string, any>): void {
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
  public setError(error: Error | string): void {
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
      error_type: error instanceof Error ? error.constructor.name : 'string',
    });
  }

  /**
   * Get current trace context
   */
  public getCurrentContext(): TraceContext | undefined {
    return this.contextStorage.getStore();
  }

  /**
   * Get current trace ID
   */
  public getCurrentTraceId(): string | undefined {
    const context = this.getCurrentContext();
    return context?.traceId;
  }

  /**
   * Get current span ID
   */
  public getCurrentSpanId(): string | undefined {
    const context = this.getCurrentContext();
    return context?.spanId;
  }

  /**
   * Get trace context by trace ID
   */
  public getTraceContext(traceId: string): TraceContext | undefined {
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
          metadata: span.tags,
        };
      }
    }
    return undefined;
  }

  /**
   * Get all spans for a trace
   */
  public getTraceSpans(traceId: string): TraceSpan[] {
    const completedSpans = this.completedSpans.get(traceId) || [];
    const activeSpans = Array.from(this.activeSpans.values()).filter(
      span => span.traceId === traceId
    );

    return [...completedSpans, ...activeSpans];
  }

  /**
   * Get trace statistics
   */
  public getTraceStats(traceId: string): {
    totalSpans: number;
    totalDuration: number;
    avgDuration: number;
    errorCount: number;
    successRate: number;
  } | null {
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
      successRate:
        completedSpans.length > 0
          ? (completedSpans.length - errorCount) / completedSpans.length
          : 1,
    };
  }

  /**
   * Extract correlation headers for HTTP requests
   */
  public getCorrelationHeaders(): Record<string, string> {
    const context = this.getCurrentContext();
    if (!context) {
      return {};
    }

    return {
      'x-trace-id': context.traceId,
      'x-span-id': context.spanId,
      'x-parent-span-id': context.parentSpanId || '',
      'x-correlation-id': context.traceId, // Alias for compatibility
    };
  }

  /**
   * Inject correlation headers into HTTP request options
   */
  public injectHeaders(headers: Record<string, string> = {}): Record<string, string> {
    return {
      ...headers,
      ...this.getCorrelationHeaders(),
    };
  }

  /**
   * Extract trace context from HTTP headers
   */
  public extractFromHeaders(headers: Record<string, string>): TraceContext | null {
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
      startTime: Date.now(),
    };
  }

  /**
   * Create child context from extracted headers
   */
  public createChildContext(
    headers: Record<string, string>,
    operation: string,
    service: string
  ): TraceContext | null {
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
      startTime: Date.now(),
    };
  }

  // Private helper methods

  private generateTraceId(): string {
    return randomUUID().replace(/-/g, '');
  }

  private generateSpanId(): string {
    return randomUUID().replace(/-/g, '').substring(0, 16);
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldSpans();
    }, 300000); // 5 minutes
  }

  private cleanupOldSpans(): void {
    const cutoff = Date.now() - this.spanRetentionMs;
    let removedTraces = 0;

    for (const [traceId, spans] of this.completedSpans.entries()) {
      const oldestSpan = spans.reduce((oldest, span) =>
        span.startTime < oldest.startTime ? span : oldest
      );

      if (oldestSpan.startTime < cutoff) {
        this.completedSpans.delete(traceId);
        removedTraces++;
      }
    }

    if (removedTraces > 0) {
      logger.debug('🧹 Cleaned up old trace spans', { removedTraces });
    }
  }
}

// Global tracer instance
export const tracer = DistributedTracer.getInstance();

// Decorator for automatic span creation
export function Traced(operation?: string, service?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const spanOperation = operation || `${target.constructor.name}.${propertyName}`;
    const spanService = service || target.constructor.name.toLowerCase().replace(/agent$/, '');

    descriptor.value = async function (...args: any[]) {
      return tracer.runInSpan(spanOperation, () => method.apply(this, args), spanService, {
        method: propertyName,
        args: args.length,
      });
    };
  };
}

// Logger integration
export const tracedLogger: any = {
  ...logger,
  info: (message: string, meta?: any) => {
    const context = tracer.getCurrentContext();
    logger.info(message, {
      ...meta,
      traceId: context?.traceId,
      spanId: context?.spanId,
    });
  },

  warn: (message: string, meta?: any) => {
    const context = tracer.getCurrentContext();
    logger.warn(message, {
      ...meta,
      traceId: context?.traceId,
      spanId: context?.spanId,
    });
  },

  error: (message: string, meta?: any) => {
    const context = tracer.getCurrentContext();
    tracer.setError(message);
    logger.error(message, {
      ...meta,
      traceId: context?.traceId,
      spanId: context?.spanId,
    });
  },

  debug: (message: string, meta?: any) => {
    const context = tracer.getCurrentContext();
    logger.debug(message, {
      ...meta,
      traceId: context?.traceId,
      spanId: context?.spanId,
    });
  },
};
