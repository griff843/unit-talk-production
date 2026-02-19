/**
 * Resilient Logger Factory for Unit Talk Platform
 *
 * Eliminates pino worker thread crashes with automatic fallback strategy:
 * - Auto mode: Attempts async transport (pretty in dev, json in prod)
 * - Sync mode: Forces synchronous destination (no worker threads)
 * - Next.js Edge: Auto-detects and uses sync mode (NEXT_RUNTIME)
 *
 * Environment Variables:
 * - LOG_MODE: 'auto' | 'sync' | 'pretty' (default: 'auto')
 * - LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' (default: 'info')
 * - NODE_ENV: 'development' | 'production' | 'test'
 * - NEXT_RUNTIME: Automatically set by Next.js (edge/nodejs)
 */

import pino, { LoggerOptions } from 'pino';

type LogMode = 'auto' | 'sync' | 'pretty';

const LOG_MODE = (process.env.LOG_MODE ?? 'auto') as LogMode;
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const IS_NEXT_RUNTIME = !!process.env.NEXT_RUNTIME;

/**
 * Create a resilient logger instance with automatic fallback
 *
 * @param name - Logger name (typically service/module name)
 * @returns Pino logger instance
 */
export function createLogger(name: string) {
  const baseOptions: LoggerOptions = {
    name,
    level: LOG_LEVEL,
  };

  // Force sync destination (no worker) if LOG_MODE=sync or in Next.js API route
  const forceSync = LOG_MODE === 'sync' || IS_NEXT_RUNTIME;

  if (forceSync) {
    // Synchronous logging - no worker threads, guaranteed reliability
    return pino(
      { ...baseOptions },
      pino.destination({ sync: true })
    );
  }

  try {
    // Development: Use pretty-printed logs with colors
    if (LOG_MODE === 'pretty' || NODE_ENV !== 'production') {
      try {
        // Attempt to use pino-pretty transport
        const transport = pino.transport({
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        });
        return pino(baseOptions, transport);
      } catch (transportError) {
        // pino-pretty not available or worker failed - fall back to sync
        console.warn('[logger] pino-pretty transport failed, using sync fallback');
        return pino(
          { ...baseOptions, msgPrefix: '[sync-fallback] ' },
          pino.destination({ sync: true })
        );
      }
    }

    // Production: Simple JSON to stdout (no worker, no transport)
    return pino(baseOptions);
  } catch (error) {
    // Final safety net: Always fall back to sync destination
    console.error('[logger] Logger creation failed, using emergency sync fallback', error);
    return pino(
      { ...baseOptions, msgPrefix: '[emergency-fallback] ' },
      pino.destination({ sync: true })
    );
  }
}

/**
 * Root logger for platform-wide logging
 */
export const rootLogger = createLogger('unit-talk');

/**
 * Global error handlers to prevent uncaught exceptions
 */
process.on('unhandledRejection', (reason, promise) => {
  rootLogger.error(
    {
      err: reason,
      promise: String(promise),
    },
    'Unhandled promise rejection'
  );
});

process.on('uncaughtException', (error) => {
  rootLogger.fatal(
    {
      err: error,
      stack: error.stack,
    },
    'Uncaught exception - continuing to serve requests'
  );
  // Do NOT exit in production - keep serving requests during validation
  // In a real production deployment, you might want to:
  // 1. Send alert to monitoring system
  // 2. Attempt graceful shutdown if error is critical
  // For now, we log and continue
});

/**
 * Create a child logger with additional context
 *
 * @param name - Child logger name
 * @param context - Additional context to include in all logs
 * @returns Child logger instance
 */
export function createChildLogger(name: string, context: Record<string, any> = {}) {
  return rootLogger.child({ module: name, ...context });
}

/**
 * Factory for creating route-specific loggers
 * Used in Next.js API routes and Express routes
 *
 * @param route - Route path (e.g., 'POST /api/picks/insert')
 * @param method - HTTP method
 * @returns Route logger instance
 */
export function createRouteLogger(route: string, method: string = 'GET') {
  return rootLogger.child({
    route,
    method,
    type: 'http',
  });
}
