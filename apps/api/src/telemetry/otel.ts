/**
 * OpenTelemetry Instrumentation
 *
 * Provides distributed tracing with OTLP export for:
 * - api.picks.insert
 * - db.write.picks / db.write.pick_publish
 * - outbox.publish
 *
 * Optional - safe no-op if OTEL_EXPORTER_OTLP_ENDPOINT not configured
 */

import { logger } from '../shared/logger';

// OpenTelemetry types (optional dependencies)
let tracer: any = null;
let isEnabled = false;

/**
 * Initialize OpenTelemetry tracing
 *
 * Reads OTEL_EXPORTER_OTLP_ENDPOINT from environment.
 * If not present, tracing is a no-op.
 */
export function initializeTracing(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!endpoint) {
    logger.info('OpenTelemetry disabled', {
      event: 'otel_disabled',
      reason: 'OTEL_EXPORTER_OTLP_ENDPOINT not configured',
    });
    return;
  }

  try {
    // Attempt to load OpenTelemetry packages (optional)
    const { trace } = require('@opentelemetry/api');
    const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');

    const provider = new NodeTracerProvider();
    const exporter = new OTLPTraceExporter({ url: endpoint });

    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.register();

    tracer = trace.getTracer('unit-talk-api', '1.0.0');
    isEnabled = true;

    logger.info('OpenTelemetry initialized', {
      event: 'otel_initialized',
      endpoint,
    });
  } catch (error) {
    logger.warn('OpenTelemetry initialization failed (optional dependency)', {
      event: 'otel_init_failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Create a span for tracing
 *
 * @param name - Span name (e.g., 'api.picks.insert')
 * @param attributes - Span attributes
 * @param fn - Function to execute within span
 * @returns Result of fn
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, any>,
  fn: () => Promise<T>
): Promise<T> {
  if (!isEnabled || !tracer) {
    // No-op if tracing not enabled
    return fn();
  }

  const span = tracer.startSpan(name, { attributes });

  try {
    const result = await fn();
    span.setStatus({ code: 1 }); // OK
    return result;
  } catch (error) {
    span.setStatus({
      code: 2, // ERROR
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add span attributes (if span is active)
 */
export function addSpanAttributes(attributes: Record<string, any>): void {
  if (!isEnabled || !tracer) {
    return;
  }

  try {
    const { trace } = require('@opentelemetry/api');
    const span = trace.getActiveSpan();
    if (span) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  } catch (error) {
    // Silent fail
  }
}

/**
 * Check if tracing is enabled
 */
export function isTracingEnabled(): boolean {
  return isEnabled;
}
