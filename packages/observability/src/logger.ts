/**
 * Structured Logger Factory
 * SPRINT-REPO-TRUTH-LOCK-002
 *
 * Provides a lightweight createLogger(name) factory for structured logging.
 * This is the canonical shared logger — services can use it directly or
 * wrap it with service-specific context.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Create a structured logger with a component name prefix.
 *
 * Usage:
 * ```typescript
 * import { createLogger } from '@unit-talk/observability';
 * const logger = createLogger('GradingAgent');
 * logger.info('Processing pick', { pickId: '123' });
 * ```
 */
export function createLogger(name: string): Logger {
  const format = (level: LogLevel, message: string, meta?: Record<string, unknown>): string => {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level.toUpperCase()}] [${name}] ${message}`;
    if (meta && Object.keys(meta).length > 0) {
      return `${base} ${JSON.stringify(meta)}`;
    }
    return base;
  };

  return {
    debug(message: string, meta?: Record<string, unknown>) {
      if (process.env['NODE_ENV'] === 'development' || process.env['LOG_LEVEL'] === 'debug') {
        console.debug(format('debug', message, meta));
      }
    },
    info(message: string, meta?: Record<string, unknown>) {
      console.log(format('info', message, meta));
    },
    warn(message: string, meta?: Record<string, unknown>) {
      console.warn(format('warn', message, meta));
    },
    error(message: string, meta?: Record<string, unknown>) {
      console.error(format('error', message, meta));
    },
  };
}
