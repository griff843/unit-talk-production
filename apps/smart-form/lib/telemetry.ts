/**
 * Telemetry Utility for Smart Form
 *
 * Provides lightweight telemetry spans for key operations.
 * Can be extended to use OpenTelemetry SDK in the future.
 *
 * Current implementation uses structured logging with timing.
 * Future: Integrate with @opentelemetry/api for distributed tracing.
 */

import { createRouteLogger } from './logger';

const log = createRouteLogger('Telemetry', 'INFO');

interface SpanOptions {
  attributes?: Record<string, string | number | boolean>;
  idempotencyKey?: string;
  pickId?: string;
}

interface TelemetrySpanInterface {
  name: string;
  startTime: number;
  attributes: Record<string, any>;
  setAttribute: (key: string, value: string | number | boolean) => void;
  setAttributes: (attributes: Record<string, any>) => void;
  recordException: (error: Error) => void;
  end: () => void;
}

class TelemetrySpan implements TelemetrySpanInterface {
  name: string;
  startTime: number;
  attributes: Record<string, any>;
  private _ended = false;

  constructor(name: string, options?: SpanOptions) {
    this.name = name;
    this.startTime = performance.now();
    this.attributes = {
      ...(options?.attributes || {}),
      idempotencyKey: options?.idempotencyKey,
      pickId: options?.pickId,
    };

    log.info({
      span: this.name,
      event: 'span.start',
      attributes: this.attributes,
    });
  }

  /**
   * Add attribute to span
   */
  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value;
  }

  /**
   * Add multiple attributes to span
   */
  setAttributes(attributes: Record<string, any>): void {
    this.attributes = { ...this.attributes, ...attributes };
  }

  /**
   * Record an exception in the span
   */
  recordException(error: Error): void {
    this.attributes.error = error.message;
    this.attributes.errorStack = error.stack;
    this.attributes.errorName = error.name;

    log.error({
      span: this.name,
      event: 'span.exception',
      error: error.message,
      stack: error.stack,
      attributes: this.attributes,
    });
  }

  /**
   * End the span and record duration
   */
  end(): void {
    if (this._ended) return;

    const duration = performance.now() - this.startTime;
    this._ended = true;

    log.info({
      span: this.name,
      event: 'span.end',
      durationMs: duration.toFixed(2),
      attributes: this.attributes,
    });
  }
}

/**
 * Create a new telemetry span
 */
export function createSpan(name: string, options?: SpanOptions): TelemetrySpanInterface {
  return new TelemetrySpan(name, options);
}

/**
 * Wrap an async function with automatic span creation
 */
export async function withSpan<T>(
  name: string,
  fn: (span: TelemetrySpanInterface) => Promise<T>,
  options?: SpanOptions
): Promise<T> {
  const span = createSpan(name, options);

  try {
    const result = await fn(span);
    span.end();
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.end();
    throw error;
  }
}

/**
 * Wrap a sync function with automatic span creation
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: TelemetrySpanInterface) => T,
  options?: SpanOptions
): T {
  const span = createSpan(name, options);

  try {
    const result = fn(span);
    span.end();
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.end();
    throw error;
  }
}

// Export types
export type { TelemetrySpanInterface as Span, SpanOptions };
