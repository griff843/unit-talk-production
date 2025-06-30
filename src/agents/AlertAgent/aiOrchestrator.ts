import OpenAI from 'openai';
import { FinalPick } from '../../types/picks';
import { logger } from '../../services/logging';
import { env } from '../../config/env';

// Enhanced model configuration with performance tracking
interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  priority: number;
  performance: ModelPerformance;
  costPerToken: number;
  maxRequestsPerMinute: number;
}

interface ModelPerformance {
  accuracy: number;
  avgLatency: number;
  errorRate: number;
  lastUpdated: string;
  totalPredictions: number;
  correctPredictions: number;
  avgConfidence: number;
  successRate: number;
}

interface AIAdvice {
  advice: string;
  confidence: number;
  reasoning: string;
  model: string;
  temperature: number;
  processingTime: number;
  fallbackUsed: boolean;
  consensusScore?: number;
}

interface MarketContext {
  regime: 'bull' | 'bear' | 'sideways';
  volatility: number;
  sentiment: number;
  timeOfDay: string;
  dayOfWeek: string;
  marketPressure: number;
  lineMovement: number;
}

interface ConsensusAdvice {
  primaryAdvice: string;
  confidence: number;
  agreement: number;
  models: string[];
  reasoning: string[];
  conflictFlags: string[];
}

// Circuit breaker for handling model failures
class CircuitBreaker {
  private failures: Map<string, number> = new Map();
  private lastFailure: Map<string, number> = new Map();
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 60000; // 1 minute

  isOpen(modelId: string): boolean {
    const failures = this.failures.get(modelId) || 0;
    const lastFailure = this.lastFailure.get(modelId) || 0;
    
    if (failures >= this.failureThreshold) {
      if (Date.now() - lastFailure > this.resetTimeout) {
        this.reset(modelId);
        return false;
      }
      return true;
    }
    return false;
  }

  recordFailure(modelId: string): void {
    const current = this.failures.get(modelId) || 0;
    this.failures.set(modelId, current + 1);
    this.lastFailure.set(modelId, Date.now());
  }

  recordSuccess(modelId: string): void {
    this.failures.set(modelId, 0);
  }

  reset(modelId: string): void {
    this.failures.set(modelId, 0);
    this.lastFailure.delete(modelId);
  }
}

export class AIOrchestrator {
  private models: Map<string, ModelConfig> = new Map();
  private openai: OpenAI;
  // private anthropic: Anthropic; // TODO: Uncomment when @anthropic-ai/sdk is installed
  private performanceCache: Map<string, ModelPerformance> = new Map();
  private circuitBreaker: CircuitBreaker = new CircuitBreaker();
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();


  constructor() {
    // Handle missing API keys gracefully for testing
    const openaiApiKey = env.OPENAI_API_KEY || 'test-key-for-testing';

    this.openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // TODO: Uncomment when @anthropic-ai/sdk is installed
    // this.anthropic = new Anthropic({
    //   apiKey: process.env.ANTHROPIC_API_KEY!,
    // });

    this.initializeModels();
  }

  private initializeModels(): void {
    // GPT-4 Turbo Configuration (Primary)
    this.models.set('gpt-4-turbo', {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      maxTokens: 1000,
      enabled: true,
      priority: 1,
      costPerToken: 0.00003,
      maxRequestsPerMinute: 500,
      performance: {
        accuracy: 0.78,
        avgLatency: 2200,
        errorRate: 0.015,
        lastUpdated: new Date().toISOString(),
        totalPredictions: 0,
        correctPredictions: 0,
        avgConfidence: 0.72,
        successRate: 0.985
      }
    });

    // GPT-4 Configuration (Fallback)
    this.models.set('gpt-4', {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 1000,
      enabled: true,
      priority: 2,
      costPerToken: 0.00006,
      maxRequestsPerMinute: 200,
      performance: {
        accuracy: 0.75,
        avgLatency: 3500,
        errorRate: 0.02,
        lastUpdated: new Date().toISOString(),
        totalPredictions: 0,
        correctPredictions: 0,
        avgConfidence: 0.70,
        successRate: 0.98
      }
    });

    // GPT-3.5 Turbo Configuration (Fast fallback)
    this.models.set('gpt-3.5-turbo', {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.4,
      maxTokens: 800,
      enabled: true,
      priority: 3,
      costPerToken: 0.000002,
      maxRequestsPerMinute: 3500,
      performance: {
        accuracy: 0.65,
        avgLatency: 800,
        errorRate: 0.03,
        lastUpdated: new Date().toISOString(),
        totalPredictions: 0,
        correctPredictions: 0,
        avgConfidence: 0.62,
        successRate: 0.97
      }
    });

    // TODO: Add Claude-3 when SDK is available
    // this.models.set('claude-3-sonnet', {
    //   id: 'claude-3-sonnet',
    //   name: 'Claude-3 Sonnet',
    //   provider: 'anthropic',
    //   model: 'claude-3-sonnet-20240229',
    //   temperature: 0.4,
    //   maxTokens: 1000,
    //   enabled: true,
    //   priority: 2,
    //   costPerToken: 0.000015,
    //   maxRequestsPerMinute: 1000,
    //   performance: {
    //     accuracy: 0.73,
    //     avgLatency: 2000,
    //     errorRate: 0.025,
    //     lastUpdated: new Date().toISOString(),
    //     totalPredictions: 0,
    //     correctPredictions: 0,
    //     avgConfidence: 0.68,
    //     successRate: 0.975
    //   }
    // });
  }

  // Main entry point for getting AI advice
  async getAdviceForPick(pick: FinalPick, _context?: MarketContext): Promise<AIAdvice> {
    const startTime = Date.now();

    try {
      // Select optimal model based on context and performance
      // Pass only the pick argument as selectOptimalModel expects one argument
      const selectedModel = await this.selectOptimalModel(pick);

      if (!selectedModel) {
        throw new Error('No available models for advice generation');
      }

      // Check rate limits
      if (!this.checkRateLimit(selectedModel.id)) {
        logger.warn(`Rate limit exceeded for model ${selectedModel.id}, using fallback`);
        return this.getFallbackAdvice(pick);
      }

      // Generate advice with selected model
      const advice = await this.queryModel(selectedModel, pick);

      // Update performance metrics
      this.updateModelPerformance(selectedModel.id, true, Date.now() - startTime);

      return advice;
    } catch (error) {
      logger.error('Primary advice generation failed, using fallback:', error);
      return this.getFallbackAdvice(pick);
    }
  }

  // Multi-model consensus for high-stakes decisions
  async getConsensusAdvice(pick: FinalPick): Promise<ConsensusAdvice> {
    const availableModels = this.getAvailableModels();
    const responses: AIAdvice[] = [];
    const errors: string[] = [];

    // Query multiple models in parallel
    const promises = availableModels.slice(0, 3).map(async (model) => {
      try {
        if (this.circuitBreaker.isOpen(model.id)) {
          throw new Error(`Circuit breaker open for ${model.id}`);
        }
        return await this.queryModel(model, pick);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${model.id}: ${errorMessage}`);
        this.circuitBreaker.recordFailure(model.id);
        return null;
      }
    });

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        responses.push(result.value);
        const model = availableModels[index];
        if (model) {
          this.circuitBreaker.recordSuccess(model.id);
        }
      }
    });

    if (responses.length === 0) {
      throw new Error('All models failed to generate advice');
    }

    return this.aggregateResponses(responses);
  }

  private async selectOptimalModel(pick: FinalPick): Promise<ModelConfig | null> {
    const availableModels = this.getAvailableModels();

    if (availableModels.length === 0) {
      return null;
    }

    // Score models based on multiple factors
    const scoredModels = availableModels.map(model => ({
      model,
      score: this.calculateModelScore(model, pick)
    }));

    // Sort by score (highest first)
    scoredModels.sort((a, b) => b.score - a.score);

    return scoredModels.length > 0 ? scoredModels[0]?.model || null : null;
  }

  private calculateModelScore(model: ModelConfig, pick: FinalPick): number {
    let score = 0;

    // Base performance score (40% weight)
    score += model.performance.accuracy * 0.4;

    // Latency score (20% weight) - lower is better
    const latencyScore = Math.max(0, 1 - (model.performance.avgLatency / 5000));
    score += latencyScore * 0.2;

    // Error rate score (20% weight) - lower is better
    const errorScore = Math.max(0, 1 - model.performance.errorRate);
    score += errorScore * 0.2;

    // Success rate score (10% weight)
    score += model.performance.successRate * 0.1;

    // Cost efficiency (10% weight) - lower cost is better for similar performance
    const costScore = Math.max(0, 1 - (model.costPerToken / 0.0001));
    score += costScore * 0.1;

    // Tier-specific adjustments
    if (pick.tier === 'S' || pick.tier === 'A') {
      // High-tier picks get the most accurate model
      score += model.performance.accuracy * 0.15;
    }

    return score;
  }

  public getAvailableModels(): ModelConfig[] {
    return Array.from(this.models.values())
      .filter(model =>
        model.enabled &&
        !this.circuitBreaker.isOpen(model.id) &&
        this.checkRateLimit(model.id)
      )
      .sort((a, b) => a.priority - b.priority);
  }

  private checkRateLimit(modelId: string): boolean {
    const model = this.models.get(modelId);
    if (!model) return false;

    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const key = `${modelId}-${minute}`;

    const current = this.requestCounts.get(key) || { count: 0, resetTime: now + 60000 };

    if (current.count >= model.maxRequestsPerMinute) {
      return false;
    }

    this.requestCounts.set(key, { ...current, count: current.count + 1 });
    return true;
  }

  private async queryModel(model: ModelConfig, pick: FinalPick): Promise<AIAdvice> {
    const startTime = Date.now();
    const temperature = this.adjustTemperature(model, pick);
    const prompt = this.buildPrompt(pick);

    let response: string;

    try {
      if (model.provider === 'openai') {
        const completion = await this.openai.chat.completions.create({
          model: model.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature,
          max_tokens: model.maxTokens
        }, {
          timeout: 30000 // 30 second timeout
        });

        response = completion.choices[0]?.message?.content || 'No response generated';
      } else if (model.provider === 'anthropic') {
        // TODO: Implement Anthropic integration when SDK is available
        throw new Error('Anthropic integration not yet implemented - SDK not installed');
      } else {
        throw new Error(`Unsupported provider: ${model.provider}`);
      }

      const processingTime = Date.now() - startTime;

      return this.parseAdviceResponse(response, model.id, temperature, processingTime);
    } catch (error) {
      this.circuitBreaker.recordFailure(model.id);
      throw error;
    }
  }

  private getSystemPrompt(): string {
    return `You are an elite sports betting advisor with deep expertise in market analysis, player performance, and risk management.

Your role is to provide actionable betting advice based on comprehensive analysis of:
- Player statistics and recent performance trends
- Market conditions and line movement
- Historical patterns and edge opportunities
- Risk factors and bankroll management

Always provide:
1. Clear recommendation (HOLD, HEDGE, or FADE)
2. Confidence level (0-100)
3. Detailed reasoning
4. Risk assessment
5. Specific action items

Be concise but thorough. Focus on actionable insights that can improve betting outcomes.`;
  }

  private buildPrompt(pick: FinalPick): string {
    const basePrompt = `
BETTING ANALYSIS REQUEST

Pick Details:
- Player: ${pick.player_name}
- Market: ${pick.market_type}
- Line: ${pick.line}
- Odds: ${pick.odds}
- Tier: ${pick.tier || 'Ungraded'}
- Edge Score: ${pick.edge_score || 'N/A'}
- Sharp Fade: ${pick.is_sharp_fade ? 'YES' : 'NO'}
- Tags: ${Array.isArray(pick.tags) ? pick.tags.join(', ') : 'None'}
`;

    return basePrompt + `
Please provide your analysis and recommendation in the following format:

**RECOMMENDATION**: [HOLD/HEDGE/FADE]
**CONFIDENCE**: [0-100]
**REASONING**: [Detailed analysis]
**RISK FACTORS**: [Key risks to consider]
**ACTION**: [Specific next steps]
`;
  }

  private adjustTemperature(model: ModelConfig, pick: FinalPick): number {
    let temperature = model.temperature;

    // Lower temperature for high-tier picks (more conservative)
    if (pick.tier === 'S' || pick.tier === 'A') {
      temperature *= 0.8;
    }

    // Ensure temperature stays within reasonable bounds
    return Math.max(0.1, Math.min(1.0, temperature));
  }

  private parseAdviceResponse(response: string, modelId: string, temperature: number, processingTime: number): AIAdvice {
    // Extract recommendation
    const recommendationMatch = response.match(/\*\*RECOMMENDATION\*\*:\s*([A-Z]+)/i);
    const recommendation = recommendationMatch ? recommendationMatch[1] : 'HOLD';
    
    // Extract confidence
    const confidenceMatch = response.match(/\*\*CONFIDENCE\*\*:\s*(\d+)/);
    const confidence = confidenceMatch?.[1] ? parseInt(confidenceMatch[1]) / 100 : 0.5;
    
    // Extract reasoning
    const reasoningMatch = response.match(/\*\*REASONING\*\*:\s*([^*]+)/);
    const reasoning = reasoningMatch?.[1]?.trim() || 'No detailed reasoning provided';
    
    return {
      advice: `**${recommendation}** - ${reasoning}`,
      confidence,
      reasoning,
      model: modelId,
      temperature,
      processingTime,
      fallbackUsed: false
    };
  }

  private async getFallbackAdvice(pick: FinalPick): Promise<AIAdvice> {
    // Rule-based fallback when AI is unavailable
    let advice = '';
    let confidence = 0.3;

    if (pick.is_sharp_fade) {
      advice = '**FADE** - Sharp money indicates line movement against this pick. Consider fading or avoiding.';
      confidence = 0.6;
    } else if (pick.tier === 'S' || pick.tier === 'A') {
      advice = '**HOLD** - High-tier pick with strong edge score. Monitor for optimal entry timing.';
      confidence = 0.5;
    } else if (pick.edge_score && pick.edge_score < 10) {
      advice = '**HEDGE** - Low edge score suggests limited value. Consider hedging or reducing position size.';
      confidence = 0.4;
    } else {
      advice = '**HOLD** - Standard pick with moderate edge. Follow your bankroll management rules.';
      confidence = 0.3;
    }

    return {
      advice,
      confidence,
      reasoning: 'Generated using rule-based fallback due to AI service unavailability',
      model: 'fallback-rules',
      temperature: 0,
      processingTime: 0,
      fallbackUsed: true
    };
  }

  private aggregateResponses(responses: AIAdvice[]): ConsensusAdvice {
    if (responses.length === 0) {
      throw new Error('No responses to aggregate');
    }

    if (responses.length === 1) {
      const response = responses[0];
      if (!response) {
        throw new Error('Invalid response in array');
      }
      return {
        primaryAdvice: response.advice,
        confidence: response.confidence,
        agreement: 1.0,
        models: [response.model],
        reasoning: [response.reasoning],
        conflictFlags: []
      };
    }

    // Extract recommendations
    const recommendations = responses.map(r => {
      const match = r.advice.match(/\*\*([A-Z]+)\*\*/);
      return match ? match[1] : 'HOLD';
    });

    // Calculate agreement
    const recommendationCounts = recommendations.reduce((acc, rec) => {
      if (rec) {
        acc[rec] = (acc[rec] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const mostCommon = Object.entries(recommendationCounts)
      .sort(([,a], [,b]) => b - a)[0];

    if (!mostCommon) {
      throw new Error('Unable to determine consensus recommendation');
    }

    const agreement = mostCommon[1] / responses.length;
    
    // Calculate weighted confidence
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    
    // Identify conflicts
    const conflictFlags: string[] = [];
    if (agreement < 0.6) {
      conflictFlags.push('LOW_CONSENSUS');
    }
    
    const confidenceRange = Math.max(...responses.map(r => r.confidence)) - 
                           Math.min(...responses.map(r => r.confidence));
    if (confidenceRange > 0.4) {
      conflictFlags.push('HIGH_CONFIDENCE_VARIANCE');
    }

    return {
      primaryAdvice: mostCommon ? `**${mostCommon[0]}** - Consensus recommendation from ${responses.length} models` : '',
      confidence: avgConfidence * agreement, // Reduce confidence if low agreement
      agreement,
      models: responses.map(r => r.model),
      reasoning: responses.map(r => r.reasoning),
      conflictFlags
    };
  }

  private updateModelPerformance(modelId: string, success: boolean, latency: number): void {
    const model = this.models.get(modelId);
    if (!model) return;

    const perf = model.performance;
    perf.totalPredictions++;
    
    if (success) {
      perf.correctPredictions++;
      this.circuitBreaker.recordSuccess(modelId);
    } else {
      this.circuitBreaker.recordFailure(modelId);
    }
    
    // Update running averages
    perf.accuracy = perf.correctPredictions / perf.totalPredictions;
    perf.avgLatency = (perf.avgLatency + latency) / 2;
    perf.successRate = success ? 
      (perf.successRate * 0.9 + 0.1) : 
      (perf.successRate * 0.9);
    
    perf.lastUpdated = new Date().toISOString();
    
    // Cache the performance data
    this.performanceCache.set(modelId, { ...perf });
  }

  // Public methods for monitoring and management
  async getModelPerformance(): Promise<Map<string, ModelPerformance>> {
    return new Map(this.performanceCache);
  }

  getAvailableModelIds(): string[] {
    return this.getAvailableModels().map(m => m.id);
  }

  async updateModelConfig(modelId: string, updates: Partial<ModelConfig>): Promise<void> {
    const model = this.models.get(modelId);
    if (model) {
      Object.assign(model, updates);
      logger.info(`Updated configuration for model ${modelId}`, updates);
    }
  }

  resetCircuitBreaker(modelId: string): void {
    this.circuitBreaker.reset(modelId);
    logger.info(`Reset circuit breaker for model ${modelId}`);
  }

  // Methods required by FeedbackLoopAgent
  async initialize(): Promise<void> {
    logger.info('Initializing AI Orchestrator');
    // Initialize models and connections
    this.initializeModels();
  }

  async checkHealth(): Promise<boolean> {
    // Check if models are healthy
    for (const [modelId, model] of Array.from(this.models)) {
      if (model.enabled && this.circuitBreaker.isOpen(modelId)) {
        return false;
      }
    }
    return true;
  }

  async switchToBackupModel(primaryModelId: string): Promise<string> {
    // Find the next available model with highest priority
    const availableModels = Array.from(this.models.entries())
      .filter(([id, model]) => id !== primaryModelId && model.enabled && !this.circuitBreaker.isOpen(id))
      .sort(([, a], [, b]) => b.priority - a.priority);

    if (availableModels.length > 0) {
      const backupModel = availableModels[0];
      if (!backupModel) {
        throw new Error('No backup model available');
      }
      const [backupModelId] = backupModel;
      logger.info(`Switching from ${primaryModelId} to backup model ${backupModelId}`);
      return backupModelId;
    }

    throw new Error('No backup models available');
  }
}