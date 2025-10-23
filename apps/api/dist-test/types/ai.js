"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutError = exports.AIValidationError = exports.CircuitBreakerError = exports.RateLimitError = exports.AIServiceError = exports.RateLimiterConfigSchema = exports.CircuitBreakerConfigSchema = exports.AnthropicConfigSchema = exports.OpenAIConfigSchema = exports.MarketContextSchema = exports.ConsensusAdviceSchema = exports.AIAdviceSchema = exports.ModelConfigSchema = void 0;
const zod_1 = require("zod");
exports.ModelConfigSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    provider: zod_1.z.enum(['openai', 'anthropic', 'google']),
    model: zod_1.z.string(),
    temperature: zod_1.z.number().min(0).max(2),
    maxTokens: zod_1.z.number().positive(),
    enabled: zod_1.z.boolean(),
    priority: zod_1.z.number().int().positive(),
    performance: zod_1.z.object({
        accuracy: zod_1.z.number().min(0).max(1),
        avgLatency: zod_1.z.number().positive(),
        errorRate: zod_1.z.number().min(0).max(1),
        lastUpdated: zod_1.z.string(),
        totalPredictions: zod_1.z.number().int().nonnegative(),
        correctPredictions: zod_1.z.number().int().nonnegative(),
        avgConfidence: zod_1.z.number().min(0).max(1),
        successRate: zod_1.z.number().min(0).max(1)
    }),
    costPerToken: zod_1.z.number().positive(),
    maxRequestsPerMinute: zod_1.z.number().int().positive()
});
exports.AIAdviceSchema = zod_1.z.object({
    advice: zod_1.z.string(),
    confidence: zod_1.z.number().min(0).max(1),
    reasoning: zod_1.z.string(),
    model: zod_1.z.string(),
    temperature: zod_1.z.number().min(0).max(2),
    processingTime: zod_1.z.number().nonnegative(),
    fallbackUsed: zod_1.z.boolean(),
    consensusScore: zod_1.z.number().min(0).max(1).optional()
});
exports.ConsensusAdviceSchema = zod_1.z.object({
    primaryAdvice: zod_1.z.string(),
    confidence: zod_1.z.number().min(0).max(1),
    agreement: zod_1.z.number().min(0).max(1),
    models: zod_1.z.array(zod_1.z.string()),
    reasoning: zod_1.z.array(zod_1.z.string()),
    conflictFlags: zod_1.z.array(zod_1.z.string())
});
exports.MarketContextSchema = zod_1.z.object({
    regime: zod_1.z.enum(['bull', 'bear', 'sideways']),
    volatility: zod_1.z.number().min(0).max(1),
    sentiment: zod_1.z.number().min(-1).max(1),
    timeOfDay: zod_1.z.enum(['market_hours', 'evening', 'overnight']),
    dayOfWeek: zod_1.z.string()
});
exports.OpenAIConfigSchema = zod_1.z.object({
    apiKey: zod_1.z.string(),
    organization: zod_1.z.string().optional(),
    maxRetries: zod_1.z.number().int().positive().optional(),
    timeout: zod_1.z.number().positive().optional()
});
exports.AnthropicConfigSchema = zod_1.z.object({
    apiKey: zod_1.z.string(),
    maxRetries: zod_1.z.number().int().positive().optional(),
    timeout: zod_1.z.number().positive().optional()
});
exports.CircuitBreakerConfigSchema = zod_1.z.object({
    failureThreshold: zod_1.z.number().int().positive(),
    resetTimeout: zod_1.z.number().positive(),
    halfOpenTimeout: zod_1.z.number().positive()
});
exports.RateLimiterConfigSchema = zod_1.z.object({
    maxRequests: zod_1.z.number().int().positive(),
    timeWindow: zod_1.z.number().positive(),
    retryAfter: zod_1.z.number().positive()
});
// AI Service Error Types
class AIServiceError extends Error {
    constructor(message, provider, model, retryable = true, context) {
        super(message);
        this.provider = provider;
        this.model = model;
        this.retryable = retryable;
        this.context = context;
        this.name = 'AIServiceError';
    }
}
exports.AIServiceError = AIServiceError;
class RateLimitError extends AIServiceError {
    constructor(provider, model, retryAfter, context) {
        super(`Rate limit exceeded for ${provider} model ${model}`, provider, model, true, context);
        this.retryAfter = retryAfter;
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
class CircuitBreakerError extends AIServiceError {
    constructor(provider, model, resetAfter, context) {
        super(`Circuit breaker open for ${provider} model ${model}`, provider, model, false, context);
        this.resetAfter = resetAfter;
        this.name = 'CircuitBreakerError';
    }
}
exports.CircuitBreakerError = CircuitBreakerError;
class AIValidationError extends AIServiceError {
    constructor(provider, model, validationErrors, context) {
        super(`Validation failed for ${provider} model ${model}: ${validationErrors.join(', ')}`, provider, model, false, context);
        this.validationErrors = validationErrors;
        this.name = 'AIValidationError';
    }
}
exports.AIValidationError = AIValidationError;
class TimeoutError extends AIServiceError {
    constructor(provider, model, timeoutMs, context) {
        super(`Request timed out after ${timeoutMs}ms for ${provider} model ${model}`, provider, model, true, context);
        this.timeoutMs = timeoutMs;
        this.name = 'TimeoutError';
    }
}
exports.TimeoutError = TimeoutError;
