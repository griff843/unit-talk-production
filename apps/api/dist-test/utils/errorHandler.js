"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = void 0;
exports.handleError = handleError;
const logging_1 = require("../services/logging");
function handleError(error, context = '') {
    logging_1.logger.error({ error, context }, `Error: ${context}`);
}
class ErrorHandler {
    constructor(logger) {
        this.logger = logger;
    }
    handleError(error, context) {
        this.logger.error('Error occurred', { error: error.message, ...context });
    }
    async withRetry(fn, operation) {
        const maxRetries = 3;
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                this.logger.warn(`${operation} failed (attempt ${attempt}/${maxRetries})`, { error: lastError.message });
                if (attempt === maxRetries) {
                    break;
                }
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
        if (!lastError) {
            lastError = new Error(`${operation} failed after ${maxRetries} attempts`);
        }
        this.handleError(lastError, { operation, attempts: maxRetries });
        throw lastError;
    }
}
exports.ErrorHandler = ErrorHandler;
