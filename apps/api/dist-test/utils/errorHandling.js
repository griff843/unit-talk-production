"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = exports.DatabaseError = exports.ValidationError = void 0;
const logger_1 = require("./logger");
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class DatabaseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
class ErrorHandler {
    constructor(context, supabase) {
        this.context = context;
        this.logger = (0, logger_1.createLogger)(`ErrorHandler${context ? ':' + context : ''}`);
        this.supabase = supabase;
    }
    async handleError(error, additionalContext) {
        const errorRecord = {
            message: error.message,
            code: error.name,
            ...(error.stack && { stack: error.stack }),
            context: {
                source: this.context,
                ...additionalContext
            },
            severity: this.determineSeverity(error)
        };
        await this.recordError(errorRecord);
        if (this.isCriticalError(error)) {
            await this.handleCriticalError(errorRecord);
        }
    }
    determineSeverity(error) {
        if (error instanceof ValidationError) {
            return 'low';
        }
        if (error instanceof DatabaseError) {
            return 'high';
        }
        if (error.message.includes('critical')) {
            return 'critical';
        }
        return 'medium';
    }
    isCriticalError(error) {
        return error instanceof DatabaseError || error.message.includes('critical');
    }
    async recordError(error) {
        try {
            if (this.supabase) {
                const { error: dbError } = await this.supabase
                    .from('agent_errors')
                    .insert([{
                        message: error.message,
                        code: error.code,
                        stack: error.stack,
                        context: error.context,
                        severity: error.severity,
                        timestamp: new Date().toISOString()
                    }]);
                if (dbError) {
                    this.logger.error('Failed to record error in database:', { error: dbError.message });
                }
            }
        }
        catch (err) {
            this.logger.error('Failed to record error:', { error: err instanceof Error ? err.message : String(err) });
        }
    }
    async handleCriticalError(error) {
        try {
            if (this.supabase) {
                const { error: dbError } = await this.supabase
                    .from('critical_errors')
                    .insert([{
                        message: error.message,
                        code: error.code,
                        stack: error.stack,
                        context: error.context,
                        severity: error.severity,
                        timestamp: new Date().toISOString()
                    }]);
                if (dbError) {
                    this.logger.error('Failed to record critical error:', { error: dbError.message });
                }
            }
            await this.triggerCriticalErrorAlerts(error);
        }
        catch (err) {
            this.logger.error('Failed to handle critical error:', { error: err instanceof Error ? err.message : String(err) });
        }
    }
    async triggerCriticalErrorAlerts(error) {
        this.logger.warn('Critical error occurred:', { error });
    }
    async getErrorStats(timeWindowMs = 3600000) {
        try {
            const startTime = new Date(Date.now() - timeWindowMs).toISOString();
            if (!this.supabase) {
                return {};
            }
            const { data, error } = await this.supabase
                .from('agent_errors')
                .select('severity')
                .gte('timestamp', startTime);
            if (error) {
                throw error;
            }
            return (data || []).reduce((acc, curr) => {
                acc[curr.severity] = (acc[curr.severity] || 0) + 1;
                return acc;
            }, {});
        }
        catch (error) {
            this.logger.error('Failed to get error stats:', { err: error instanceof Error ? error.message : String(error) });
            return {};
        }
    }
    async withRetry(fn, operation) {
        const maxRetries = 3;
        const baseDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            }
            catch (error) {
                const isLastAttempt = attempt === maxRetries;
                if (isLastAttempt) {
                    this.logger.error(`Operation '${operation}' failed after ${maxRetries} attempts`, {
                        error: error instanceof Error ? error.message : String(error),
                        attempt
                    });
                    await this.handleError(error instanceof Error ? error : new Error(String(error)), {
                        operation,
                        attempt,
                        maxRetries
                    });
                    throw error;
                }
                const delay = baseDelay * Math.pow(2, attempt - 1);
                this.logger.warn(`Operation '${operation}' failed on attempt ${attempt}, retrying in ${delay}ms`, {
                    error: error instanceof Error ? error.message : String(error),
                    attempt,
                    delay
                });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        // This should never be reached, but TypeScript requires it
        throw new Error(`Unexpected error in withRetry for operation: ${operation}`);
    }
}
exports.ErrorHandler = ErrorHandler;
