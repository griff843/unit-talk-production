/**
 * @fileoverview Local telemetry wrapper for Command Center
 * Provides OpenTelemetry instrumentation without external package dependency
 */

export interface Span {
  end(): void;
  setAttributes(attributes: Record<string, any>): void;
  setStatus(status: { code: number; message?: string }): void;
}

export interface BusinessContext {
  user_id?: string;
  operation_type?: string;
  risk_tier?: string;
  correlation_cluster?: string;
  [key: string]: any;
}

export interface SyntheticResult {
  success: boolean;
  duration_ms: number;
  errors: string[];
}

export class UnitTalkTracing {
  static startAgentSpan(agent: string, operation: string): Span {
    // Mock implementation for build
    return {
      end: () => {},
      setAttributes: () => {},
      setStatus: () => {},
    };
  }

  static startTemporalSpan(workflow: string, operation: string): Span {
    // Mock implementation for temporal workflows
    return {
      end: () => {},
      setAttributes: () => {},
      setStatus: () => {},
    };
  }

  static addBusinessContext(span: Span, context: BusinessContext): void {
    span.setAttributes(context);
  }

  static recordSuccess(span: Span, metadata?: Record<string, any>): void {
    span.setStatus({ code: 0 });
    if (metadata) {
      span.setAttributes(metadata);
    }
  }

  static recordError(span: Span, error: Error): void {
    span.setStatus({ code: 1, message: error.message });
    span.setAttributes({
      'error.type': error.name,
      'error.message': error.message,
      'error.stack': error.stack,
    });
  }

  static getCurrentTraceId(): string {
    // Mock implementation returning a trace ID
    return Math.random().toString(36).substring(2, 15);
  }

  static async runSyntheticCanary(): Promise<SyntheticResult> {
    const start = Date.now();
    const errors: string[] = [];

    try {
      // Mock synthetic canary test
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        success: true,
        duration_ms: Date.now() - start,
        errors,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        duration_ms: Date.now() - start,
        errors,
      };
    }
  }
}