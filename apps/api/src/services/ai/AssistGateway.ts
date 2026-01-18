/**
 * AI Assist Gateway
 * Phase 12: Multi-provider AI routing with observability
 *
 * Routes AI requests to OpenAI or Anthropic based on configuration
 * Provides circuit breaker protection, cost tracking, and metrics
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../shared/logger';
import type {
  AIProvider,
  AIModel,
  AIRequest,
  AIResponse,
  AIMetrics,
  CircuitBreakerStatus,
} from './types';

// Pricing per 1K tokens (as of 2025)
const MODEL_PRICING: Record<AIModel, { prompt: number; completion: number }> = {
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  'claude-3-opus-20240229': { prompt: 0.015, completion: 0.075 },
  'claude-3-sonnet-20240229': { prompt: 0.003, completion: 0.015 },
  'claude-3-haiku-20240307': { prompt: 0.00025, completion: 0.00125 },
};

interface CircuitBreaker {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold: number;
}

export class AssistGateway {
  private openaiApiKey: string;
  private anthropicApiKey: string;
  private defaultProvider: AIProvider;
  private defaultModel: AIModel;
  private supabase: SupabaseClient;

  // Circuit breakers per provider
  private circuitBreakers: Map<AIProvider, CircuitBreaker>;

  // Metrics tracking
  private metrics: {
    requests: number;
    successes: number;
    failures: number;
    totalLatencyMs: number;
    totalTokens: number;
    totalCost: number;
    cacheHits: number;
    cacheMisses: number;
    providerMetrics: Map<AIProvider, {
      requests: number;
      tokens: number;
      cost: number;
      latencyMs: number;
    }>;
  };

  constructor(config: {
    openaiApiKey: string;
    anthropicApiKey: string;
    defaultProvider?: AIProvider;
    defaultModel?: AIModel;
    supabase: SupabaseClient;
  }) {
    this.openaiApiKey = config.openaiApiKey;
    this.anthropicApiKey = config.anthropicApiKey;
    this.defaultProvider = config.defaultProvider || 'openai';
    this.defaultModel = config.defaultModel || 'gpt-4-turbo';
    this.supabase = config.supabase;

    // Initialize circuit breakers
    this.circuitBreakers = new Map([
      ['openai', this.createCircuitBreaker()],
      ['anthropic', this.createCircuitBreaker()],
    ]);

    // Initialize metrics
    this.metrics = {
      requests: 0,
      successes: 0,
      failures: 0,
      totalLatencyMs: 0,
      totalTokens: 0,
      totalCost: 0,
      cacheHits: 0,
      cacheMisses: 0,
      providerMetrics: new Map([
        ['openai', { requests: 0, tokens: 0, cost: 0, latencyMs: 0 }],
        ['anthropic', { requests: 0, tokens: 0, cost: 0, latencyMs: 0 }],
      ]),
    };

    logger.info('AssistGateway initialized', {
      defaultProvider: this.defaultProvider,
      defaultModel: this.defaultModel,
    });
  }

  /**
   * Process AI request with automatic provider routing and circuit breaker protection
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const provider = request.provider || this.defaultProvider;
    const model = request.model || this.defaultModel;

    this.metrics.requests++;

    try {
      // Check circuit breaker
      if (!this.isCircuitBreakerAllowed(provider)) {
        throw new Error(`Circuit breaker OPEN for provider: ${provider}`);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cachedResult = await this.getCachedResponse(request.tenantId, cacheKey);

      if (cachedResult) {
        this.metrics.cacheHits++;
        logger.info('AI cache hit', { cacheKey, provider, model });

        return {
          ...cachedResult,
          latencyMs: Date.now() - startTime,
        };
      }

      this.metrics.cacheMisses++;

      // Route to appropriate provider
      let response: AIResponse;
      if (provider === 'openai') {
        response = await this.callOpenAI(request, model);
      } else {
        response = await this.callAnthropic(request, model);
      }

      // Update metrics
      this.updateMetrics(provider, response);

      // Record circuit breaker success
      this.recordCircuitBreakerSuccess(provider);

      // Cache the response
      await this.cacheResponse(request.tenantId, cacheKey, response);

      // Log to database
      await this.logRequest(request, response);

      // Update user quota
      if (request.userId) {
        await this.updateUserQuota(request.userId, response.tokensUsed.total);
      }

      logger.info('AI request completed', {
        provider,
        model,
        latencyMs: response.latencyMs,
        tokens: response.tokensUsed.total,
        cost: response.cost,
      });

      this.metrics.successes++;
      return response;

    } catch (error) {
      this.metrics.failures++;
      this.recordCircuitBreakerFailure(provider);

      logger.error('AI request failed', {
        provider,
        model,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startTime,
      });

      // Log failed request
      await this.logFailedRequest(request, error);

      throw error;
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(request: AIRequest, model: AIModel): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      const tokensUsed = {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      };

      const cost = this.calculateCost(model, tokensUsed);

      return {
        id: data.id,
        content: data.choices[0]?.message?.content || '',
        model: data.model,
        provider: 'openai',
        tokensUsed,
        cost,
        latencyMs,
        metadata: {
          finishReason: data.choices[0]?.finish_reason,
        },
      };
    } catch (error) {
      logger.error('OpenAI API call failed', {
        error: error instanceof Error ? error.message : String(error),
        model,
      });
      throw error;
    }
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(request: AIRequest, model: AIModel): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Convert messages format for Anthropic
      const systemMessage = request.messages.find(m => m.role === 'system');
      const conversationMessages = request.messages.filter(m => m.role !== 'system');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 2000,
          system: systemMessage?.content,
          messages: conversationMessages,
          temperature: request.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      const tokensUsed = {
        prompt: data.usage?.input_tokens || 0,
        completion: data.usage?.output_tokens || 0,
        total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      };

      const cost = this.calculateCost(model, tokensUsed);

      return {
        id: data.id,
        content: data.content[0]?.text || '',
        model: data.model,
        provider: 'anthropic',
        tokensUsed,
        cost,
        latencyMs,
        metadata: {
          stopReason: data.stop_reason,
        },
      };
    } catch (error) {
      logger.error('Anthropic API call failed', {
        error: error instanceof Error ? error.message : String(error),
        model,
      });
      throw error;
    }
  }

  /**
   * Calculate cost based on token usage and model pricing
   */
  private calculateCost(model: AIModel, tokens: { prompt: number; completion: number }): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      logger.warn('Unknown model pricing', { model });
      return 0;
    }

    const promptCost = (tokens.prompt / 1000) * pricing.prompt;
    const completionCost = (tokens.completion / 1000) * pricing.completion;

    return promptCost + completionCost;
  }

  /**
   * Generate cache key from request
   */
  private generateCacheKey(request: AIRequest): string {
    const content = JSON.stringify({
      messages: request.messages,
      model: request.model || this.defaultModel,
      temperature: request.temperature ?? 0.7,
    });

    // Simple hash function (use crypto.subtle.digest in production)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `ai_cache_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get cached response
   */
  private async getCachedResponse(tenantId: string, cacheKey: string): Promise<AIResponse | null> {
    try {
      const { data, error } = await this.supabase
        .from('ai_assist_analysis_cache')
        .select('analysis_result')
        .eq('tenant_id', tenantId)
        .eq('cache_key', cacheKey)
        .gt('cache_expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      return data.analysis_result as AIResponse;
    } catch (error) {
      logger.warn('Cache lookup failed', { error, cacheKey });
      return null;
    }
  }

  /**
   * Cache response
   */
  private async cacheResponse(tenantId: string, cacheKey: string, response: AIResponse): Promise<void> {
    try {
      const cacheExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.supabase
        .from('ai_assist_analysis_cache')
        .upsert({
          tenant_id: tenantId,
          cache_key: cacheKey,
          entity_type: 'ai_request',
          entity_id: response.id,
          analysis_type: 'ai_response',
          analysis_result: response,
          cache_expires_at: cacheExpiresAt.toISOString(),
          access_count: 1,
        });
    } catch (error) {
      logger.warn('Cache storage failed', { error, cacheKey });
    }
  }

  /**
   * Log request to database
   */
  private async logRequest(request: AIRequest, response: AIResponse): Promise<void> {
    try {
      await this.supabase
        .from('ai_logs')
        .insert({
          tenant_id: request.tenantId,
          user_id: request.userId || null,
          request_type: 'general_query',
          model: response.model,
          provider: response.provider,
          prompt: JSON.stringify(request.messages),
          response: response.content,
          tokens_used: response.tokensUsed.total,
          cost_dollars: response.cost,
          latency_ms: response.latencyMs,
          confidence: response.confidence,
          status: 'completed',
          metadata: { ...request.metadata, ...response.metadata },
          completed_at: new Date().toISOString(),
        });
    } catch (error) {
      logger.error('Failed to log AI request', { error });
    }
  }

  /**
   * Log failed request
   */
  private async logFailedRequest(request: AIRequest, error: unknown): Promise<void> {
    try {
      await this.supabase
        .from('ai_logs')
        .insert({
          tenant_id: request.tenantId,
          user_id: request.userId || null,
          request_type: 'general_query',
          model: request.model || this.defaultModel,
          provider: request.provider || this.defaultProvider,
          prompt: JSON.stringify(request.messages),
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
          metadata: request.metadata,
        });
    } catch (logError) {
      logger.error('Failed to log failed request', { logError });
    }
  }

  /**
   * Update user quota
   */
  private async updateUserQuota(userId: string, tokens: number): Promise<void> {
    try {
      await this.supabase.rpc('increment_ai_quota', {
        p_user_id: userId,
        p_tokens: tokens,
        p_request_count: 1,
      });
    } catch (error) {
      logger.error('Failed to update user quota', { error, userId, tokens });
    }
  }

  /**
   * Circuit breaker management
   */
  private createCircuitBreaker(): CircuitBreaker {
    return {
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      failureThreshold: 5,
      resetTimeoutMs: 60000, // 1 minute
      halfOpenSuccessThreshold: 2,
    };
  }

  private isCircuitBreakerAllowed(provider: AIProvider): boolean {
    const breaker = this.circuitBreakers.get(provider);
    if (!breaker) return true;

    const now = Date.now();

    if (breaker.state === 'OPEN') {
      if (now - breaker.lastFailureTime >= breaker.resetTimeoutMs) {
        breaker.state = 'HALF_OPEN';
        breaker.successCount = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN', { provider });
        return true;
      }
      return false;
    }

    return true;
  }

  private recordCircuitBreakerSuccess(provider: AIProvider): void {
    const breaker = this.circuitBreakers.get(provider);
    if (!breaker) return;

    if (breaker.state === 'HALF_OPEN') {
      breaker.successCount++;
      if (breaker.successCount >= breaker.halfOpenSuccessThreshold) {
        breaker.state = 'CLOSED';
        breaker.failureCount = 0;
        logger.info('Circuit breaker CLOSED', { provider });
      }
    } else if (breaker.state === 'CLOSED') {
      breaker.failureCount = Math.max(0, breaker.failureCount - 1);
    }
  }

  private recordCircuitBreakerFailure(provider: AIProvider): void {
    const breaker = this.circuitBreakers.get(provider);
    if (!breaker) return;

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.state === 'HALF_OPEN') {
      breaker.state = 'OPEN';
      logger.warn('Circuit breaker OPEN (from HALF_OPEN)', { provider });
    } else if (breaker.failureCount >= breaker.failureThreshold) {
      breaker.state = 'OPEN';
      logger.warn('Circuit breaker OPEN (threshold reached)', {
        provider,
        failureCount: breaker.failureCount,
      });
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(provider: AIProvider): CircuitBreakerStatus {
    const breaker = this.circuitBreakers.get(provider);
    if (!breaker) {
      return {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
      };
    }

    return {
      state: breaker.state,
      failureCount: breaker.failureCount,
      successCount: breaker.successCount,
      lastFailureTime: breaker.lastFailureTime > 0 ? new Date(breaker.lastFailureTime) : undefined,
      nextRetryTime: breaker.state === 'OPEN'
        ? new Date(breaker.lastFailureTime + breaker.resetTimeoutMs)
        : undefined,
    };
  }

  /**
   * Update metrics
   */
  private updateMetrics(provider: AIProvider, response: AIResponse): void {
    this.metrics.totalLatencyMs += response.latencyMs;
    this.metrics.totalTokens += response.tokensUsed.total;
    this.metrics.totalCost += response.cost;

    const providerMetrics = this.metrics.providerMetrics.get(provider);
    if (providerMetrics) {
      providerMetrics.requests++;
      providerMetrics.tokens += response.tokensUsed.total;
      providerMetrics.cost += response.cost;
      providerMetrics.latencyMs += response.latencyMs;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): AIMetrics {
    const errorRate = this.metrics.requests > 0
      ? this.metrics.failures / this.metrics.requests
      : 0;

    const cacheHitRate = (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
      ? this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)
      : 0;

    const avgLatencyMs = this.metrics.requests > 0
      ? this.metrics.totalLatencyMs / this.metrics.requests
      : 0;

    const providerStats: Record<AIProvider, any> = {
      openai: {
        requests: 0,
        tokens: 0,
        cost: 0,
        avgLatency: 0,
      },
      anthropic: {
        requests: 0,
        tokens: 0,
        cost: 0,
        avgLatency: 0,
      },
    };

    for (const [provider, metrics] of this.metrics.providerMetrics.entries()) {
      providerStats[provider] = {
        requests: metrics.requests,
        tokens: metrics.tokens,
        cost: metrics.cost,
        avgLatency: metrics.requests > 0 ? metrics.latencyMs / metrics.requests : 0,
      };
    }

    return {
      requestsTotal: this.metrics.requests,
      requestsCompleted: this.metrics.successes,
      requestsFailed: this.metrics.failures,
      avgLatencyMs,
      totalTokens: this.metrics.totalTokens,
      totalCost: this.metrics.totalCost,
      errorRate,
      cacheHitRate,
      providerStats,
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      requests: 0,
      successes: 0,
      failures: 0,
      totalLatencyMs: 0,
      totalTokens: 0,
      totalCost: 0,
      cacheHits: 0,
      cacheMisses: 0,
      providerMetrics: new Map([
        ['openai', { requests: 0, tokens: 0, cost: 0, latencyMs: 0 }],
        ['anthropic', { requests: 0, tokens: 0, cost: 0, latencyMs: 0 }],
      ]),
    };
  }
}
