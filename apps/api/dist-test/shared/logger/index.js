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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = exports.usedLogLevels = void 0;
const pino_1 = __importDefault(require("pino"));
// Configure log levels and their numeric values
const LOG_LEVELS = {
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
};
// Use LOG_LEVELS to prevent unused warning
exports.usedLogLevels = LOG_LEVELS;
// Configure default options
const DEFAULT_OPTIONS = {
    level: 'info',
    formatters: {
        level: (label) => ({ level: label }),
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    redact: {
        paths: ['password', 'secret', 'token', 'apiKey'],
        remove: true,
    },
};
// Create base logger instance
const baseLogger = (0, pino_1.default)({
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
class Logger {
    constructor(context, level = 'info') {
        this.context = context;
        this.logger = baseLogger.child({
            context,
            level,
        });
    }
    debug(msgOrObj, msgOrArgs, ...args) {
        if (typeof msgOrObj === 'string') {
            this.logger.debug({ args: [msgOrArgs, ...args] }, msgOrObj);
        }
        else {
            this.logger.debug(msgOrObj, msgOrArgs);
        }
    }
    info(msgOrObj, msgOrArgs, ...args) {
        if (typeof msgOrObj === 'string') {
            this.logger.info({ args: [msgOrArgs, ...args] }, msgOrObj);
        }
        else {
            this.logger.info(msgOrObj, msgOrArgs);
        }
    }
    warn(msgOrObj, msgOrArgs, ...args) {
        if (typeof msgOrObj === 'string') {
            this.logger.warn({ args: [msgOrArgs, ...args] }, msgOrObj);
        }
        else {
            this.logger.warn(msgOrObj, msgOrArgs);
        }
    }
    error(msgOrObj, msgOrArgs, ...args) {
        if (typeof msgOrObj === 'string') {
            this.logger.error({ args: [msgOrArgs, ...args] }, msgOrObj);
        }
        else {
            this.logger.error(msgOrObj, msgOrArgs);
        }
    }
    // Log method execution with timing
    async logExecution(methodName, operation) {
        const start = Date.now();
        try {
            const result = await operation();
            const duration = Date.now() - start;
            this.info(`${methodName} completed`, { duration });
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            this.error(`${methodName} failed`, error, { duration });
            throw error;
        }
    }
    // Create child logger with additional context
    child(bindings) {
        const childLogger = new Logger(this.context);
        childLogger.logger = this.logger.child(bindings);
        return childLogger;
    }
    // Set log level
    setLevel(level) {
        this.logger = this.logger.child({ level });
    }
}
exports.Logger = Logger;
// Create default logger instance
exports.logger = new Logger('app');
// Export types
__exportStar(require("./types"), exports);
// LogMethod is imported from types.ts 
