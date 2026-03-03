/**
 * AI Model Routing and Cost Control System
 * Provides intelligent model selection for different AI use cases with cost optimization
 */

import { createHash } from 'crypto';

export interface AIModelConfig {
  name: string;
  provider: 'openai' | 'anthropic' | 'moonshot' | 'other';
  costPerToken: number;
  maxTokens: number;
  quality: 'basic' | 'good' | 'premium' | 'elite';
  latency: 'fast' | 'medium' | 'slow';
}

export interface AIRequest {
  type: 'advice' | 'recap' | 'formatting';
  prompt: string;
  context?: Record<string, any>;
  metadata?: {
    propId?: string;
    odds?: number;
    line?: number;
    isMVP?: boolean;
  };
}

export interface AIResponse {
  content: string;
  model: string;
  provider: string;
  tokenCount: number;
  cost: number;
  cached: boolean;
  processingTime: number;
  quality: string;
}

export interface AIModelCallMetrics {
  model: string;
  provider: string;
  callCount: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  successRate: number;
  lastUsed: Date;
}

class AIModelRouter {
  private static instance: AIModelRouter;
  private callMetrics: Map<string, AIModelCallMetrics> = new Map();

  // Model configurations
  private readonly MODEL_CONFIGS: Record<string, AIModelConfig> = {
    'kimi-k2': {
      name: 'kimi-k2',
      provider: 'moonshot',
      costPerToken: 0.0000015, // Very cost-effective
      maxTokens: 4096,
      quality: 'good',
      latency: 'fast',
    },
    'claude-sonnet': {
      name: 'claude-sonnet',
      provider: 'anthropic',
      costPerToken: 0.000003, // Mid-range cost
      maxTokens: 8192,
      quality: 'premium',
      latency: 'medium',
    },
    'gpt-4-turbo': {
      name: 'gpt-4-turbo',
      provider: 'openai',
      costPerToken: 0.00001, // Premium cost
      maxTokens: 16384,
      quality: 'elite',
      latency: 'medium',
    },
    'gpt-3.5': {
      name: 'gpt-3.5',
      provider: 'openai',
      costPerToken: 0.0000005, // Very low cost
      maxTokens: 4096,
      quality: 'basic',
      latency: 'fast',
    },
  };

  private readonly ROUTING_RULES = {
    advice: {
      default: process.env.ADVICE_MODEL_DEFAULT || 'kimi-k2',
      fallback: process.env.ADVICE_MODEL_FALLBACK || 'claude-sonnet',
      mvp: process.env.ADVICE_MODEL_MVP || 'gpt-4-turbo',
    },
    recap: {
      default: 'kimi-k2',
      fallback: 'gpt-3.5',
    },
    formatting: {
      default: 'gpt-3.5',
      fallback: 'kimi-k2',
    },
  };

  private constructor() {
    this.initializeMetrics();
  }

  public static getInstance(): AIModelRouter {
    if (!AIModelRouter.instance) {
      AIModelRouter.instance = new AIModelRouter();
    }
    return AIModelRouter.instance;
  }

  /**
   * Route AI request to optimal model based on type and context
   */
  public routeRequest(request: AIRequest): string {
    const { type, metadata } = request;

    switch (type) {
      case 'advice':
        return this.routeAdviceRequest(metadata);
      case 'recap':
        return this.routeRecapRequest();
      case 'formatting':
        return this.routeFormattingRequest();
      default:
        throw new Error(`Unknown AI request type: ${type}`);
    }
  }

  /**
   * Route advice requests with MVP logic
   */
  private routeAdviceRequest(metadata?: AIRequest['metadata']): string {
    const rules = this.ROUTING_RULES.advice;

    // MVP path gets premium model
    if (metadata?.isMVP) {
      console.log(`🎯 MVP request detected, routing to ${rules.mvp}`);
      return rules.mvp;
    }

    // Default to cost-effective model
    return rules.default;
  }

  /**
   * Route recap requests (always kimi-k2 for cost efficiency)
   */
  private routeRecapRequest(): string {
    return this.ROUTING_RULES.recap.default;
  }

  /**
   * Route formatting requests (simple formatting = cheap model)
   */
  private routeFormattingRequest(): string {
    return this.ROUTING_RULES.formatting.default;
  }

  /**
   * Get fallback model for request type
   */
  public getFallbackModel(requestType: string): string {
    switch (requestType) {
      case 'advice':
        return this.ROUTING_RULES.advice.fallback;
      case 'recap':
        return this.ROUTING_RULES.recap.fallback;
      case 'formatting':
        return this.ROUTING_RULES.formatting.fallback;
      default:
        return 'gpt-3.5'; // Safe fallback
    }
  }

  /**
   * Execute AI request with model routing and fallback
   */
  public async executeRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const primaryModel = this.routeRequest(request);

    try {
      // Try primary model
      const response = await this.callModel(primaryModel, request);
      this.updateMetrics(primaryModel, response, true);
      return response;
    } catch (error) {
      console.warn(`⚠️ Primary model ${primaryModel} failed, falling back...`);

      // Try fallback model
      const fallbackModel = this.getFallbackModel(request.type);
      try {
        const response = await this.callModel(fallbackModel, request);
        this.updateMetrics(fallbackModel, response, true);
        return response;
      } catch (fallbackError) {
        console.error(`❌ Fallback model ${fallbackModel} also failed:`, fallbackError);
        this.updateMetrics(fallbackModel, null, false);
        throw new Error(
          `Both primary (${primaryModel}) and fallback (${fallbackModel}) models failed`
        );
      }
    }
  }

  /**
   * Call specific AI model
   */
  private async callModel(modelName: string, request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const config = this.MODEL_CONFIGS[modelName];

    if (!config) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    // Simulate model call (replace with actual API calls)
    const simulatedResponse = await this.simulateModelCall(config, request);
    const processingTime = Date.now() - startTime;

    return {
      content: simulatedResponse.content,
      model: modelName,
      provider: config.provider,
      tokenCount: simulatedResponse.tokenCount,
      cost: simulatedResponse.tokenCount * config.costPerToken,
      cached: false, // Will be set by cache layer
      processingTime,
      quality: config.quality,
    };
  }

  /**
   * Simulate model API call (replace with actual implementations)
   */
  private async simulateModelCall(
    config: AIModelConfig,
    request: AIRequest
  ): Promise<{ content: string; tokenCount: number }> {
    // Simulate network latency
    const delay = config.latency === 'fast' ? 100 : config.latency === 'medium' ? 300 : 500;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Generate appropriate response based on request type
    let content: string;
    let tokenCount: number;

    switch (request.type) {
      case 'advice':
        content = this.generateAdviceResponse(request, config);
        tokenCount = Math.floor(content.length / 4); // ~4 chars per token
        break;
      case 'recap':
        content = this.generateRecapResponse(request, config);
        tokenCount = Math.floor(content.length / 4);
        break;
      case 'formatting':
        content = this.generateFormattingResponse(request, config);
        tokenCount = Math.floor(content.length / 4);
        break;
      default:
        throw new Error(`Unsupported request type: ${request.type}`);
    }

    return { content, tokenCount };
  }

  /**
   * Generate advice response based on model quality
   */
  private generateAdviceResponse(request: AIRequest, config: AIModelConfig): string {
    const { metadata } = request;
    const propId = metadata?.propId || 'unknown';
    const odds = metadata?.odds || -110;
    const line = metadata?.line || 0;

    switch (config.quality) {
      case 'elite':
        return `🎯 ELITE ANALYSIS [${config.name}]: This ${propId} prop at ${odds} (line: ${line}) shows exceptional value based on advanced modeling. The professional-grade analysis indicates strong edge with optimal timing. Recommended position size aligns with Kelly criterion for maximum long-term growth.`;
      case 'premium':
        return `📊 PREMIUM INSIGHT [${config.name}]: Strong opportunity on ${propId} with current odds ${odds}. Line value analysis suggests favorable positioning. Quality metrics indicate above-average confidence level for this selection.`;
      case 'good':
        return `✓ ANALYSIS [${config.name}]: ${propId} at ${odds} shows positive indicators. Standard analysis suggests reasonable value proposition for consideration.`;
      case 'basic':
        return `• ${propId}: ${odds} odds, line ${line}. Basic analysis complete.`;
      default:
        return `Analysis for ${propId} completed.`;
    }
  }

  /**
   * Generate recap response
   */
  private generateRecapResponse(request: AIRequest, config: AIModelConfig): string {
    return `📈 DAILY RECAP [${config.name}]: Today's performance summary with key metrics, notable plays, and strategic insights for tomorrow's opportunities.`;
  }

  /**
   * Generate formatting response
   */
  private generateFormattingResponse(request: AIRequest, config: AIModelConfig): string {
    return `Formatted output [${config.name}]: Clean, structured presentation of the provided content.`;
  }

  /**
   * Update model call metrics
   */
  private updateMetrics(modelName: string, response: AIResponse | null, success: boolean): void {
    const key = modelName;
    const existing = this.callMetrics.get(key) || {
      model: modelName,
      provider: this.MODEL_CONFIGS[modelName]?.provider || 'unknown',
      callCount: 0,
      totalTokens: 0,
      totalCost: 0,
      averageLatency: 0,
      successRate: 0,
      lastUsed: new Date(),
    };

    existing.callCount++;
    existing.lastUsed = new Date();

    if (success && response) {
      existing.totalTokens += response.tokenCount;
      existing.totalCost += response.cost;
      existing.averageLatency = (existing.averageLatency + response.processingTime) / 2;
    }

    // Calculate success rate
    const successCount = existing.callCount * existing.successRate + (success ? 1 : 0);
    existing.successRate = successCount / existing.callCount;

    this.callMetrics.set(key, existing);
  }

  /**
   * Get model call metrics
   */
  public getMetrics(): AIModelCallMetrics[] {
    return Array.from(this.callMetrics.values());
  }

  /**
   * Get cache hit rate and cost savings
   */
  public getCostAnalysis(): {
    totalCalls: number;
    totalCost: number;
    totalTokens: number;
    averageCostPerCall: number;
    modelBreakdown: Record<string, { calls: number; cost: number; percentage: number }>;
  } {
    const metrics = this.getMetrics();
    const totalCalls = metrics.reduce((sum, m) => sum + m.callCount, 0);
    const totalCost = metrics.reduce((sum, m) => sum + m.totalCost, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + m.totalTokens, 0);

    const modelBreakdown: Record<string, { calls: number; cost: number; percentage: number }> = {};
    metrics.forEach(m => {
      modelBreakdown[m.model] = {
        calls: m.callCount,
        cost: m.totalCost,
        percentage: totalCost > 0 ? (m.totalCost / totalCost) * 100 : 0,
      };
    });

    return {
      totalCalls,
      totalCost,
      totalTokens,
      averageCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0,
      modelBreakdown,
    };
  }

  /**
   * Generate context hash for caching
   */
  public generateContextHash(context: Record<string, any>): string {
    const sortedKeys = Object.keys(context).sort();
    const hashInput = sortedKeys.map(key => `${key}:${context[key]}`).join('|');
    return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  /**
   * Calculate basis points difference between odds
   */
  public calculateOddsBpsDifference(currentOdds: number, lastOdds: number): number {
    if (lastOdds === 0) return Infinity;
    const difference = Math.abs(currentOdds - lastOdds);
    return (difference / Math.abs(lastOdds)) * 10000; // Convert to basis points
  }

  /**
   * Check if re-query is needed based on odds movement
   */
  public shouldRequery(
    currentOdds: number,
    lastOdds: number,
    contextHash: string,
    lastContextHash: string
  ): boolean {
    const bpsThreshold = parseInt(process.env.ADVICE_REQUERY_BPS || '15');
    const oddsBps = this.calculateOddsBpsDifference(currentOdds, lastOdds);
    const contextChanged = contextHash !== lastContextHash;

    return oddsBps >= bpsThreshold || contextChanged;
  }

  /**
   * Initialize metrics tracking
   */
  private initializeMetrics(): void {
    // Initialize metrics for all configured models
    Object.keys(this.MODEL_CONFIGS).forEach(modelName => {
      this.callMetrics.set(modelName, {
        model: modelName,
        provider: this.MODEL_CONFIGS[modelName].provider,
        callCount: 0,
        totalTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        successRate: 1.0,
        lastUsed: new Date(),
      });
    });
  }

  /**
   * Log metrics for monitoring
   */
  public logMetrics(): void {
    const analysis = this.getCostAnalysis();

    console.log('🤖 AI MODEL ROUTING METRICS');
    console.log('============================');
    console.log(`Total Calls: ${analysis.totalCalls}`);
    console.log(`Total Cost: $${analysis.totalCost.toFixed(4)}`);
    console.log(`Average Cost/Call: $${analysis.averageCostPerCall.toFixed(4)}`);
    console.log(`Total Tokens: ${analysis.totalTokens.toLocaleString()}`);

    console.log('\n📊 Model Breakdown:');
    Object.entries(analysis.modelBreakdown).forEach(([model, stats]) => {
      console.log(
        `  ${model}: ${stats.calls} calls ($${stats.cost.toFixed(4)}, ${stats.percentage.toFixed(1)}%)`
      );
    });

    const metrics = this.getMetrics();
    console.log('\n⚡ Performance Metrics:');
    metrics.forEach(m => {
      console.log(
        `  ${m.model}: ${(m.successRate * 100).toFixed(1)}% success, ${m.averageLatency.toFixed(0)}ms avg`
      );
    });
  }
}

// Export singleton instance
export const aiModelRouter = AIModelRouter.getInstance();
