import pino from 'pino';

import { LogLevel, LogMethod } from './types';

// Configure log levels and their numeric values
const LOG_LEVELS = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
} as const;

// Use LOG_LEVELS to prevent unused warning
export const usedLogLevels = LOG_LEVELS;

// Configure default options
const DEFAULT_OPTIONS = {
  level: 'info' as LogLevel,
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  redact: {
    paths: ['password', 'secret', 'token', 'apiKey'],
    remove: true,
  },
};

// Create base logger instance
const baseLogger = pino({
  ...DEFAULT_OPTIONS,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

export class Logger {
  private logger: pino.Logger;

  constructor(
    private readonly context: string,
    level: LogLevel = 'info'
  ) {
    this.logger = baseLogger.child({
      context,
      level,
    });
  }

  debug(msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void {
    if (typeof msgOrObj === 'string') {
      this.logger.debug({ args: [msgOrArgs, ...args] }, msgOrObj);
    } else {
      this.logger.debug(msgOrObj, msgOrArgs as string);
    }
  }

  info(msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void {
    if (typeof msgOrObj === 'string') {
      this.logger.info({ args: [msgOrArgs, ...args] }, msgOrObj);
    } else {
      this.logger.info(msgOrObj, msgOrArgs as string);
    }
  }

  warn(msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void {
    if (typeof msgOrObj === 'string') {
      this.logger.warn({ args: [msgOrArgs, ...args] }, msgOrObj);
    } else {
      this.logger.warn(msgOrObj, msgOrArgs as string);
    }
  }

  error(msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void {
    if (typeof msgOrObj === 'string') {
      this.logger.error({ args: [msgOrArgs, ...args] }, msgOrObj);
    } else {
      this.logger.error(msgOrObj, msgOrArgs as string);
    }
  }

  // Log method execution with timing
  async logExecution<T>(
    methodName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - start;
      this.info(`${methodName} completed`, { duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(
        `${methodName} failed`,
        error as Error,
        { duration }
      );
      throw error;
    }
  }

  // Create child logger with additional context
  child(bindings: Record<string, unknown>): Logger {
    const childLogger = new Logger(this.context);
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }

  // Set log level
  setLevel(level: LogLevel): void {
    this.logger = this.logger.child({ level });
  }
}

// Create default logger instance
export const logger = new Logger('app');

// Export types
export * from './types';

// Export Logger interface for compatibility  
export interface LoggerInterface {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  child(bindings: Record<string, unknown>): LoggerInterface;
  setLevel?(level: LogLevel): void;
}

// LogMethod is imported from types.ts 