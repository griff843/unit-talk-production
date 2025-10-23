"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecapError = void 0;
// Error handling
// Add RecapError as a class, not just an interface
class RecapError extends Error {
    constructor(options) {
        super(options.message);
        this.name = 'RecapError';
        this.code = options.code;
        this.timestamp = options.timestamp;
        this.context = options.context || {};
        this.severity = options.severity;
    }
}
exports.RecapError = RecapError;
