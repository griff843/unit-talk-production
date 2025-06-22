import pino from 'pino';
import { LogLevel } from './types';

// Configure log levels and their numeric values
const LOG_LEVELS = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
} as const;

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

  debug(message: string, ...args: unknown[]): void {
    this.logger.debug({ args }, message);
  }

  info(message: string, ...args: unknown[]): void {
    this.logger.info({ args }, message);
  }

  warn(message: string, ...args: unknown[]): void {
    this.logger.warn({ args }, message);
  }

  error(message: string, error?: Error, ...args: unknown[]): void {
    this.logger.error(
      {
        error: error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : undefined,
        args,
      },
      message
    );
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
  child(bindings: Record<string, any>): Logger {
    const childLogger = new Logger(this.context);
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }

  // Set log level
  setLevel(level: LogLevel): void {
    this.logger = this.logger.child({ level });
  }
}

// Create singleton instance
export const logger = new Logger('app');

// Export types
export * from './types'; 