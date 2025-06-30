import { createLogger, format, transports } from 'winston';
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

// Custom error classes for better error handling
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    requestId?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.requestId = requestId;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, requestId?: string) {
    super(message, 400, 'VALIDATION_ERROR', true, requestId);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', requestId?: string) {
    super(message, 401, 'AUTH_ERROR', true, requestId);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', requestId?: string) {
    super(message, 403, 'AUTHORIZATION_ERROR', true, requestId);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', requestId?: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND', true, requestId);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', requestId?: string) {
    super(message, 429, 'RATE_LIMIT_ERROR', true, requestId);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, requestId?: string) {
    super(`${service} service error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, requestId);
  }
}

// Enhanced logger with structured logging
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.json(),
  format.printf(({ timestamp, level, message, ...meta }) => {
    // Redact sensitive information
    const sanitizedMeta = redactSensitiveData(meta);
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...sanitizedMeta
    });
  })
);

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'unit-talk-bot',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ],
  exceptionHandlers: [
    new transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Redact sensitive information from logs
function redactSensitiveData(obj: any): any {
  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'authorization',
    'cookie', 'session', 'credit_card', 'ssn', 'email'
  ];

  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const redacted = { ...obj };
  
  for (const key in redacted) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  }

  return redacted;
}

// Request ID middleware for tracing
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

// Request logging middleware
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = performance.now();
  const requestId = req.headers['x-request-id'] as string;

  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  res.on('finish', () => {
    const duration = performance.now() - startTime;
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: Math.round(duration),
      contentLength: res.get('content-length')
    });
  });

  next();
}

// Global error handler
export function globalErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string;

  // Log the error
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error('Application error', {
        requestId,
        errorCode: error.errorCode,
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode
      });
    } else {
      logger.warn('Client error', {
        requestId,
        errorCode: error.errorCode,
        message: error.message,
        statusCode: error.statusCode
      });
    }
  } else {
    logger.error('Unexpected error', {
      requestId,
      message: error.message,
      stack: error.stack
    });
  }

  // Send error response
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.errorCode,
        message: error.message,
        timestamp: error.timestamp,
        requestId
      }
    });
  } else {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date(),
        requestId
      }
    });
  }
}

// Circuit breaker implementation
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly monitoringPeriod: number = 120000 // 2 minutes
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new AppError('Circuit breaker is OPEN', 503, 'CIRCUIT_BREAKER_OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker opened', {
        failures: this.failures,
        threshold: this.threshold
      });
    }
  }

  getState(): string {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }
}

// Health check utilities
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  duration: number;
  details?: any;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();

  addCheck(name: string, check: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, check);
  }

  async runChecks(): Promise<{ [key: string]: HealthCheckResult }> {
    const results: { [key: string]: HealthCheckResult } = {};

    for (const [name, check] of this.checks) {
      const startTime = performance.now();
      try {
        results[name] = await check();
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          timestamp: new Date(),
          duration: performance.now() - startTime,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }
    }

    return results;
  }

  async getOverallHealth(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    checks: { [key: string]: HealthCheckResult };
    timestamp: Date;
  }> {
    const checks = await this.runChecks();
    const statuses = Object.values(checks).map(check => check.status);

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date()
    };
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
  }

  getMetrics(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      avg: sum / count,
      min: sorted[0],
      max: sorted[count - 1],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    };
  }

  getAllMetrics(): { [key: string]: any } {
    const result: { [key: string]: any } = {};
    for (const [name] of this.metrics) {
      result[name] = this.getMetrics(name);
    }
    return result;
  }
}

// Async wrapper with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  requestId?: string
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    PerformanceMonitor.getInstance().recordMetric(`${context}.duration`, duration);
    PerformanceMonitor.getInstance().recordMetric(`${context}.success`, 1);
    
    logger.debug(`Operation completed: ${context}`, {
      requestId,
      duration: Math.round(duration)
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    PerformanceMonitor.getInstance().recordMetric(`${context}.duration`, duration);
    PerformanceMonitor.getInstance().recordMetric(`${context}.error`, 1);
    
    logger.error(`Operation failed: ${context}`, {
      requestId,
      duration: Math.round(duration),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    throw error;
  }
}