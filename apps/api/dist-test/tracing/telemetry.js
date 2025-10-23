"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeTelemetry = initializeTelemetry;
exports.shutdownTelemetry = shutdownTelemetry;
exports.createCustomSpan = createCustomSpan;
exports.traceAsync = traceAsync;
// Temporarily comment out OpenTelemetry imports until packages are installed
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// import { Resource } from '@opentelemetry/resources';
// import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
// import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
// import { ConsoleSpanExporter } from '@opentelemetry/sdk-tracing-node';
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('Telemetry');
/**
 * Initialize OpenTelemetry SDK with comprehensive instrumentation
 * Provides distributed tracing across the entire Unit Talk platform
 */
function initializeTelemetry() {
    try {
        // Only initialize if tracing is enabled
        if (process.env.TRACING_ENABLED !== 'true') {
            logger.info('OpenTelemetry tracing disabled - set TRACING_ENABLED=true to enable');
            return null;
        }
        logger.info('OpenTelemetry tracing is disabled in this build - missing dependencies');
        logger.info('To enable tracing, install required OpenTelemetry packages');
        return null;
        // TODO: Re-enable once OpenTelemetry packages are installed
        /*
        const serviceName = 'unit-talk-api';
        const serviceVersion = process.env.npm_package_version || '1.0.0';
        const environment = process.env.NODE_ENV || 'development';
    
        logger.info('Initializing OpenTelemetry', {
          serviceName,
          serviceVersion,
          environment
        });
    
        // Configure resource attributes
        const resource = Resource.default().merge(
          new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
            [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
            [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
            [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'unit-talk-platform',
          })
        );
    
        // Configure exporters
        const exporters = [];
    
        // Console exporter for development
        if (environment === 'development' || process.env.TRACING_CONSOLE === 'true') {
          exporters.push(new ConsoleSpanExporter());
          logger.info('Added console span exporter for development');
        }
    
        // Jaeger exporter for production tracing
        if (process.env.JAEGER_ENDPOINT) {
          const jaegerExporter = new JaegerExporter({
            endpoint: process.env.JAEGER_ENDPOINT,
            tags: [
              { key: 'service.version', value: serviceVersion },
              { key: 'deployment.environment', value: environment },
            ],
          });
          exporters.push(jaegerExporter);
          logger.info('Added Jaeger exporter', { endpoint: process.env.JAEGER_ENDPOINT });
        }
    
        // Initialize SDK with comprehensive auto-instrumentation
        const sdk = new NodeSDK({
          resource,
          instrumentations: [
            getNodeAutoInstrumentations({
              // Enable all instrumentations
              '@opentelemetry/instrumentation-http': {
                enabled: true,
                requestHook: (span, request) => {
                  span.setAttributes({
                    'http.request.correlation_id': request.headers['x-correlation-id'] || 'none',
                    'http.request.user_agent': request.headers['user-agent'] || 'none',
                    'http.request.content_type': request.headers['content-type'] || 'none',
                  });
                },
              },
              '@opentelemetry/instrumentation-express': {
                enabled: true,
                requestHook: (span, info) => {
                  span.setAttributes({
                    'express.route': info.route || 'unknown',
                    'express.method': info.request.method,
                  });
                },
              },
              '@opentelemetry/instrumentation-redis': {
                enabled: true,
                requestHook: (span, request) => {
                  span.setAttributes({
                    'redis.operation': request.command,
                    'redis.database_index': request.args?.[0] || 0,
                  });
                },
              },
              '@opentelemetry/instrumentation-pg': {
                enabled: true,
                requestHook: (span, request) => {
                  span.setAttributes({
                    'db.operation': request.text ? 'query' : 'prepared',
                    'db.statement.type': extractStatementType(request.text || ''),
                  });
                },
              },
              // Disable file system instrumentation to reduce noise
              '@opentelemetry/instrumentation-fs': { enabled: false },
            }),
          ],
          traceExporter: exporters.length > 0 ? exporters[0] : undefined,
        });
    
        // Initialize the SDK
        sdk.start();
    
        logger.info('OpenTelemetry initialized successfully', {
          instrumentations: 'auto',
          exporters: exporters.length,
          resource: serviceName
        });
    
        return sdk;
        */
    }
    catch (error) {
        logger.error('Failed to initialize OpenTelemetry', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        return null;
    }
}
/**
 * Graceful shutdown of telemetry
 */
async function shutdownTelemetry(sdk) {
    if (!sdk) {
        return;
    }
    try {
        logger.info('Shutting down OpenTelemetry...');
        await sdk.shutdown();
        logger.info('OpenTelemetry shutdown completed');
    }
    catch (error) {
        logger.error('Error during OpenTelemetry shutdown', {
            error: error instanceof Error ? error.message : String(error)
        });
    }
}
/**
 * Extract SQL statement type for better observability
 */
function extractStatementType(statement) {
    const normalizedStatement = statement.trim().toLowerCase();
    if (normalizedStatement.startsWith('select'))
        return 'SELECT';
    if (normalizedStatement.startsWith('insert'))
        return 'INSERT';
    if (normalizedStatement.startsWith('update'))
        return 'UPDATE';
    if (normalizedStatement.startsWith('delete'))
        return 'DELETE';
    if (normalizedStatement.startsWith('create'))
        return 'CREATE';
    if (normalizedStatement.startsWith('alter'))
        return 'ALTER';
    if (normalizedStatement.startsWith('drop'))
        return 'DROP';
    return 'OTHER';
}
/**
 * Custom span creation utility for business logic tracing
 */
function createCustomSpan(name, attributes = {}) {
    try {
        // Return a no-op span when OpenTelemetry is not available
        return {
            setAttributes: () => { },
            setStatus: () => { },
            recordException: () => { },
            end: () => { }
        };
        // TODO: Re-enable once OpenTelemetry API is available
        // const { trace } = require('@opentelemetry/api');
        // const tracer = trace.getTracer('unit-talk-custom');
        // 
        // return tracer.startSpan(name, {
        //   attributes: {
        //     'service.name': 'unit-talk-api',
        //     'service.component': 'business-logic',
        //     ...attributes
        //   }
        // });
    }
    catch (error) {
        // Return no-op span on error
        return {
            setAttributes: () => { },
            setStatus: () => { },
            recordException: () => { },
            end: () => { }
        };
    }
}
/**
 * Trace decorator for async functions
 */
function traceAsync(operationName, attributes = {}) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const span = createCustomSpan(operationName, {
                'function.name': propertyKey,
                'function.class': target.constructor.name,
                ...attributes
            });
            try {
                const result = await originalMethod.apply(this, args);
                span.setStatus(); // No-op for mock span
                return result;
            }
            catch (error) {
                span.setStatus(); // No-op for mock span
                span.recordException(); // No-op for mock span
                throw error;
            }
            finally {
                span.end(); // No-op for mock span
            }
        };
        return descriptor;
    };
}
