import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const disableLogWorkers = process.env.DISABLE_LOG_WORKERS === '1' || isTest;
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Create base logger configuration
// In test mode or when DISABLE_LOG_WORKERS=1, use synchronous logging to avoid worker thread issues
const logger = pino({
  level: logLevel,
  formatters: {
    level: label => ({ level: label.toUpperCase() }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDevelopment &&
    !disableLogWorkers && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'HH:MM:ss',
          singleLine: false,
        },
      },
    }),
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});

// Helper function to create route-specific loggers
export const createRouteLogger = (route: string, method?: string) => {
  return logger.child({
    route,
    ...(method && { method }),
    component: 'smart-form-api',
  });
};

// Helper function to create component-specific loggers
export const createComponentLogger = (component: string) => {
  return logger.child({
    component,
    service: 'smart-form',
  });
};

// Helper function to log API call performance
export const logApiPerformance = (
  log: pino.Logger,
  operation: string,
  startTime: number,
  metadata?: Record<string, any>
) => {
  const duration = Date.now() - startTime;
  log.info(
    {
      operation,
      duration_ms: duration,
      performance: duration < 100 ? 'excellent' : duration < 500 ? 'good' : 'slow',
      ...metadata,
    },
    `${operation} completed in ${duration}ms`
  );
};

// Helper function to log validation errors with context
export const logValidationError = (
  log: pino.Logger,
  errors: any,
  input: any,
  context?: Record<string, any>
) => {
  log.warn(
    {
      validation_errors: errors,
      input_keys: Object.keys(input || {}),
      ...context,
    },
    'Validation failed'
  );
};

// Helper function to log database operations
export const logDatabaseOperation = (
  log: pino.Logger,
  operation: string,
  table: string,
  result: any,
  error?: any
) => {
  if (error) {
    log.error(
      {
        operation,
        table,
        error: error.message,
        error_code: error.code,
      },
      `Database ${operation} failed on ${table}`
    );
  } else {
    log.info(
      {
        operation,
        table,
        affected_rows: Array.isArray(result) ? result.length : result ? 1 : 0,
      },
      `Database ${operation} successful on ${table}`
    );
  }
};

// Helper function to log external API calls
export const logExternalApiCall = (
  log: pino.Logger,
  service: string,
  endpoint: string,
  method: string,
  startTime: number,
  statusCode?: number,
  error?: any
) => {
  const duration = Date.now() - startTime;

  if (error) {
    log.error(
      {
        external_service: service,
        endpoint,
        method,
        duration_ms: duration,
        error: error.message,
      },
      `External API call to ${service} failed`
    );
  } else {
    log.info(
      {
        external_service: service,
        endpoint,
        method,
        duration_ms: duration,
        status_code: statusCode,
        success: (statusCode || 0) >= 200 && (statusCode || 0) < 300,
      },
      `External API call to ${service} completed`
    );
  }
};

// Factory function for creating named loggers
export const createLogger = (name: string) => {
  return logger.child({
    name,
    service: 'smart-form',
  });
};

// Security logging helper - never log sensitive data
export const logSecurityEvent = (
  log: pino.Logger,
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  metadata?: Record<string, any>
) => {
  // Filter out any potentially sensitive data
  const sanitizedMetadata = metadata
    ? Object.fromEntries(
        Object.entries(metadata).filter(
          ([key]) =>
            !['password', 'token', 'key', 'secret', 'auth'].some(sensitive =>
              key.toLowerCase().includes(sensitive)
            )
        )
      )
    : {};

  log.warn(
    {
      security_event: event,
      severity,
      timestamp: new Date().toISOString(),
      ...sanitizedMetadata,
    },
    `Security event: ${event}`
  );
};

export default logger;
