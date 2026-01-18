/**
 * Logger module for Unit Talk API
 *
 * Provides a pino-compatible logger interface for consistent logging across the API.
 * Uses pino when available, with console fallback for environments without pino.
 *
 * Note: This is a local module to avoid tsconfig rootDir issues with shared imports.
 */

import pino from 'pino';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVEL = (process.env.LOG_LEVEL ?? 'info') as LogLevel;
const NODE_ENV = process.env.NODE_ENV ?? 'development';

/**
 * Create a pino logger with sensible defaults
 */
function createLogger(name: string) {
  const baseOptions: pino.LoggerOptions = {
    name,
    level: LOG_LEVEL,
  };

  try {
    // Development: Use pretty-printed logs if available
    if (NODE_ENV !== 'production') {
      try {
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
      } catch {
        // pino-pretty not available, use sync destination
        return pino(baseOptions, pino.destination({ sync: true }));
      }
    }

    // Production: Simple JSON to stdout
    return pino(baseOptions);
  } catch {
    // Final fallback: sync destination
    return pino(baseOptions, pino.destination({ sync: true }));
  }
}

/**
 * Root logger for platform-wide logging
 * This is the primary export used throughout the API
 */
export const rootLogger = createLogger('unit-talk-api');

/**
 * Create a child logger with additional context
 */
export function createChildLogger(name: string, context: Record<string, unknown> = {}) {
  return rootLogger.child({ module: name, ...context });
}

/**
 * Legacy interface for backwards compatibility
 */
export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export const logger: Logger = {
  info: (message: string, ...args: unknown[]) => rootLogger.info({ args }, message),
  warn: (message: string, ...args: unknown[]) => rootLogger.warn({ args }, message),
  error: (message: string, ...args: unknown[]) => rootLogger.error({ args }, message),
  debug: (message: string, ...args: unknown[]) => rootLogger.debug({ args }, message),
};

export default logger;
