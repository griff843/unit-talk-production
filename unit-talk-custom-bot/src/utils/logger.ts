import * as winston from 'winston';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'grey',
  debug: 'white',
  silly: 'rainbow'
};

winston.addColors(logColors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }

    return logMessage;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  levels: logLevels,
  format: fileFormat,
  defaultMeta: { service: 'unit-talk-bot' },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat
    }),

    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat
    }),

    // Console output
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'
    })
  ],

  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],

  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Simple LogContext type for additional logging context
type LogContext = Record<string, any>;

// Enhanced logging methods with context support
export const logWithContext = {
  error: (message: string, error?: any, context?: LogContext) => {
    logger.error(message, { error: error?.message || error, stack: error?.stack, ...context });
  },

  warn: (message: string, context?: LogContext) => {
    logger.warn(message, context);
  },

  info: (message: string, context?: LogContext) => {
    logger.info(message, context);
  },

  debug: (message: string, context?: LogContext) => {
    logger.debug(message, context);
  },

  // Special method for Discord events
  discordEvent: (event: string, data: any, context?: LogContext) => {
    logger.info(`Discord Event: ${event}`, { event, data, ...context });
  },

  // Special method for command usage
  commandUsage: (command: string, userId: string, guildId: string, success: boolean) => {
    logger.info(`Command Usage: ${command}`, {
      command,
      userId,
      guildId,
      success,
      timestamp: new Date().toISOString()
    });
  },

  // Special method for API calls
  apiCall: (endpoint: string, method: string, statusCode: number, responseTime: number) => {
    logger.info(`API Call: ${method} ${endpoint}`, {
      endpoint,
      method,
      statusCode,
      responseTime,
      timestamp: new Date().toISOString()
    });
  },

  // Special method for database operations
  dbOperation: (operation: string, table: string, success: boolean, duration?: number) => {
    logger.info(`DB Operation: ${operation} on ${table}`, {
      operation,
      table,
      success,
      duration,
      timestamp: new Date().toISOString()
    });
  },

  // Special method for security events
  security: (event: string, userId?: string, details?: any) => {
    logger.warn(`Security Event: ${event}`, {
      event,
      userId,
      details,
      timestamp: new Date().toISOString(),
      severity: 'security'
    });
  }
};

// Utility function to redact sensitive information
export const redactSensitiveInfo = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
  const redacted = { ...obj };

  for (const key in redacted) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveInfo(redacted[key]);
    }
  }

  return redacted;
};

// Create logs directory if it doesn't exist
import * as fs from 'fs';
import * as path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export default logger;