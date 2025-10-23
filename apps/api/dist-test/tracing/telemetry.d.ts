import { NodeSDK } from '@opentelemetry/sdk-node';
/**
 * Initialize OpenTelemetry SDK with comprehensive instrumentation
 * Provides distributed tracing across the entire Unit Talk platform
 */
export declare function initializeTelemetry(): NodeSDK | null;
/**
 * Graceful shutdown of telemetry
 */
export declare function shutdownTelemetry(sdk: NodeSDK | null): Promise<void>;
/**
 * Custom span creation utility for business logic tracing
 */
export declare function createCustomSpan(name: string, attributes?: Record<string, string | number | boolean>): {
    setAttributes: () => void;
    setStatus: () => void;
    recordException: () => void;
    end: () => void;
};
/**
 * Trace decorator for async functions
 */
export declare function traceAsync(operationName: string, attributes?: Record<string, any>): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=telemetry.d.ts.map