// /utils/logger.ts

import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogMethod {
  (msg: string, ...args: unknown[]): void;
  (obj: object, msg?: string, ...args: unknown[]): void;
}

export interface Logger {
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  debug: LogMethod;
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
  setLevel(level: LogLevel): void;
  activity(activityId: string, status: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  filename?: string;
  console?: boolean;
}

function validateLogLevel(level: string | undefined): LogLevel {
  const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
  return validLevels.includes(level as LogLevel) ? (level as LogLevel) : 'info';
}

// Simple console logger implementation compatible with Docker
export class StandardLogger implements Logger {
  private level: LogLevel;
  private filename?: string;
  private consoleEnabled: boolean;
  private logLevels = { error: 0, warn: 1, info: 2, debug: 3 };

  constructor(options: LoggerOptions = {}) {
    this.level = validateLogLevel(options.level);
    this.filename = options.filename;
    this.consoleEnabled = options.console !== false;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] <= this.logLevels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  private writeLog(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, context);

    // Console output
    if (this.consoleEnabled) {
      const consoleMethod = level === 'error' ? console.error : 
                           level === 'warn' ? console.warn :
                           level === 'debug' ? console.debug : console.log;
      consoleMethod(formatted);
    }

    // File output
    if (this.filename) {
      try {
        const logDir = path.dirname(this.filename);
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        fs.appendFileSync(this.filename, formatted + '\n');
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  error: LogMethod = (msg: string | object, ...args: unknown[]): void => {
    if (typeof msg === 'string') {
      this.writeLog('error', msg, args.length > 0 ? { args } : undefined);
    } else {
      this.writeLog('error', args[0] as string || 'Error', msg as Record<string, unknown>);
    }
  }

  warn: LogMethod = (msg: string | object, ...args: unknown[]): void => {
    if (typeof msg === 'string') {
      this.writeLog('warn', msg, args.length > 0 ? { args } : undefined);
    } else {
      this.writeLog('warn', args[0] as string || 'Warning', msg as Record<string, unknown>);
    }
  }

  info: LogMethod = (msg: string | object, ...args: unknown[]): void => {
    if (typeof msg === 'string') {
      this.writeLog('info', msg, args.length > 0 ? { args } : undefined);
    } else {
      this.writeLog('info', args[0] as string || 'Info', msg as Record<string, unknown>);
    }
  }

  debug: LogMethod = (msg: string | object, ...args: unknown[]): void => {
    if (typeof msg === 'string') {
      this.writeLog('debug', msg, args.length > 0 ? { args } : undefined);
    } else {
      this.writeLog('debug', args[0] as string || 'Debug', msg as Record<string, unknown>);
    }
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    this.writeLog(level, message, context);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  activity(activityId: string, status: string, context?: Record<string, unknown>): void {
    this.writeLog('info', `Activity ${activityId} status: ${status}`, context);
  }

  child(_context: Record<string, unknown>): Logger {
    return new StandardLogger({
      level: this.level,
      console: this.consoleEnabled,
      filename: this.filename
    });
  }
}

// Export factory functions only - create instances on demand to avoid Docker issues
export function createStandardLogger(options: LoggerOptions = {}): Logger {
  return new StandardLogger({
    ...options,
    level: validateLogLevel(options.level)
  });
}

export function makeLogger(context?: string): Logger {
  return new StandardLogger({
    level: validateLogLevel(process.env.LOG_LEVEL),
    ...(context && { filename: `${context}.log` })
  });
}

// Export createLogger that accepts string or options for backward compatibility
export function createLogger(context?: string | LoggerOptions): Logger {
  if (typeof context === 'string') {
    return new StandardLogger({
      level: validateLogLevel(process.env.LOG_LEVEL)
    });
  }
  return createStandardLogger(context || {});
}

// Export a default logger instance created on demand
let _defaultLogger: Logger | null = null;
export const logger = {
  get instance(): Logger {
    if (!_defaultLogger) {
      _defaultLogger = new StandardLogger({
        level: validateLogLevel(process.env.LOG_LEVEL)
      });
    }
    return _defaultLogger;
  },
  // Proxy common methods for backward compatibility
  error: (msg: string | object, ...args: unknown[]) => {
    if (typeof msg === 'string') {
      (logger.instance.error as any)(msg, ...args);
    } else {
      (logger.instance.error as any)(msg, ...args);
    }
  },
  warn: (msg: string | object, ...args: unknown[]) => {
    if (typeof msg === 'string') {
      (logger.instance.warn as any)(msg, ...args);
    } else {
      (logger.instance.warn as any)(msg, ...args);
    }
  },
  info: (msg: string | object, ...args: unknown[]) => {
    if (typeof msg === 'string') {
      (logger.instance.info as any)(msg, ...args);
    } else {
      (logger.instance.info as any)(msg, ...args);
    }
  },
  debug: (msg: string | object, ...args: unknown[]) => {
    if (typeof msg === 'string') {
      (logger.instance.debug as any)(msg, ...args);
    } else {
      (logger.instance.debug as any)(msg, ...args);
    }
  },
  log: (level: LogLevel, message: string, context?: Record<string, unknown>) => logger.instance.log(level, message, context),
  child: (context: Record<string, unknown>) => logger.instance.child(context)
};