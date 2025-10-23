"use strict";
// /utils/validateInput.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInput = validateInput;
function validateInput(input) {
    const candidate = input;
    return (typeof input === 'object' &&
        input !== null &&
        typeof candidate.task_id === 'string' &&
        typeof candidate.agent === 'string' &&
        'data' in input);
}
