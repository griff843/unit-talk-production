"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Fortune 100 Syndicate-Level Grading Engine
 * Implements advanced multi-model scoring with dynamic weight optimization,
 * comprehensive risk management, and real-time performance attribution
 */
/**
 * Safe mathematical operations to prevent NaN errors
 */
function safeNumber(value, defaultValue = 0) {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
}
function safeMultiply(a, b, defaultA = 0, defaultB = 1) {
    const numA = safeNumber(a, defaultA);
    const numB = safeNumber(b, defaultB);
    const result = numA * numB;
    return isNaN(result) || !isFinite(result) ? 0 : result;
}
function safeDivide(numerator, denominator, defaultValue = 0) {
    const num = safeNumber(numerator, 0);
    const den = safeNumber(denominator, 1);
    if (den === 0)
        return defaultValue;
    const result = num / den;
    return isNaN(result) || !isFinite(result) ? defaultValue : result;
}
function safeWeight(weights, key, defaultValue = 1) {
    if (!weights || typeof weights !== 'object')
        return defaultValue;
    return safeNumber(weights[key], defaultValue);
}
// Note: SyndicateGradingEngine moved to gradingEngine.ts to avoid conflicts
// Import it from gradingEngine.ts instead of defining it here
