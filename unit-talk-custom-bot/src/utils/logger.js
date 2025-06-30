"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactSensitiveInfo = exports.logWithContext = exports.logger = void 0;
const winston = __importStar(require("winston"));
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
const consoleFormat = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.colorize({ all: true }), winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
        logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return logMessage;
}));
// Custom format for file output
const fileFormat = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.json());
// Create the logger
exports.logger = winston.createLogger({
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
// Enhanced logging methods with context support
exports.logWithContext = {
    error: (message, error, context) => {
        exports.logger.error(message, { error: error?.message || error, stack: error?.stack, ...context });
    },
    warn: (message, context) => {
        exports.logger.warn(message, context);
    },
    info: (message, context) => {
        exports.logger.info(message, context);
    },
    debug: (message, context) => {
        exports.logger.debug(message, context);
    },
    // Special method for Discord events
    discordEvent: (event, data, context) => {
        exports.logger.info(`Discord Event: ${event}`, { event, data, ...context });
    },
    // Special method for command usage
    commandUsage: (command, userId, guildId, success) => {
        exports.logger.info(`Command Usage: ${command}`, {
            command,
            userId,
            guildId,
            success,
            timestamp: new Date().toISOString()
        });
    },
    // Special method for API calls
    apiCall: (endpoint, method, statusCode, responseTime) => {
        exports.logger.info(`API Call: ${method} ${endpoint}`, {
            endpoint,
            method,
            statusCode,
            responseTime,
            timestamp: new Date().toISOString()
        });
    },
    // Special method for database operations
    dbOperation: (operation, table, success, duration) => {
        exports.logger.info(`DB Operation: ${operation} on ${table}`, {
            operation,
            table,
            success,
            duration,
            timestamp: new Date().toISOString()
        });
    },
    // Special method for security events
    security: (event, userId, details) => {
        exports.logger.warn(`Security Event: ${event}`, {
            event,
            userId,
            details,
            timestamp: new Date().toISOString(),
            severity: 'security'
        });
    }
};
// Utility function to redact sensitive information
const redactSensitiveInfo = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
    const redacted = { ...obj };
    for (const key in redacted) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            redacted[key] = '[REDACTED]';
        }
        else if (typeof redacted[key] === 'object') {
            redacted[key] = (0, exports.redactSensitiveInfo)(redacted[key]);
        }
    }
    return redacted;
};
exports.redactSensitiveInfo = redactSensitiveInfo;
// Create logs directory if it doesn't exist
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map