/* eslint-disable max-lines */
/** OpenTelemetry instrumentation for Unit Talk Platform - tracing from ingest → scoring → publishing */

import { trace, context, propagation, Span, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { W3CTraceContextPropagator, CompositePropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { B3Propagator } from '@opentelemetry/propagator-b3';
import { JaegerPropagator } from '@opentelemetry/propagator-jaeger';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

import type { IncomingMessage, ClientRequest } from 'http';

/** Type guard: check if request is IncomingMessage (has url property) */
function isIncomingMessage(request: ClientRequest | IncomingMessage): request is IncomingMessage {
  return 'url' in request;
}

interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  otlpEndpoint?: string;
  enableConsoleExporter?: boolean;
  enableDebugLogs?: boolean;
  sampleRate?: number;
}

class UnitTalkTelemetry {
  private sdk: NodeSDK | null = null;
  private config: TelemetryConfig;

  constructor(config: TelemetryConfig) {
    this.config = {
      sampleRate: 1.0,
      otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      enableConsoleExporter: process.env.NODE_ENV !== 'production',
      enableDebugLogs: process.env.NODE_ENV === 'development',
      ...config,
    };
  }

  /** Build configured exporters */
  private buildExporters(): OTLPTraceExporter[] {
    const exporters: OTLPTraceExporter[] = [];
    if (this.config.otlpEndpoint) {
      exporters.push(
        new OTLPTraceExporter({
          url: this.config.otlpEndpoint,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
    return exporters;
  }

  /** Build configured instrumentations */
  private buildInstrumentations() {
    return [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req: IncomingMessage): boolean =>
          req.url?.includes('/health') || req.url?.includes('/static') || false,
        requestHook: (span: Span, request: ClientRequest | IncomingMessage): void => {
          const url = isIncomingMessage(request) ? request.url : undefined;
          span.setAttributes({
            'unit-talk.request.method': request.method || '',
            'unit-talk.request.path': url || '',
          });
        },
      }),
      new ExpressInstrumentation({
        ignoreLayers: [(name: string): boolean => name === 'cors' || name === 'helmet'],
      }),
      new PgInstrumentation({
        enhancedDatabaseReporting: true,
        responseHook: (span, responseInfo) => {
          if (responseInfo.data) {
            span.setAttributes({ 'unit-talk.db.rows_affected': responseInfo.data.rowCount || 0 });
          }
        },
      }),
      new RedisInstrumentation({
        responseHook: (span, cmdName, cmdArgs) => {
          span.setAttributes({
            'unit-talk.redis.command': cmdName,
            'unit-talk.redis.args_count': cmdArgs.length,
          });
        },
      }),
      new WinstonInstrumentation(),
    ];
  }

  /** Initialize OpenTelemetry with comprehensive instrumentation */
  initialize(): void {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'unit-talk',
      'unit-talk.component': this.config.serviceName,
      'unit-talk.platform': 'sports-intelligence',
    });

    const exporters = this.buildExporters();
    this.sdk = new NodeSDK({
      resource,
      traceExporter: exporters[0],
      instrumentations: this.buildInstrumentations(),
      textMapPropagator: new CompositePropagator({
        propagators: [new W3CTraceContextPropagator(), new B3Propagator(), new JaegerPropagator()],
      }),
    });
    this.sdk.start();

    if (this.config.enableDebugLogs) {
      console.log(`🔍 Unit Talk Telemetry initialized for ${this.config.serviceName}`);
      console.log(`📡 OTLP Endpoint: ${this.config.otlpEndpoint}`);
      console.log(`🌍 Environment: ${this.config.environment}`);
    }
  }

  /** Graceful shutdown */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('🔍 Unit Talk Telemetry shut down gracefully');
    }
  }
}

/** Custom span utility for Unit Talk business operations */
export class UnitTalkTracing {
  private static tracer = trace.getTracer('unit-talk-business', '1.0.0');

  /** Start a span for prop processing pipeline */
  static startPropProcessingSpan(
    operation: string,
    propId?: string,
    metadata?: Record<string, any>
  ): Span {
    const span = this.tracer.startSpan(`prop.${operation}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'unit-talk.operation.type': 'prop_processing',
        'unit-talk.prop.id': propId || 'unknown',
        'unit-talk.operation.name': operation,
        ...metadata,
      },
    });
    return span;
  }

  /** Start a span for agent operations */
  static startAgentSpan(
    agentName: string,
    operation: string,
    metadata?: Record<string, any>
  ): Span {
    const span = this.tracer.startSpan(`agent.${agentName}.${operation}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'unit-talk.agent.name': agentName,
        'unit-talk.agent.operation': operation,
        'unit-talk.operation.type': 'agent_activity',
        ...metadata,
      },
    });
    return span;
  }

  /** Start a span for Temporal workflow operations */
  static startTemporalSpan(
    workflowType: string,
    operation: string,
    workflowId?: string,
    runId?: string
  ): Span {
    const span = this.tracer.startSpan(`temporal.${workflowType}.${operation}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'unit-talk.temporal.workflow_type': workflowType,
        'unit-talk.temporal.workflow_id': workflowId || 'unknown',
        'unit-talk.temporal.run_id': runId || 'unknown',
        'unit-talk.temporal.operation': operation,
        'unit-talk.operation.type': 'temporal_workflow',
      },
    });
    return span;
  }

  /** Add business context to current span */
  static addBusinessContext(
    span: Span,
    context: {
      userId?: string;
      sport?: string;
      league?: string;
      market?: string;
      pickId?: string;
      tier?: string;
    }
  ): void {
    const attributes: Record<string, string> = {};
    if (context.userId) attributes['unit-talk.user.id'] = context.userId;
    if (context.sport) attributes['unit-talk.sports.sport'] = context.sport;
    if (context.league) attributes['unit-talk.sports.league'] = context.league;
    if (context.market) attributes['unit-talk.sports.market'] = context.market;
    if (context.pickId) attributes['unit-talk.pick.id'] = context.pickId;
    if (context.tier) attributes['unit-talk.pick.tier'] = context.tier;

    span.setAttributes(attributes);
  }

  /** Record an error on current span */
  static recordError(span: Span, error: Error, context?: Record<string, any>): void {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });

    if (context) {
      span.setAttributes({
        'unit-talk.error.context': JSON.stringify(context),
      });
    }
  }

  /** Record success metrics on span */
  static recordSuccess(
    span: Span,
    metrics?: {
      duration?: number;
      itemsProcessed?: number;
      score?: number;
    }
  ): void {
    span.setStatus({ code: SpanStatusCode.OK });
    if (metrics) {
      const attributes: Record<string, number> = {};
      if (metrics.duration) attributes['unit-talk.metrics.duration_ms'] = metrics.duration;
      if (metrics.itemsProcessed)
        attributes['unit-talk.metrics.items_processed'] = metrics.itemsProcessed;
      if (metrics.score) attributes['unit-talk.metrics.score'] = metrics.score;
      span.setAttributes(attributes);
    }
  }
}

/** Express middleware to add trace context to requests */
export function traceMiddleware(serviceName: string) {
  return (req: any, res: any, next: any) => {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes({
        'unit-talk.service': serviceName,
        'unit-talk.request.id': req.headers['x-request-id'] || '',
        'unit-talk.user.id': req.user?.id || 'anonymous',
      });
      const traceId = span.spanContext().traceId;
      res.setHeader('X-Trace-ID', traceId);
      req.traceId = traceId;
    }
    next();
  };
}

/** Get current trace ID for correlation */
export function getCurrentTraceId(): string | undefined {
  return trace.getActiveSpan()?.spanContext().traceId;
}

/** Get current span context for propagation */
export function getCurrentSpanContext() {
  return trace.getActiveSpan()?.spanContext();
}

/** Propagate trace context across async boundaries */
export function withTraceContext<T>(fn: () => Promise<T>): Promise<T> {
  return context.with(context.active(), fn);
}

export interface CanaryConfig {
  name: string;
  interval: number;
  timeout: number;
  enabled: boolean;
}

export class SyntheticCanary {
  private config: CanaryConfig;
  private intervalHandle?: ReturnType<typeof setInterval>;

  constructor(config: CanaryConfig) {
    this.config = config;
  }

  /** Start synthetic canary monitoring */
  start(): void {
    if (!this.config.enabled) return;
    this.intervalHandle = setInterval(() => this.runCanary(), this.config.interval * 60 * 1000);
    console.log(`🐦 Started synthetic canary: ${this.config.name}`);
  }

  /** Stop synthetic canary */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      console.log(`🐦 Stopped synthetic canary: ${this.config.name}`);
    }
  }

  /** Execute canary test */
  private async runCanary(): Promise<void> {
    const startTime = Date.now();
    const span = UnitTalkTracing.startPropProcessingSpan('canary_test', 'synthetic', {
      'unit-talk.canary.name': this.config.name,
      'unit-talk.canary.type': 'synthetic_golden_prop',
    });

    try {
      await this.executeGoldenPropFlow();
      UnitTalkTracing.recordSuccess(span, { duration: Date.now() - startTime });
      await this.recordCanaryResult(true);
    } catch (error) {
      UnitTalkTracing.recordError(span, error as Error, { canary_name: this.config.name });
      await this.recordCanaryResult(false);
      console.error(`🚨 Canary failed: ${this.config.name}`, error);
    } finally {
      span.end();
    }
  }

  /** Execute the golden prop workflow (placeholder) */
  private async executeGoldenPropFlow(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /** Record canary result as metric */
  private async recordCanaryResult(success: boolean): Promise<void> {
    console.log(`🐦 Canary ${this.config.name}: ${success ? 'PASS' : 'FAIL'}`);
  }
}

export { UnitTalkTelemetry, trace, context, propagation };
export type { TelemetryConfig };

// SPRINT-ARCHITECTURE-HARDENING-002A: Lazy telemetry - env access at runtime
let _defaultTelemetry: UnitTalkTelemetry | null = null;
export function getDefaultTelemetry(): UnitTalkTelemetry {
  if (!_defaultTelemetry) {
    _defaultTelemetry = new UnitTalkTelemetry({
      serviceName: process.env.SERVICE_NAME || 'unit-talk-unknown',
      serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    });
  }
  return _defaultTelemetry;
}
// Backward compat - lazy proxy
export const telemetry = new Proxy({} as UnitTalkTelemetry, {
  get(_, p) {
    const t = getDefaultTelemetry();
    const v = t[p as keyof UnitTalkTelemetry];
    return typeof v === 'function' ? v.bind(t) : v;
  },
});
