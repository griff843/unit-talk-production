"use strict";
// /utils/logger.ts
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
exports.logger = exports.StandardLogger = void 0;
exports.createStandardLogger = createStandardLogger;
exports.makeLogger = makeLogger;
exports.createLogger = createLogger;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function validateLogLevel(level) {
    const validLevels = ['error', 'warn', 'info', 'debug'];
    return validLevels.includes(level) ? level : 'info';
}
// Simple console logger implementation compatible with Docker
class StandardLogger {
    constructor(options = {}) {
        this.logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
        this.error = (msg, ...args) => {
            if (typeof msg === 'string') {
                this.writeLog('error', msg, args.length > 0 ? { args } : undefined);
            }
            else {
                this.writeLog('error', args[0] || 'Error', msg);
            }
        };
        this.warn = (msg, ...args) => {
            if (typeof msg === 'string') {
                this.writeLog('warn', msg, args.length > 0 ? { args } : undefined);
            }
            else {
                this.writeLog('warn', args[0] || 'Warning', msg);
            }
        };
        this.info = (msg, ...args) => {
            if (typeof msg === 'string') {
                this.writeLog('info', msg, args.length > 0 ? { args } : undefined);
            }
            else {
                this.writeLog('info', args[0] || 'Info', msg);
            }
        };
        this.debug = (msg, ...args) => {
            if (typeof msg === 'string') {
                this.writeLog('debug', msg, args.length > 0 ? { args } : undefined);
            }
            else {
                this.writeLog('debug', args[0] || 'Debug', msg);
            }
        };
        this.level = validateLogLevel(options.level);
        this.filename = options.filename;
        this.consoleEnabled = options.console !== false;
    }
    shouldLog(level) {
        return this.logLevels[level] <= this.logLevels[this.level];
    }
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
    }
    writeLog(level, message, context) {
        if (!this.shouldLog(level))
            return;
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
            }
            catch (error) {
                console.error('Failed to write to log file:', error);
            }
        }
    }
    log(level, message, context) {
        this.writeLog(level, message, context);
    }
    setLevel(level) {
        this.level = level;
    }
    activity(activityId, status, context) {
        this.writeLog('info', `Activity ${activityId} status: ${status}`, context);
    }
    child(_context) {
        return new StandardLogger({
            level: this.level,
            console: this.consoleEnabled,
            filename: this.filename
        });
    }
}
exports.StandardLogger = StandardLogger;
// Export factory functions only - create instances on demand to avoid Docker issues
function createStandardLogger(options = {}) {
    return new StandardLogger({
        ...options,
        level: validateLogLevel(options.level)
    });
}
function makeLogger(context) {
    return new StandardLogger({
        level: validateLogLevel(process.env.LOG_LEVEL),
        ...(context && { filename: `${context}.log` })
    });
}
// Export createLogger that accepts string or options for backward compatibility
function createLogger(context) {
    if (typeof context === 'string') {
        return new StandardLogger({
            level: validateLogLevel(process.env.LOG_LEVEL)
        });
    }
    return createStandardLogger(context || {});
}
// Export a default logger instance created on demand
let _defaultLogger = null;
exports.logger = {
    get instance() {
        if (!_defaultLogger) {
            _defaultLogger = new StandardLogger({
                level: validateLogLevel(process.env.LOG_LEVEL)
            });
        }
        return _defaultLogger;
    },
    // Proxy common methods for backward compatibility
    error: (msg, ...args) => {
        if (typeof msg === 'string') {
            exports.logger.instance.error(msg, ...args);
        }
        else {
            exports.logger.instance.error(msg, ...args);
        }
    },
    warn: (msg, ...args) => {
        if (typeof msg === 'string') {
            exports.logger.instance.warn(msg, ...args);
        }
        else {
            exports.logger.instance.warn(msg, ...args);
        }
    },
    info: (msg, ...args) => {
        if (typeof msg === 'string') {
            exports.logger.instance.info(msg, ...args);
        }
        else {
            exports.logger.instance.info(msg, ...args);
        }
    },
    debug: (msg, ...args) => {
        if (typeof msg === 'string') {
            exports.logger.instance.debug(msg, ...args);
        }
        else {
            exports.logger.instance.debug(msg, ...args);
        }
    },
    log: (level, message, context) => exports.logger.instance.log(level, message, context),
    child: (context) => exports.logger.instance.child(context)
};
