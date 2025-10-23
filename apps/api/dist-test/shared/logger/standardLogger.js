"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStandardLogger = void 0;
exports.withLogging = withLogging;
exports.logMethod = logMethod;
const logger_1 = require("../../utils/logger");
Object.defineProperty(exports, "createStandardLogger", { enumerable: true, get: function () { return logger_1.createStandardLogger; } });
// Re-export the decorators
function withLogging(constructor) {
    return class extends constructor {
        constructor(...args) {
            super(...args);
            this.logger = (0, logger_1.createStandardLogger)({
                level: process.env.LOG_LEVEL || 'info'
            });
        }
    };
}
// Decorator for logging method execution
function logMethod(operationName) {
    return function (_target, _propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const logger = this.logger || (0, logger_1.createStandardLogger)();
            try {
                logger.info(`Starting ${operationName}`, { args });
                const result = await originalMethod.apply(this, args);
                logger.info(`Completed ${operationName}`, { result });
                return result;
            }
            catch (error) {
                logger.error(`Error in ${operationName}`, {
                    error: error instanceof Error ? error.message : String(error),
                    args
                });
                throw error;
            }
        };
        return descriptor;
    };
}
