"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentError = exports.ExternalServiceError = exports.RateLimitError = exports.ConfigurationError = exports.WorkflowError = exports.DatabaseError = exports.NetworkError = exports.ProcessingError = exports.AgentValidationError = exports.AgentError = void 0;
// Base agent error class
class AgentError extends Error {
    constructor(message, data) {
        super(message);
        this.name = 'AgentError';
        this.agentName = data.agentName;
        this.operation = data.operation;
        this.details = data.details;
        this.timestamp = data.timestamp || new Date().toISOString();
        this.severity = data.severity || 'medium';
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            agentName: this.agentName,
            operation: this.operation,
            details: this.details,
            timestamp: this.timestamp,
            severity: this.severity
        };
    }
}
exports.AgentError = AgentError;
// Agent validation error
class AgentValidationError extends AgentError {
    constructor(message, data) {
        super(message, data);
        this.name = 'AgentValidationError';
        if (data.zodError) {
            this.details = {
                ...this.details,
                zodErrors: data.zodError.issues
            };
        }
    }
}
exports.AgentValidationError = AgentValidationError;
// Processing error
class ProcessingError extends AgentError {
    constructor(message, data) {
        super(message, data);
        this.name = 'ProcessingError';
    }
}
exports.ProcessingError = ProcessingError;
// Network error
class NetworkError extends AgentError {
    constructor(message, data) {
        super(message, data);
        this.name = 'NetworkError';
        this.details = {
            ...this.details,
            statusCode: data.statusCode,
            endpoint: data.endpoint
        };
    }
}
exports.NetworkError = NetworkError;
// Database error
class DatabaseError extends AgentError {
    constructor(message, data) {
        super(message, data);
        this.name = 'DatabaseError';
        this.details = {
            ...this.details,
            table: data.table,
            operation: data.operation
        };
    }
}
exports.DatabaseError = DatabaseError;
// Temporal workflow error
class WorkflowError extends AgentError {
    constructor(message, data) {
        super(message, data);
        this.name = 'WorkflowError';
        this.details = {
            ...this.details,
            workflowId: data.workflowId,
            activityName: data.activityName
        };
    }
}
exports.WorkflowError = WorkflowError;
// Configuration error
class ConfigurationError extends AgentError {
    constructor(message, data) {
        super(message, data);
        this.name = 'ConfigurationError';
        this.details = {
            ...this.details,
            configKey: data.configKey
        };
    }
}
exports.ConfigurationError = ConfigurationError;
// Rate limit error
class RateLimitError extends AgentError {
    constructor(message, data) {
        super(message, data);
        this.name = 'RateLimitError';
        this.details = {
            ...this.details,
            limit: data.limit,
            resetTime: data.resetTime
        };
    }
}
exports.RateLimitError = RateLimitError;
// External service error
class ExternalServiceError extends AgentError {
    constructor(message, data) {
        super(message, data);
        this.name = 'ExternalServiceError';
        this.details = {
            ...this.details,
            service: data.service,
            endpoint: data.endpoint
        };
    }
}
exports.ExternalServiceError = ExternalServiceError;
// Error factory
const createAgentError = (type, message, data) => {
    switch (type) {
        case 'validation':
            return new AgentValidationError(message, data);
        case 'processing':
            return new ProcessingError(message, data);
        case 'network':
            return new NetworkError(message, data);
        case 'database':
            return new DatabaseError(message, data);
        case 'workflow':
            return new WorkflowError(message, data);
        case 'configuration':
            return new ConfigurationError(message, data);
        case 'rateLimit':
            return new RateLimitError(message, data);
        case 'externalService':
            return new ExternalServiceError(message, data);
        default:
            return new AgentError(message, data);
    }
};
exports.createAgentError = createAgentError;
