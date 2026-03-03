import { z } from 'zod';
// Removed conflicting import

// AI Provider Types
export type AIProvider = 'openai' | 'anthropic' | 'google';

// Model Configuration
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

export const ModelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(['openai', 'anthropic', 'google']),
  model: z.string(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().positive(),
  enabled: z.boolean(),
  priority: z.number().int().positive(),
  performance: z.object({
    accuracy: z.number().min(0).max(1),
    avgLatency: z.number().positive(),
    errorRate: z.number().min(0).max(1),
    lastUpdated: z.string(),
    totalPredictions: z.number().int().nonnegative(),
    correctPredictions: z.number().int().nonnegative(),
    avgConfidence: z.number().min(0).max(1),
    successRate: z.number().min(0).max(1),
  }),
  costPerToken: z.number().positive(),
  maxRequestsPerMinute: z.number().int().positive(),
});

// Model Performance Metrics
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

// AI Advice Response
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

export const AIAdviceSchema = z.object({
  advice: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2),
  processingTime: z.number().nonnegative(),
  fallbackUsed: z.boolean(),
  consensusScore: z.number().min(0).max(1).optional(),
});

// Consensus Advice Response
export interface ConsensusAdvice {
  primaryAdvice: string;
  confidence: number;
  agreement: number;
  models: string[];
  reasoning: string[];
  conflictFlags: string[];
}

export const ConsensusAdviceSchema = z.object({
  primaryAdvice: z.string(),
  confidence: z.number().min(0).max(1),
  agreement: z.number().min(0).max(1),
  models: z.array(z.string()),
  reasoning: z.array(z.string()),
  conflictFlags: z.array(z.string()),
});

// Market Context Types
export interface MarketContext {
  regime: 'bull' | 'bear' | 'sideways';
  volatility: number;
  sentiment: number;
  timeOfDay: 'market_hours' | 'evening' | 'overnight';
  dayOfWeek: string;
}

export const MarketContextSchema = z.object({
  regime: z.enum(['bull', 'bear', 'sideways']),
  volatility: z.number().min(0).max(1),
  sentiment: z.number().min(-1).max(1),
  timeOfDay: z.enum(['market_hours', 'evening', 'overnight']),
  dayOfWeek: z.string(),
});

// OpenAI Types
export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  maxRetries?: number;
  timeout?: number;
}

export const OpenAIConfigSchema = z.object({
  apiKey: z.string(),
  organization: z.string().optional(),
  maxRetries: z.number().int().positive().optional(),
  timeout: z.number().positive().optional(),
});

// Anthropic Types
export interface AnthropicConfig {
  apiKey: string;
  maxRetries?: number;
  timeout?: number;
}

export const AnthropicConfigSchema = z.object({
  apiKey: z.string(),
  maxRetries: z.number().int().positive().optional(),
  timeout: z.number().positive().optional(),
});

// Circuit Breaker Types
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenTimeout: number;
}

export const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().int().positive(),
  resetTimeout: z.number().positive(),
  halfOpenTimeout: z.number().positive(),
});

// Rate Limiter Types
export interface RateLimiterConfig {
  maxRequests: number;
  timeWindow: number;
  retryAfter: number;
}

export const RateLimiterConfigSchema = z.object({
  maxRequests: z.number().int().positive(),
  timeWindow: z.number().positive(),
  retryAfter: z.number().positive(),
});

// AI Service Error Types
export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly provider: AIProvider,
    public readonly model: string,
    public readonly retryable: boolean = true,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class RateLimitError extends AIServiceError {
  constructor(
    provider: AIProvider,
    model: string,
    public readonly retryAfter: number,
    context?: Record<string, unknown>
  ) {
    super(`Rate limit exceeded for ${provider} model ${model}`, provider, model, true, context);
    this.name = 'RateLimitError';
  }
}

export class CircuitBreakerError extends AIServiceError {
  constructor(
    provider: AIProvider,
    model: string,
    public readonly resetAfter: number,
    context?: Record<string, unknown>
  ) {
    super(`Circuit breaker open for ${provider} model ${model}`, provider, model, false, context);
    this.name = 'CircuitBreakerError';
  }
}

export class AIValidationError extends AIServiceError {
  constructor(
    provider: AIProvider,
    model: string,
    public readonly validationErrors: string[],
    context?: Record<string, unknown>
  ) {
    super(
      `Validation failed for ${provider} model ${model}: ${validationErrors.join(', ')}`,
      provider,
      model,
      false,
      context
    );
    this.name = 'AIValidationError';
  }
}

export class TimeoutError extends AIServiceError {
  constructor(
    provider: AIProvider,
    model: string,
    public readonly timeoutMs: number,
    context?: Record<string, unknown>
  ) {
    super(
      `Request timed out after ${timeoutMs}ms for ${provider} model ${model}`,
      provider,
      model,
      true,
      context
    );
    this.name = 'TimeoutError';
  }
}
