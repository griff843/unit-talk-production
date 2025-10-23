import { z } from 'zod';
export type AIProvider = 'openai' | 'anthropic' | 'google';
export interface ModelConfig {
    id: string;
    name: string;
    provider: AIProvider;
    model: string;
    temperature: number;
    maxTokens: number;
    enabled: boolean;
    priority: number;
    performance: ModelPerformance;
    costPerToken: number;
    maxRequestsPerMinute: number;
}
export declare const ModelConfigSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    provider: z.ZodEnum<["openai", "anthropic", "google"]>;
    model: z.ZodString;
    temperature: z.ZodNumber;
    maxTokens: z.ZodNumber;
    enabled: z.ZodBoolean;
    priority: z.ZodNumber;
    performance: z.ZodObject<{
        accuracy: z.ZodNumber;
        avgLatency: z.ZodNumber;
        errorRate: z.ZodNumber;
        lastUpdated: z.ZodString;
        totalPredictions: z.ZodNumber;
        correctPredictions: z.ZodNumber;
        avgConfidence: z.ZodNumber;
        successRate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        successRate: number;
        lastUpdated: string;
        errorRate: number;
        accuracy: number;
        totalPredictions: number;
        avgConfidence: number;
        avgLatency: number;
        correctPredictions: number;
    }, {
        successRate: number;
        lastUpdated: string;
        errorRate: number;
        accuracy: number;
        totalPredictions: number;
        avgConfidence: number;
        avgLatency: number;
        correctPredictions: number;
    }>;
    costPerToken: z.ZodNumber;
    maxRequestsPerMinute: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    enabled: boolean;
    model: string;
    performance: {
        successRate: number;
        lastUpdated: string;
        errorRate: number;
        accuracy: number;
        totalPredictions: number;
        avgConfidence: number;
        avgLatency: number;
        correctPredictions: number;
    };
    id: string;
    provider: "openai" | "anthropic" | "google";
    priority: number;
    temperature: number;
    maxTokens: number;
    costPerToken: number;
    maxRequestsPerMinute: number;
}, {
    name: string;
    enabled: boolean;
    model: string;
    performance: {
        successRate: number;
        lastUpdated: string;
        errorRate: number;
        accuracy: number;
        totalPredictions: number;
        avgConfidence: number;
        avgLatency: number;
        correctPredictions: number;
    };
    id: string;
    provider: "openai" | "anthropic" | "google";
    priority: number;
    temperature: number;
    maxTokens: number;
    costPerToken: number;
    maxRequestsPerMinute: number;
}>;
export interface ModelPerformance {
    accuracy: number;
    avgLatency: number;
    errorRate: number;
    lastUpdated: string;
    totalPredictions: number;
    correctPredictions: number;
    avgConfidence: number;
    successRate: number;
}
export interface AIAdvice {
    advice: string;
    confidence: number;
    reasoning: string;
    model: string;
    temperature: number;
    processingTime: number;
    fallbackUsed: boolean;
    consensusScore?: number;
}
export declare const AIAdviceSchema: z.ZodObject<{
    advice: z.ZodString;
    confidence: z.ZodNumber;
    reasoning: z.ZodString;
    model: z.ZodString;
    temperature: z.ZodNumber;
    processingTime: z.ZodNumber;
    fallbackUsed: z.ZodBoolean;
    consensusScore: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    model: string;
    advice: string;
    processingTime: number;
    reasoning: string;
    temperature: number;
    fallbackUsed: boolean;
    consensusScore?: number | undefined;
}, {
    confidence: number;
    model: string;
    advice: string;
    processingTime: number;
    reasoning: string;
    temperature: number;
    fallbackUsed: boolean;
    consensusScore?: number | undefined;
}>;
export interface ConsensusAdvice {
    primaryAdvice: string;
    confidence: number;
    agreement: number;
    models: string[];
    reasoning: string[];
    conflictFlags: string[];
}
export declare const ConsensusAdviceSchema: z.ZodObject<{
    primaryAdvice: z.ZodString;
    confidence: z.ZodNumber;
    agreement: z.ZodNumber;
    models: z.ZodArray<z.ZodString, "many">;
    reasoning: z.ZodArray<z.ZodString, "many">;
    conflictFlags: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    agreement: number;
    reasoning: string[];
    models: string[];
    primaryAdvice: string;
    conflictFlags: string[];
}, {
    confidence: number;
    agreement: number;
    reasoning: string[];
    models: string[];
    primaryAdvice: string;
    conflictFlags: string[];
}>;
export interface MarketContext {
    regime: 'bull' | 'bear' | 'sideways';
    volatility: number;
    sentiment: number;
    timeOfDay: 'market_hours' | 'evening' | 'overnight';
    dayOfWeek: string;
}
export declare const MarketContextSchema: z.ZodObject<{
    regime: z.ZodEnum<["bull", "bear", "sideways"]>;
    volatility: z.ZodNumber;
    sentiment: z.ZodNumber;
    timeOfDay: z.ZodEnum<["market_hours", "evening", "overnight"]>;
    dayOfWeek: z.ZodString;
}, "strip", z.ZodTypeAny, {
    volatility: number;
    sentiment: number;
    regime: "bull" | "bear" | "sideways";
    timeOfDay: "evening" | "market_hours" | "overnight";
    dayOfWeek: string;
}, {
    volatility: number;
    sentiment: number;
    regime: "bull" | "bear" | "sideways";
    timeOfDay: "evening" | "market_hours" | "overnight";
    dayOfWeek: string;
}>;
export interface OpenAIConfig {
    apiKey: string;
    organization?: string;
    maxRetries?: number;
    timeout?: number;
}
export declare const OpenAIConfigSchema: z.ZodObject<{
    apiKey: z.ZodString;
    organization: z.ZodOptional<z.ZodString>;
    maxRetries: z.ZodOptional<z.ZodNumber>;
    timeout: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
    timeout?: number | undefined;
    maxRetries?: number | undefined;
    organization?: string | undefined;
}, {
    apiKey: string;
    timeout?: number | undefined;
    maxRetries?: number | undefined;
    organization?: string | undefined;
}>;
export interface AnthropicConfig {
    apiKey: string;
    maxRetries?: number;
    timeout?: number;
}
export declare const AnthropicConfigSchema: z.ZodObject<{
    apiKey: z.ZodString;
    maxRetries: z.ZodOptional<z.ZodNumber>;
    timeout: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
    timeout?: number | undefined;
    maxRetries?: number | undefined;
}, {
    apiKey: string;
    timeout?: number | undefined;
    maxRetries?: number | undefined;
}>;
export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number;
    halfOpenTimeout: number;
}
export declare const CircuitBreakerConfigSchema: z.ZodObject<{
    failureThreshold: z.ZodNumber;
    resetTimeout: z.ZodNumber;
    halfOpenTimeout: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    failureThreshold: number;
    resetTimeout: number;
    halfOpenTimeout: number;
}, {
    failureThreshold: number;
    resetTimeout: number;
    halfOpenTimeout: number;
}>;
export interface RateLimiterConfig {
    maxRequests: number;
    timeWindow: number;
    retryAfter: number;
}
export declare const RateLimiterConfigSchema: z.ZodObject<{
    maxRequests: z.ZodNumber;
    timeWindow: z.ZodNumber;
    retryAfter: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    maxRequests: number;
    timeWindow: number;
    retryAfter: number;
}, {
    maxRequests: number;
    timeWindow: number;
    retryAfter: number;
}>;
export declare class AIServiceError extends Error {
    readonly provider: AIProvider;
    readonly model: string;
    readonly retryable: boolean;
    readonly context?: Record<string, unknown> | undefined;
    constructor(message: string, provider: AIProvider, model: string, retryable?: boolean, context?: Record<string, unknown> | undefined);
}
export declare class RateLimitError extends AIServiceError {
    readonly retryAfter: number;
    constructor(provider: AIProvider, model: string, retryAfter: number, context?: Record<string, unknown>);
}
export declare class CircuitBreakerError extends AIServiceError {
    readonly resetAfter: number;
    constructor(provider: AIProvider, model: string, resetAfter: number, context?: Record<string, unknown>);
}
export declare class AIValidationError extends AIServiceError {
    readonly validationErrors: string[];
    constructor(provider: AIProvider, model: string, validationErrors: string[], context?: Record<string, unknown>);
}
export declare class TimeoutError extends AIServiceError {
    readonly timeoutMs: number;
    constructor(provider: AIProvider, model: string, timeoutMs: number, context?: Record<string, unknown>);
}
//# sourceMappingURL=ai.d.ts.map