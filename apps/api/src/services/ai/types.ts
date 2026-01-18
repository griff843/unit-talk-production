/**
 * AI Assist Service Types
 * Phase 12: AI-powered analysis and insights
 */

export type AIProvider = 'openai' | 'anthropic';

export type AIModel =
  | 'gpt-4-turbo'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307';

export type AssistantType =
  | 'scoring_copilot'
  | 'insight_summarizer'
  | 'moderator_coach';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  provider?: AIProvider;
  model?: AIModel;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  tenantId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface AIResponse {
  id: string;
  content: string;
  model: string;
  provider: AIProvider;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost: number;
  latencyMs: number;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface AssistantRequest {
  type: AssistantType;
  input: string;
  context?: Record<string, unknown>;
  tenantId: string;
  userId?: string;
}

export interface AssistantResponse {
  type: AssistantType;
  output: string;
  confidence: number;
  aiResponse: AIResponse;
  metadata?: Record<string, unknown>;
}

export interface AIMetrics {
  requestsTotal: number;
  requestsCompleted: number;
  requestsFailed: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  errorRate: number;
  cacheHitRate: number;
  providerStats: Record<AIProvider, {
    requests: number;
    tokens: number;
    cost: number;
    avgLatency: number;
  }>;
}

export interface CircuitBreakerStatus {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}
