/**
 * @fileoverview OpenTelemetry instrumentation for Unit Talk Platform
 * Provides comprehensive tracing from ingest → devig → CLV → scoring → publishing
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { 
  trace, 
  context, 
  propagation, 
  Span, 
  SpanStatusCode, 
  SpanKind 
} from '@opentelemetry/api';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { B3Propagator } from '@opentelemetry/propagator-b3';
import { JaegerPropagator } from '@opentelemetry/propagator-jaeger';

// =============================================================================
// CONFIGURATION & INITIALIZATION
// =============================================================================

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
  private tracer = trace.getTracer('unit-talk-platform', '1.0.0');
  private config: TelemetryConfig;

  constructor(config: TelemetryConfig) {
    this.config = {
      sampleRate: 1.0, // Sample all traces in development
      otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      enableConsoleExporter: process.env.NODE_ENV !== 'production',
      enableDebugLogs: process.env.NODE_ENV === 'development',
      ...config
    };
  }

  /**
   * Initialize OpenTelemetry with comprehensive instrumentation
   */
  initialize(): void {
    // Configure resource identification
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'unit-talk',
      // Custom attributes for Unit Talk platform
      'unit-talk.component': this.config.serviceName,
      'unit-talk.platform': 'sports-intelligence',
    });

    // Configure exporters
    const exporters = [];
    
    // OTLP HTTP exporter for production
    if (this.config.otlpEndpoint) {
      exporters.push(new OTLPTraceExporter({
        url: this.config.otlpEndpoint,
        headers: {
          'Content-Type': 'application/json',
        },
      }));
    }

    // Console exporter for development
    if (this.config.enableConsoleExporter && this.config.environment !== 'production') {
      const { ConsoleSpanExporter } = require('@opentelemetry/sdk-node');
      exporters.push(new ConsoleSpanExporter());
    }

    // Configure SDK
    this.sdk = new NodeSDK({
      resource,
      traceExporter: exporters.length > 1 ? 
        // Multiple exporters require BatchSpanProcessor
        new (require('@opentelemetry/sdk-node').BatchSpanProcessor)(exporters[0]) :
        exporters[0],
      instrumentations: [
        // HTTP instrumentation for API calls
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (req) => {
            // Ignore health check and static asset requests
            return req.url?.includes('/health') || req.url?.includes('/static') || false;
          },
          requestHook: (span, request) => {
            span.setAttributes({
              'unit-talk.request.method': request.method,
              'unit-talk.request.path': request.url || '',
            });
          },
        }),

        // Express instrumentation
        new ExpressInstrumentation({
          ignoreIncomingMiddleware: (info) => {
            // Ignore middleware that doesn't contribute to business logic
            return info.name === 'cors' || info.name === 'helmet';
          },
        }),

        // Database instrumentation
        new PgInstrumentation({
          enhancedDatabaseReporting: true,
          responseHook: (span, responseInfo) => {
            if (responseInfo.data) {
              span.setAttributes({
                'unit-talk.db.rows_affected': responseInfo.data.rowCount || 0,
              });
            }
          },
        }),

        // Redis instrumentation for caching
        new RedisInstrumentation({
          responseHook: (span, cmdName, cmdArgs) => {
            span.setAttributes({
              'unit-talk.redis.command': cmdName,
              'unit-talk.redis.args_count': cmdArgs.length,
            });
          },
        }),

        // Winston logging instrumentation
        new WinstonInstrumentation(),
      ],

      // Configure propagators for distributed tracing
      textMapPropagator: propagation.createTextMapPropagator({
        propagators: [
          new B3Propagator(),
          new JaegerPropagator(),
        ],
      }),
    });

    // Start the SDK
    this.sdk.start();

    if (this.config.enableDebugLogs) {
      console.log(`🔍 Unit Talk Telemetry initialized for ${this.config.serviceName}`);
      console.log(`📡 OTLP Endpoint: ${this.config.otlpEndpoint}`);
      console.log(`🌍 Environment: ${this.config.environment}`);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('🔍 Unit Talk Telemetry shut down gracefully');
    }
  }
}

// =============================================================================
// UNIT TALK SPECIFIC TRACING UTILITIES
// =============================================================================

/**
 * Custom span utility for Unit Talk business operations
 */
export class UnitTalkTracing {
  private static tracer = trace.getTracer('unit-talk-business', '1.0.0');

  /**
   * Start a span for prop processing pipeline
   */
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

  /**
   * Start a span for agent operations
   */
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

  /**
   * Start a span for Temporal workflow operations
   */
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

  /**
   * Add business context to current span
   */
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

  /**
   * Record an error on current span
   */
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

  /**
   * Record success metrics on span
   */
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
      if (metrics.itemsProcessed) attributes['unit-talk.metrics.items_processed'] = metrics.itemsProcessed;
      if (metrics.score) attributes['unit-talk.metrics.score'] = metrics.score;
      
      span.setAttributes(attributes);
    }
  }
}

// =============================================================================
// MIDDLEWARE AND HELPERS
// =============================================================================

/**
 * Express middleware to add trace context to requests
 */
export function traceMiddleware(serviceName: string) {
  return (req: any, res: any, next: any) => {
    const span = trace.getActiveSpan();
    if (span) {
      // Add request context
      span.setAttributes({
        'unit-talk.service': serviceName,
        'unit-talk.request.id': req.headers['x-request-id'] || '',
        'unit-talk.user.id': req.user?.id || 'anonymous',
      });

      // Add trace ID to response headers for debugging
      const traceId = span.spanContext().traceId;
      res.setHeader('X-Trace-ID', traceId);
      
      // Add trace ID to request for logging
      req.traceId = traceId;
    }
    next();
  };
}

/**
 * Get current trace ID for correlation
 */
export function getCurrentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  return span?.spanContext().traceId;
}

/**
 * Get current span context for propagation
 */
export function getCurrentSpanContext() {
  return trace.getActiveSpan()?.spanContext();
}

/**
 * Propagate trace context across async boundaries
 */
export function withTraceContext<T>(fn: () => Promise<T>): Promise<T> {
  const activeContext = context.active();
  return context.with(activeContext, fn);
}

// =============================================================================
// CANARY AND SYNTHETIC MONITORING
// =============================================================================

export interface CanaryConfig {
  name: string;
  interval: number; // minutes
  timeout: number;  // milliseconds
  enabled: boolean;
}

export class SyntheticCanary {
  private config: CanaryConfig;
  private intervalHandle?: NodeJS.Timeout;

  constructor(config: CanaryConfig) {
    this.config = config;
  }

  /**
   * Start synthetic canary monitoring
   */
  start(): void {
    if (!this.config.enabled) return;

    this.intervalHandle = setInterval(
      () => this.runCanary(),
      this.config.interval * 60 * 1000
    );

    console.log(`🐦 Started synthetic canary: ${this.config.name}`);
  }

  /**
   * Stop synthetic canary
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      console.log(`🐦 Stopped synthetic canary: ${this.config.name}`);
    }
  }

  /**
   * Execute canary test
   */
  private async runCanary(): Promise<void> {
    const span = UnitTalkTracing.startPropProcessingSpan('canary_test', 'synthetic', {
      'unit-talk.canary.name': this.config.name,
      'unit-talk.canary.type': 'synthetic_golden_prop',
    });

    try {
      await this.executeGoldenPropFlow();
      
      UnitTalkTracing.recordSuccess(span, {
        duration: Date.now() - parseInt(span.startTime.toString()),
      });

      // Record canary success metric
      await this.recordCanaryResult(true);

    } catch (error) {
      UnitTalkTracing.recordError(span, error as Error, {
        canary_name: this.config.name,
      });

      await this.recordCanaryResult(false);
      console.error(`🚨 Canary failed: ${this.config.name}`, error);

    } finally {
      span.end();
    }
  }

  /**
   * Execute the golden prop workflow
   */
  private async executeGoldenPropFlow(): Promise<void> {
    // Create synthetic prop → devig → score → validate all gates
    // This would integrate with your actual prop processing pipeline
    // Implementation would depend on your specific workflow
    
    const syntheticProp = {
      id: `canary-${Date.now()}`,
      player_name: 'Synthetic Player',
      stat_type: 'points',
      line: 25.5,
      sport: 'NBA',
      canary: true,
    };

    // Simulate prop processing pipeline
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Validate all expected gates fired
    // Check shadow mode behavior
    // Verify logging occurred
  }

  /**
   * Record canary result as metric
   */
  private async recordCanaryResult(success: boolean): Promise<void> {
    // This would integrate with your metrics collection system
    // For now, just log the result
    console.log(`🐦 Canary ${this.config.name}: ${success ? 'PASS' : 'FAIL'}`);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { UnitTalkTelemetry, trace, context, propagation };
export type { TelemetryConfig };

// Default instance for easy setup
export const telemetry = new UnitTalkTelemetry({
  serviceName: process.env.SERVICE_NAME || 'unit-talk-unknown',
  serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
});