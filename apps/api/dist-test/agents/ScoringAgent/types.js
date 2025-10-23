"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringError = void 0;
class ScoringError extends Error {
    constructor(message, data) {
        super(message);
        this.name = 'ScoringError';
        this.pickId = data?.pickId || '';
        this.operation = data?.operation || '';
        if (data?.details !== undefined) {
            this.details = data.details;
        }
    }
}
exports.ScoringError = ScoringError;
