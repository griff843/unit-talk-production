"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgentError = void 0;
class BaseAgentError extends Error {
    constructor(message, agentName, context, isRetryable = false) {
        super(message);
        this.name = this.constructor.name;
        this.agentName = agentName;
        this.context = context;
        this.isRetryable = isRetryable;
    }
}
exports.BaseAgentError = BaseAgentError;
