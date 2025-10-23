export declare class BaseError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown> | undefined);
}
export declare class ValidationError extends BaseError {
    readonly field?: string | undefined;
    constructor(message: string, field?: string | undefined, details?: Record<string, unknown>);
}
export declare class DatabaseError extends BaseError {
    readonly query?: string | undefined;
    constructor(message: string, query?: string | undefined, details?: Record<string, unknown>);
}
export declare class AuthenticationError extends BaseError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class AuthorizationError extends BaseError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class NotFoundError extends BaseError {
    readonly resource?: string | undefined;
    constructor(message: string, resource?: string | undefined, details?: Record<string, unknown>);
}
export declare class ConflictError extends BaseError {
    readonly resource?: string | undefined;
    constructor(message: string, resource?: string | undefined, details?: Record<string, unknown>);
}
export declare class ExternalServiceError extends BaseError {
    readonly service: string;
    readonly statusCode?: number | undefined;
    constructor(message: string, service: string, statusCode?: number | undefined, details?: Record<string, unknown>);
}
export declare class RateLimitError extends BaseError {
    readonly retryAfter?: number | undefined;
    constructor(message: string, retryAfter?: number | undefined, details?: Record<string, unknown>);
}
export declare class ConfigurationError extends BaseError {
    readonly configKey?: string | undefined;
    constructor(message: string, configKey?: string | undefined, details?: Record<string, unknown>);
}
export declare class TimeoutError extends BaseError {
    readonly timeoutMs?: number | undefined;
    constructor(message: string, timeoutMs?: number | undefined, details?: Record<string, unknown>);
}
export declare class BusinessLogicError extends BaseError {
    readonly rule?: string | undefined;
    constructor(message: string, rule?: string | undefined, details?: Record<string, unknown>);
}
export declare function handleError(error: unknown): BaseError;
export declare function logError(error: BaseError, context?: Record<string, unknown>): void;
export interface ErrorResponse {
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}
export declare function createErrorResponse(error: BaseError): ErrorResponse;
export declare function isBaseError(error: unknown): error is BaseError;
export declare function isValidationError(error: unknown): error is ValidationError;
export declare function isDatabaseError(error: unknown): error is DatabaseError;
export declare function isAuthenticationError(error: unknown): error is AuthenticationError;
export declare function isAuthorizationError(error: unknown): error is AuthorizationError;
export declare function isNotFoundError(error: unknown): error is NotFoundError;
export declare function isConflictError(error: unknown): error is ConflictError;
export declare function isExternalServiceError(error: unknown): error is ExternalServiceError;
export declare function isRateLimitError(error: unknown): error is RateLimitError;
export declare function isConfigurationError(error: unknown): error is ConfigurationError;
export declare function isTimeoutError(error: unknown): error is TimeoutError;
export declare function isBusinessLogicError(error: unknown): error is BusinessLogicError;
//# sourceMappingURL=index.d.ts.map