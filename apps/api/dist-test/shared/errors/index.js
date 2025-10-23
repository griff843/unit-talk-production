"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessLogicError = exports.TimeoutError = exports.ConfigurationError = exports.RateLimitError = exports.ExternalServiceError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.DatabaseError = exports.ValidationError = exports.BaseError = void 0;
exports.handleError = handleError;
exports.logError = logError;
exports.createErrorResponse = createErrorResponse;
exports.isBaseError = isBaseError;
exports.isValidationError = isValidationError;
exports.isDatabaseError = isDatabaseError;
exports.isAuthenticationError = isAuthenticationError;
exports.isAuthorizationError = isAuthorizationError;
exports.isNotFoundError = isNotFoundError;
exports.isConflictError = isConflictError;
exports.isExternalServiceError = isExternalServiceError;
exports.isRateLimitError = isRateLimitError;
exports.isConfigurationError = isConfigurationError;
exports.isTimeoutError = isTimeoutError;
exports.isBusinessLogicError = isBusinessLogicError;
class BaseError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.BaseError = BaseError;
class ValidationError extends BaseError {
    constructor(message, field, details) {
        super(message, 'VALIDATION_ERROR', details);
        this.field = field;
    }
}
exports.ValidationError = ValidationError;
class DatabaseError extends BaseError {
    constructor(message, query, details) {
        super(message, 'DATABASE_ERROR', details);
        this.query = query;
    }
}
exports.DatabaseError = DatabaseError;
class AuthenticationError extends BaseError {
    constructor(message, details) {
        super(message, 'AUTHENTICATION_ERROR', details);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends BaseError {
    constructor(message, details) {
        super(message, 'AUTHORIZATION_ERROR', details);
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends BaseError {
    constructor(message, resource, details) {
        super(message, 'NOT_FOUND_ERROR', details);
        this.resource = resource;
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends BaseError {
    constructor(message, resource, details) {
        super(message, 'CONFLICT_ERROR', details);
        this.resource = resource;
    }
}
exports.ConflictError = ConflictError;
class ExternalServiceError extends BaseError {
    constructor(message, service, statusCode, details) {
        super(message, 'EXTERNAL_SERVICE_ERROR', details);
        this.service = service;
        this.statusCode = statusCode;
    }
}
exports.ExternalServiceError = ExternalServiceError;
class RateLimitError extends BaseError {
    constructor(message, retryAfter, details) {
        super(message, 'RATE_LIMIT_ERROR', details);
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
class ConfigurationError extends BaseError {
    constructor(message, configKey, details) {
        super(message, 'CONFIGURATION_ERROR', details);
        this.configKey = configKey;
    }
}
exports.ConfigurationError = ConfigurationError;
class TimeoutError extends BaseError {
    constructor(message, timeoutMs, details) {
        super(message, 'TIMEOUT_ERROR', details);
        this.timeoutMs = timeoutMs;
    }
}
exports.TimeoutError = TimeoutError;
class BusinessLogicError extends BaseError {
    constructor(message, rule, details) {
        super(message, 'BUSINESS_LOGIC_ERROR', details);
        this.rule = rule;
    }
}
exports.BusinessLogicError = BusinessLogicError;
// Error handler utility
function handleError(error) {
    if (error instanceof BaseError) {
        return error;
    }
    if (error instanceof Error) {
        return new BaseError(error.message, 'UNKNOWN_ERROR', { originalError: error.name });
    }
    return new BaseError('An unknown error occurred', 'UNKNOWN_ERROR', { originalError: String(error) });
}
// Error logging utility
const logger_1 = require("../logger");
function logError(error, context) {
    logger_1.logger.error(error.message, {
        code: error.code,
        details: error.details,
        context,
        stack: error.stack
    });
}
function createErrorResponse(error) {
    return {
        error: {
            code: error.code,
            message: error.message,
            ...(error.details && { details: error.details })
        }
    };
}
// Error type guards
function isBaseError(error) {
    return error instanceof BaseError;
}
function isValidationError(error) {
    return error instanceof ValidationError;
}
function isDatabaseError(error) {
    return error instanceof DatabaseError;
}
function isAuthenticationError(error) {
    return error instanceof AuthenticationError;
}
function isAuthorizationError(error) {
    return error instanceof AuthorizationError;
}
function isNotFoundError(error) {
    return error instanceof NotFoundError;
}
function isConflictError(error) {
    return error instanceof ConflictError;
}
function isExternalServiceError(error) {
    return error instanceof ExternalServiceError;
}
function isRateLimitError(error) {
    return error instanceof RateLimitError;
}
function isConfigurationError(error) {
    return error instanceof ConfigurationError;
}
function isTimeoutError(error) {
    return error instanceof TimeoutError;
}
function isBusinessLogicError(error) {
    return error instanceof BusinessLogicError;
}
// Export all error types
// Note: Classes are already exported at declaration, no need to re-export
