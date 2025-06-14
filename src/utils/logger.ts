// /utils/logger.ts

import pino from 'pino';

export interface LoggerConfig {
  level?: string;
  name?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
}

export class Logger {
  private static instance: Logger;
  private readonly logger: pino.Logger;

  constructor(
    name: string = 'UnitTalk',
    config: LoggerConfig = {}
  ) {
    const loggerConfig: pino.LoggerOptions = {
      name,
      level: config.level || process.env.LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
      base: {
        env: process.env.NODE_ENV,
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

  // Standard logging methods
  public info(message: string, context: Record<string, any> = {}): void {
    this.logger.info(context, message);
  }

  public error(message: string, context: Record<string, any> = {}): void {
    this.logger.error(context, message);
  }

  public warn(message: string, context: Record<string, any> = {}): void {
    this.logger.warn(context, message);
  }

  public debug(message: string, context: Record<string, any> = {}): void {
    this.logger.debug(context, message);
  }

  // Specialized logging methods for agents
  public logAgentActivity(
    agent: string,
    activity: string,
    details: Record<string, any> = {}
  ): void {
    this.info(`Agent Activity: ${activity}`, {
      agent,
      activity,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  public logAgentError(
    agent: string,
    error: Error,
    context: Record<string, any> = {}
  ): void {
    this.error(`Agent Error: ${error.message}`, {
      agent,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  public logMetric(
    metric: string,
    value: number,
    tags: Record<string, any> = {}
  ): void {
    this.info(`Metric: ${metric}`, {
      metric,
      value,
      tags,
      type: 'metric',
      timestamp: new Date().toISOString()
    });
  }

  public logHealth(
    component: string,
    status: 'healthy' | 'unhealthy',
    details: Record<string, any> = {}
  ): void {
    this.info(`Health Check: ${component}`, {
      component,
      status,
      ...details,
      type: 'health',
      timestamp: new Date().toISOString()
    });
  }

  // Utility methods
  public child(bindings: Record<string, any>): pino.Logger {
    return this.logger.child(bindings);
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