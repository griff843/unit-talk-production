"use strict";
/**
 * Centralized scoring weights types for all sports
 * Ensures type safety and eliminates magic numbers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWeights = validateWeights;
// Validation function to ensure weights are reasonable
function validateWeights(weights) {
    // Check that all weights are non-negative and reasonable (between 0 and 1)
    for (const [key, value] of Object.entries(weights)) {
        if (typeof value === 'number') {
            if (value < 0 || value > 1) {
                console.warn(`⚠️ Weight ${key} is out of range [0,1]: ${value}`);
                return false;
            }
        }
    }
    // Weights are structured in categories and don't need to sum to 1.0
    // This is a multi-dimensional scoring system where each category contributes
    return true;
}
