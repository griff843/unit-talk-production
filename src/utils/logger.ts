// /utils/logger.ts

import pino from 'pino';
import { env } from '../config/env';
import { Logger as LoggerInterface, LogLevel, LogMethod } from '../shared/logger/types';

export interface LoggerConfig {
  level?: string;
  name?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
}

export class Logger implements LoggerInterface {
  private static instance: Logger;
  private readonly logger: pino.Logger;

  constructor(
    name: string = 'UnitTalk',
    config: LoggerConfig = {}
  ) {
    const loggerConfig: pino.LoggerOptions = {
      name,
      level: config.level || env.LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
      base: {
        env: env.NODE_ENV,
        name,
      }
    };

    // Configure transport based on config
    const transport = pino.transport({
      targets: [
        // Console logging
        ...(config.enableConsole !== false ? [{
          target: 'pino/file',
          options: { destination: 1 } // stdout
        }] : []),
        // File logging if enabled
        ...(config.enableFile ? [{
          target: 'pino/file',
          options: {
            destination: config.filePath || `logs/${name}.log`,
            mkdir: true
          }
        }] : [])
      ]
    });

    this.logger = pino(loggerConfig, transport);
  }

  public static getInstance(name?: string, config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(name, config);
    }
    return Logger.instance;
  }

  // Implement LogMethod interface for each log level
  public debug: LogMethod = (msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void => {
    if (typeof msgOrObj === 'string') {
      // First overload: (msg: string, ...args: unknown[]): void
      this.logger.debug(msgOrArgs ? { args: [msgOrArgs, ...args] } : {}, msgOrObj);
    } else {
      // Second overload: (obj: object, msg?: string, ...args: unknown[]): void
      this.logger.debug(msgOrObj, msgOrArgs as string || '', ...(args || []));
    }
  };

  public info: LogMethod = (msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void => {
    if (typeof msgOrObj === 'string') {
      // First overload: (msg: string, ...args: unknown[]): void
      this.logger.info(msgOrArgs ? { args: [msgOrArgs, ...args] } : {}, msgOrObj);
    } else {
      // Second overload: (obj: object, msg?: string, ...args: unknown[]): void
      this.logger.info(msgOrObj, msgOrArgs as string || '', ...(args || []));
    }
  };

  public warn: LogMethod = (msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void => {
    if (typeof msgOrObj === 'string') {
      // First overload: (msg: string, ...args: unknown[]): void
      this.logger.warn(msgOrArgs ? { args: [msgOrArgs, ...args] } : {}, msgOrObj);
    } else {
      // Second overload: (obj: object, msg?: string, ...args: unknown[]): void
      this.logger.warn(msgOrObj, msgOrArgs as string || '', ...(args || []));
    }
  };

  public error: LogMethod = (msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void => {
    if (typeof msgOrObj === 'string') {
      // First overload: (msg: string, ...args: unknown[]): void
      this.logger.error(msgOrArgs ? { args: [msgOrArgs, ...args] } : {}, msgOrObj);
    } else {
      // Second overload: (obj: object, msg?: string, ...args: unknown[]): void
      this.logger.error(msgOrObj, msgOrArgs as string || '', ...(args || []));
    }
  };

  // Add setLevel method to match interface
  public setLevel(level: LogLevel): void {
    this.logger.level = level;
  }

  // Utility methods
  public child(bindings: Record<string, unknown>): LoggerInterface {
    const childLogger = this.logger.child(bindings);
    // Create a new Logger instance that wraps the child logger
    const childInstance = new Logger();
    // Use Object.defineProperty to avoid type conflicts
    Object.defineProperty(childInstance, 'logger', {
      value: childLogger,
      writable: false,
      enumerable: false,
      configurable: false
    });
    return childInstance;
  }

  // Legacy methods for backward compatibility
  public logInfo(message: string, context: Record<string, unknown> = {}): void {
    this.info(context, message);
  }

  public logError(message: string, context: Record<string, unknown> = {}): void {
    this.error(context, message);
  }

  public logWarn(message: string, context: Record<string, unknown> = {}): void {
    this.warn(context, message);
  }

  public logDebug(message: string, context: Record<string, unknown> = {}): void {
    this.debug(context, message);
  }

  // Specialized logging methods for agents
  public logAgentActivity(
    agent: string,
    activity: string,
    details: Record<string, unknown> = {}
  ): void {
    this.info({
      agent,
      activity,
      ...details,
      timestamp: new Date().toISOString()
    }, `Agent Activity: ${activity}`);
  }

  public logAgentError(
    agent: string,
    error: Error,
    context: Record<string, unknown> = {}
  ): void {
    this.error({
      agent,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...context,
      timestamp: new Date().toISOString()
    }, `Agent Error: ${error.message}`);
  }

  public logMetric(
    metric: string,
    value: number,
    tags: Record<string, unknown> = {}
  ): void {
    this.info({
      metric,
      value,
      tags,
      type: 'metric',
      timestamp: new Date().toISOString()
    }, `Metric: ${metric}`);
  }

  public logHealth(
    component: string,
    status: 'healthy' | 'unhealthy',
    details: Record<string, unknown> = {}
  ): void {
    this.info({
      component,
      status,
      ...details,
      type: 'health',
      timestamp: new Date().toISOString()
    }, `Health Check: ${component}`);
  }

  public getLogger(): pino.Logger {
    return this.logger;
  }
}

// Export default logger instance for easy importing
export const logger = Logger.getInstance('UnitTalk');

// Export createLogger function for BaseAgent compatibility
export const createLogger = (name: string, config?: LoggerConfig): Logger => {
  return new Logger(name, config);
};