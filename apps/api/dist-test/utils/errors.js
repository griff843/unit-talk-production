"use strict";
// /utils/errors.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.AgentError = void 0;
class AgentError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AgentError';
    }
}
exports.AgentError = AgentError;
class ValidationError extends AgentError {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
