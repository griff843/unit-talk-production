"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.externalServiceErrorSchema = exports.workflowErrorSchema = exports.agentErrorSchema = exports.databaseErrorSchema = exports.validationErrorSchema = exports.errorSchema = exports.ExternalServiceError = exports.WorkflowError = exports.AgentError = exports.DatabaseError = exports.ValidationError = void 0;
exports.handleError = handleError;
exports.isValidationError = isValidationError;
exports.isDatabaseError = isDatabaseError;
exports.isAgentError = isAgentError;
exports.isWorkflowError = isWorkflowError;
exports.isExternalServiceError = isExternalServiceError;
const zod_1 = require("zod");
// Validation error
class ValidationError extends Error {
    constructor(message, context) {
        super(message);
        this.name = 'ValidationError';
        this.code = 'VALIDATION_ERROR';
        if (context) {
            this.context = context;
        }
    }
}
exports.ValidationError = ValidationError;
// Database error
class DatabaseError extends Error {
    constructor(message, context) {
        super(message);
        this.name = 'DatabaseError';
        this.code = 'DATABASE_ERROR';
        if (context) {
            this.context = context;
        }
    }
}
exports.DatabaseError = DatabaseError;
// Agent error
class AgentError extends Error {
    constructor(message, context) {
        super(message);
        this.name = 'AgentError';
        this.code = 'AGENT_ERROR';
        if (context) {
            this.context = context;
        }
    }
}
exports.AgentError = AgentError;
// Workflow error
class WorkflowError extends Error {
    constructor(message, context) {
        super(message);
        this.name = 'WorkflowError';
        this.code = 'WORKFLOW_ERROR';
        if (context) {
            this.context = context;
        }
    }
}
exports.WorkflowError = WorkflowError;
// External service error
class ExternalServiceError extends Error {
    constructor(message, context) {
        super(message);
        this.name = 'ExternalServiceError';
        this.code = 'EXTERNAL_SERVICE_ERROR';
        if (context) {
            this.context = context;
        }
    }
}
exports.ExternalServiceError = ExternalServiceError;
// Error handler utility
function handleError(error, _context) {
    if (error instanceof Error) {
        return {
            message: error.message,
            code: error.name,
            stack: error.stack || '',
            context: { originalError: error.constructor.name }
        };
    }
    return {
        message: String(error),
        code: 'UNKNOWN_ERROR',
        context: { originalValue: error }
    };
}
// Error validation schemas
exports.errorSchema = zod_1.z.object({
    message: zod_1.z.string(),
    code: zod_1.z.string().optional(),
    stack: zod_1.z.string().optional(),
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.validationErrorSchema = zod_1.z.object({
    message: zod_1.z.string(),
    code: zod_1.z.literal('VALIDATION_ERROR'),
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.databaseErrorSchema = zod_1.z.object({
    message: zod_1.z.string(),
    code: zod_1.z.literal('DATABASE_ERROR'),
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.agentErrorSchema = zod_1.z.object({
    message: zod_1.z.string(),
    code: zod_1.z.literal('AGENT_ERROR'),
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.workflowErrorSchema = zod_1.z.object({
    message: zod_1.z.string(),
    code: zod_1.z.literal('WORKFLOW_ERROR'),
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.externalServiceErrorSchema = zod_1.z.object({
    message: zod_1.z.string(),
    code: zod_1.z.literal('EXTERNAL_SERVICE_ERROR'),
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
// Type guards
function isValidationError(error) {
    return error instanceof ValidationError;
}
function isDatabaseError(error) {
    return error instanceof DatabaseError;
}
function isAgentError(error) {
    return error instanceof AgentError;
}
function isWorkflowError(error) {
    return error instanceof WorkflowError;
}
function isExternalServiceError(error) {
    return error instanceof ExternalServiceError;
}
