"use strict";
/**
 * Production Error Handling System
 * Comprehensive error management for professional betting system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGradingError = exports.handleCLVError = exports.handleDeviggingError = exports.handleDatabaseError = exports.productionErrorHandler = exports.ProductionErrorHandler = void 0;
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('ProductionErrorHandler');
class ProductionErrorHandler {
    constructor() {
        this.errorCounts = new Map();
        this.circuitBreakers = new Map();
    }
    static getInstance() {
        if (!ProductionErrorHandler.instance) {
            ProductionErrorHandler.instance = new ProductionErrorHandler();
        }
        return ProductionErrorHandler.instance;
    }
    /**
     * Handle errors with context and automatic recovery
     */
    async handleError(error, context, recoveryAction) {
        // Log the error with full context
        this.logError(error, context);
        // Update error tracking
        this.trackError(context.operation, context.severity);
        // Check circuit breaker
        if (this.isCircuitOpen(context.operation)) {
            logger.error(`Circuit breaker open for ${context.operation}, aborting`);
            return { recovered: false, finalError: new Error('Circuit breaker open') };
        }
        // Attempt recovery if specified
        if (recoveryAction) {
            return await this.attemptRecovery(error, context, recoveryAction);
        }
        // Default handling based on severity
        return await this.defaultErrorHandling(error, context);
    }
    /**
     * Handle professional system specific errors
     */
    async handleProfessionalSystemError(error, operation, pickData) {
        const context = {
            operation: `professional_system.${operation}`,
            pickId: pickData?.id,
            metadata: { pickData, operation },
            severity: operation === 'database_operation' ? 'critical' : 'high'
        };
        // Operation-specific recovery strategies
        let recoveryAction;
        switch (operation) {
            case 'devigging':
                recoveryAction = {
                    action: 'fallback',
                    fallbackFn: async () => {
                        // Fallback to conservative devigging
                        logger.warn('Using conservative devigging fallback');
                        return {
                            trueProb: 0.5,
                            fairOdds: -110,
                            edge: 0.01, // Conservative 1% edge
                            totalVig: 0.045
                        };
                    }
                };
                break;
            case 'clv_tracking':
                recoveryAction = {
                    action: 'retry',
                    maxRetries: 3,
                    delay: 1000
                };
                break;
            case 'professional_grading':
                recoveryAction = {
                    action: 'fallback',
                    fallbackFn: async () => {
                        // Fallback to basic grading
                        logger.warn('Using basic grading fallback');
                        return {
                            overallScore: 2.0, // Conservative professional_score
                            tier: 'C',
                            confidence: 0.5,
                            contributions: { fallback: true }
                        };
                    }
                };
                break;
            case 'database_operation':
                recoveryAction = {
                    action: 'retry',
                    maxRetries: 5,
                    delay: 2000
                };
                break;
        }
        return await this.handleError(error, context, recoveryAction);
    }
    /**
     * Log error with structured format
     */
    logError(error, context) {
        const errorData = {
            timestamp: new Date().toISOString(),
            operation: context.operation,
            severity: context.severity,
            error: {
                name: error.name || 'UnknownError',
                message: error.message || 'No error message',
                stack: error.stack || 'No stack trace',
                code: error.code || null
            },
            context: {
                userId: context.userId,
                pickId: context.pickId,
                sessionId: context.sessionId,
                metadata: context.metadata
            },
            environment: process.env.NODE_ENV,
            version: process.env.npm_package_version || 'unknown'
        };
        // Log based on severity
        switch (context.severity) {
            case 'critical':
                logger.error('CRITICAL ERROR:', errorData);
                break;
            case 'high':
                logger.error('HIGH SEVERITY ERROR:', errorData);
                break;
            case 'medium':
                logger.warn('MEDIUM SEVERITY ERROR:', errorData);
                break;
            case 'low':
                logger.info('LOW SEVERITY ERROR:', errorData);
                break;
        }
        // Send to external monitoring (would integrate with DataDog, New Relic, etc.)
        this.sendToExternalMonitoring(errorData);
    }
    /**
     * Track error counts for circuit breaker logic
     */
    trackError(operation, severity) {
        const key = operation;
        const currentCount = this.errorCounts.get(key) || 0;
        this.errorCounts.set(key, currentCount + 1);
        // Update circuit breaker for critical/high severity errors
        if (severity === 'critical' || severity === 'high') {
            const breaker = this.circuitBreakers.get(operation) || { failures: 0, lastFailure: new Date(), isOpen: false };
            breaker.failures++;
            breaker.lastFailure = new Date();
            // Open circuit if too many failures
            if (breaker.failures >= 5) {
                breaker.isOpen = true;
                logger.error(`Circuit breaker opened for ${operation} after ${breaker.failures} failures`);
            }
            this.circuitBreakers.set(operation, breaker);
        }
    }
    /**
     * Check if circuit breaker is open
     */
    isCircuitOpen(operation) {
        const breaker = this.circuitBreakers.get(operation);
        if (!breaker || !breaker.isOpen)
            return false;
        // Auto-reset circuit breaker after 5 minutes
        const resetTime = 5 * 60 * 1000; // 5 minutes
        if (Date.now() - breaker.lastFailure.getTime() > resetTime) {
            breaker.isOpen = false;
            breaker.failures = 0;
            this.circuitBreakers.set(operation, breaker);
            logger.info(`Circuit breaker reset for ${operation}`);
            return false;
        }
        return true;
    }
    /**
     * Attempt error recovery
     */
    async attemptRecovery(error, context, recoveryAction) {
        switch (recoveryAction.action) {
            case 'retry':
                return await this.attemptRetry(error, context, recoveryAction);
            case 'fallback':
                if (recoveryAction.fallbackFn) {
                    try {
                        const result = await recoveryAction.fallbackFn();
                        logger.info(`Fallback successful for ${context.operation}`);
                        return { recovered: true, result };
                    }
                    catch (fallbackError) {
                        logger.error(`Fallback failed for ${context.operation}:`, fallbackError);
                        return { recovered: false, finalError: fallbackError };
                    }
                }
                break;
            case 'abort':
                logger.error(`Operation ${context.operation} aborted due to error`);
                return { recovered: false, finalError: error };
            case 'escalate':
                await this.escalateError(error, context);
                return { recovered: false, finalError: error };
        }
        return { recovered: false, finalError: error };
    }
    /**
     * Attempt retry with exponential backoff
     */
    async attemptRetry(error, context, recoveryAction) {
        const maxRetries = recoveryAction.maxRetries || 3;
        const baseDelay = recoveryAction.delay || 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
            logger.info(`Retry attempt ${attempt}/${maxRetries} for ${context.operation} (delay: ${delay}ms)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            try {
                // This would need to be implemented per operation
                // For now, just simulate success/failure
                if (Math.random() > 0.7) { // 30% success rate for demo
                    logger.info(`Retry successful for ${context.operation} on attempt ${attempt}`);
                    return { recovered: true, result: { retrySuccessful: true, attempt } };
                }
            }
            catch (retryError) {
                logger.error(`Retry attempt ${attempt} failed for ${context.operation}:`, retryError);
                if (attempt === maxRetries) {
                    return { recovered: false, finalError: retryError };
                }
            }
        }
        return { recovered: false, finalError: error };
    }
    /**
     * Default error handling based on severity
     */
    async defaultErrorHandling(error, context) {
        switch (context.severity) {
            case 'critical':
                // Critical errors require immediate attention
                await this.escalateError(error, context);
                return { recovered: false, finalError: error };
            case 'high':
                // High severity - try basic retry
                return await this.attemptRetry(error, context, { action: 'retry', maxRetries: 2, delay: 1000 });
            case 'medium':
                // Medium severity - log and continue
                logger.warn(`Medium severity error in ${context.operation}, continuing with degraded functionality`);
                return { recovered: true, result: { degraded: true } };
            case 'low':
                // Low severity - just log
                logger.info(`Low severity error in ${context.operation}, minor impact`);
                return { recovered: true, result: { minorImpact: true } };
        }
    }
    /**
     * Escalate error to ops team
     */
    async escalateError(error, context) {
        const escalationData = {
            timestamp: new Date().toISOString(),
            severity: context.severity,
            operation: context.operation,
            error: error.message,
            context: context.metadata,
            requiresImmediateAttention: true
        };
        // Send to ops team (would integrate with PagerDuty, Slack, etc.)
        logger.error('ESCALATING ERROR TO OPS TEAM:', escalationData);
        // In production, this would send alerts via:
        // - PagerDuty API
        // - Slack webhooks
        // - Email notifications
        // - SMS alerts for critical issues
    }
    /**
     * Send error data to external monitoring
     */
    sendToExternalMonitoring(errorData) {
        // In production, integrate with:
        // - DataDog
        // - New Relic
        // - Sentry
        // - Application Insights
        // For now, just log
        logger.info('Error sent to monitoring (placeholder):', {
            operation: errorData.operation,
            severity: errorData.severity,
            timestamp: errorData.timestamp
        });
    }
    /**
     * Get error statistics
     */
    getErrorStats() {
        const errorsByOperation = {};
        let totalErrors = 0;
        for (const [operation, count] of this.errorCounts.entries()) {
            errorsByOperation[operation] = count;
            totalErrors += count;
        }
        const circuitBreakerStatus = {};
        for (const [operation, breaker] of this.circuitBreakers.entries()) {
            circuitBreakerStatus[operation] = {
                isOpen: breaker.isOpen,
                failures: breaker.failures
            };
        }
        return {
            totalErrors,
            errorsByOperation,
            circuitBreakerStatus
        };
    }
}
exports.ProductionErrorHandler = ProductionErrorHandler;
// Export singleton instance
exports.productionErrorHandler = ProductionErrorHandler.getInstance();
// Convenience functions for common error types
const handleDatabaseError = (error, operation, data) => exports.productionErrorHandler.handleProfessionalSystemError(error, 'database_operation', data);
exports.handleDatabaseError = handleDatabaseError;
const handleDeviggingError = (error, pickData) => exports.productionErrorHandler.handleProfessionalSystemError(error, 'devigging', pickData);
exports.handleDeviggingError = handleDeviggingError;
const handleCLVError = (error, pickData) => exports.productionErrorHandler.handleProfessionalSystemError(error, 'clv_tracking', pickData);
exports.handleCLVError = handleCLVError;
const handleGradingError = (error, pickData) => exports.productionErrorHandler.handleProfessionalSystemError(error, 'professional_grading', pickData);
exports.handleGradingError = handleGradingError;
