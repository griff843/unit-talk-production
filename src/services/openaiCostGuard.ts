// src/services/openaiCostGuard.ts
import { OpenAI } from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../shared/logger/types';
import { encode } from 'gpt-tokenizer';

/**
 * Cost structure for different OpenAI models
 */
interface ModelCosts {
  [modelName: string]: {
    inputCostPer1k: number;
    outputCostPer1k: number;
    maxTokens: number;
  };
}

/**
 * OpenAI usage metrics
 */
export interface OpenAIUsageMetrics {
  dailyTokens: number;
  weeklyTokens: number;
  monthlyTokens: number;
  dailyCost: number;
  weeklyCost: number;
  monthlyCost: number;
  lastUpdated: string;
  modelBreakdown: {
    [modelName: string]: {
      tokens: number;
      cost: number;
      calls: number;
    };
  };
}

/**
 * OpenAI cost guard configuration
 */
export interface OpenAICostGuardConfig {
  dailyTokenQuota: number;
  weeklyTokenQuota: number;
  monthlyTokenQuota: number;
  dailyCostLimit: number;
  weeklyCostLimit: number;
  monthlyCostLimit: number;
  alertThresholdPercent: number;
  persistenceEnabled: boolean;
  alertsEnabled: boolean;
  fallbackEnabled: boolean;
  fallbackModel?: string;
  cacheTTLSeconds?: number;
}

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN',     // Breaker tripped
  HALF_OPEN = 'HALF_OPEN' // Testing if system has recovered
}

/**
 * Result of a circuit breaker check
 */
interface CircuitBreakerResult {
  state: CircuitState;
  reason?: string;
  limit?: number;
  current?: number;
  allowRequest: boolean;
  fallbackModel?: string;
}

/**
 * Token usage record
 */
interface TokenUsageRecord {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: string;
}

/**
 * Default model costs (USD)
 */
const DEFAULT_MODEL_COSTS: ModelCosts = {
  'gpt-4': {
    inputCostPer1k: 0.03,
    outputCostPer1k: 0.06,
    maxTokens: 8192
  },
  'gpt-4-32k': {
    inputCostPer1k: 0.06,
    outputCostPer1k: 0.12,
    maxTokens: 32768
  },
  'gpt-4-turbo': {
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03,
    maxTokens: 128000
  },
  'gpt-3.5-turbo': {
    inputCostPer1k: 0.0015,
    outputCostPer1k: 0.002,
    maxTokens: 16385
  },
  'gpt-3.5-turbo-16k': {
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.004,
    maxTokens: 16385
  },
  'text-embedding-ada-002': {
    inputCostPer1k: 0.0001,
    outputCostPer1k: 0,
    maxTokens: 8191
  }
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG: OpenAICostGuardConfig = {
  dailyTokenQuota: parseInt(process.env.OPENAI_DAILY_TOKEN_QUOTA || '1000000'),
  weeklyTokenQuota: parseInt(process.env.OPENAI_WEEKLY_TOKEN_QUOTA || '5000000'),
  monthlyTokenQuota: parseInt(process.env.OPENAI_MONTHLY_TOKEN_QUOTA || '20000000'),
  dailyCostLimit: parseFloat(process.env.OPENAI_DAILY_COST_LIMIT || '50'),
  weeklyCostLimit: parseFloat(process.env.OPENAI_WEEKLY_COST_LIMIT || '250'),
  monthlyCostLimit: parseFloat(process.env.OPENAI_MONTHLY_COST_LIMIT || '1000'),
  alertThresholdPercent: parseInt(process.env.OPENAI_ALERT_THRESHOLD || '80'),
  persistenceEnabled: process.env.OPENAI_PERSISTENCE_ENABLED !== 'false',
  alertsEnabled: process.env.OPENAI_ALERTS_ENABLED !== 'false',
  fallbackEnabled: process.env.OPENAI_FALLBACK_ENABLED !== 'false',
  fallbackModel: process.env.OPENAI_FALLBACK_MODEL || 'gpt-3.5-turbo',
  cacheTTLSeconds: parseInt(process.env.OPENAI_CACHE_TTL || '3600')
};

/**
 * Cache entry for OpenAI responses
 */
interface CacheEntry {
  prompt: string;
  response: any;
  model: string;
  timestamp: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * OpenAI Cost Guard - Monitors and controls OpenAI API usage and costs
 */
export class OpenAICostGuard {
  private static instance: OpenAICostGuard;
  private supabase: SupabaseClient;
  private logger: Logger;
  private config: OpenAICostGuardConfig;
  private modelCosts: ModelCosts;
  private metrics: OpenAIUsageMetrics;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private lastCircuitStateChange: Date = new Date();
  private resetTimeout?: NodeJS.Timeout;
  private responseCache: Map<string, CacheEntry> = new Map();
  private openai?: OpenAI;

  /**
   * Get the singleton instance of OpenAICostGuard
   */
  public static getInstance(
    supabase: SupabaseClient,
    logger: Logger,
    config?: Partial<OpenAICostGuardConfig>,
    modelCosts?: ModelCosts
  ): OpenAICostGuard {
    if (!OpenAICostGuard.instance) {
      OpenAICostGuard.instance = new OpenAICostGuard(supabase, logger, config, modelCosts);
    }
    return OpenAICostGuard.instance;
  }

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(
    supabase: SupabaseClient,
    logger: Logger,
    config?: Partial<OpenAICostGuardConfig>,
    modelCosts?: ModelCosts
  ) {
    this.supabase = supabase;
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modelCosts = { ...DEFAULT_MODEL_COSTS, ...modelCosts };
    
    // Initialize metrics
    this.metrics = {
      dailyTokens: 0,
      weeklyTokens: 0,
      monthlyTokens: 0,
      dailyCost: 0,
      weeklyCost: 0,
      monthlyCost: 0,
      lastUpdated: new Date().toISOString(),
      modelBreakdown: {}
    };

    // Initialize OpenAI client if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }

    // Load usage metrics from persistent storage
    if (this.config.persistenceEnabled) {
      this.loadMetrics().catch(err => {
        this.logger.error('Failed to load OpenAI usage metrics', err);
      });
    }

    // Start cleanup interval for cache
    setInterval(() => this.cleanupCache(), 60000); // Clean up every minute
  }

  /**
   * Initialize the OpenAI Cost Guard
   */
  public async initialize(): Promise<void> {
    try {
      // Create the metrics table if it doesn't exist
      if (this.config.persistenceEnabled) {
        await this.ensureMetricsTable();
      }

      // Load initial metrics
      await this.loadMetrics();

      this.logger.info('OpenAI Cost Guard initialized successfully', {
        dailyQuota: this.config.dailyTokenQuota,
        weeklyQuota: this.config.weeklyTokenQuota,
        dailyUsage: this.metrics.dailyTokens,
        weeklyUsage: this.metrics.weeklyTokens
      });
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI Cost Guard', error);
      throw error;
    }
  }

  /**
   * Create a wrapped OpenAI client with cost control
   */
  public createClient(options?: any): OpenAI {
    // If we have an existing client, return it
    if (this.openai) {
      return this.wrapOpenAIClient(this.openai);
    }

    // Otherwise create a new client
    const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not provided');
    }

    this.openai = new OpenAI({
      apiKey,
      ...options
    });

    return this.wrapOpenAIClient(this.openai);
  }

  /**
   * Wrap an existing OpenAI client with cost control
   */
  public wrapOpenAIClient(client: OpenAI): OpenAI {
    const originalCreateChatCompletion = client.chat.completions.create.bind(client.chat.completions);
    const originalCreateEmbedding = client.embeddings.create.bind(client.embeddings);

    // Override chat completion method
    client.chat.completions.create = async (params: any, options?: any) => {
      // Check circuit breaker
      const circuitCheck = await this.checkCircuitBreaker();
      if (!circuitCheck.allowRequest) {
        if (this.config.fallbackEnabled && circuitCheck.fallbackModel) {
          // Use fallback model
          this.logger.warn(`Circuit breaker open, using fallback model: ${circuitCheck.fallbackModel}`, {
            reason: circuitCheck.reason,
            originalModel: params.model
          });
          params.model = circuitCheck.fallbackModel;
        } else {
          // No fallback, throw error
          throw new Error(`OpenAI API quota exceeded: ${circuitCheck.reason}`);
        }
      }

      // Check cache
      const cacheKey = this.generateCacheKey(params);
      const cachedResponse = this.getCachedResponse(cacheKey, params.model);
      if (cachedResponse) {
        this.logger.debug('Using cached OpenAI response', {
          model: params.model,
          tokenUsage: cachedResponse.tokenUsage
        });
        return cachedResponse.response;
      }

      // Estimate token usage for this request
      const estimatedTokens = this.estimateTokenUsage(params);
      
      // Pre-check if this would exceed limits
      if (this.metrics.dailyTokens + estimatedTokens > this.config.dailyTokenQuota) {
        if (this.config.fallbackEnabled && this.config.fallbackModel) {
          // Use fallback model
          this.logger.warn(`Estimated tokens would exceed daily quota, using fallback model: ${this.config.fallbackModel}`, {
            estimatedTokens,
            dailyTokens: this.metrics.dailyTokens,
            dailyQuota: this.config.dailyTokenQuota,
            originalModel: params.model
          });
          params.model = this.config.fallbackModel;
        } else {
          // No fallback, throw error
          throw new Error(`OpenAI API quota would be exceeded by this request`);
        }
      }

      // Make the API call
      try {
        const response = await originalCreateChatCompletion(params, options);
        
        // Record token usage
        if (response.usage) {
          await this.recordTokenUsage({
            model: params.model,
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
            estimatedCost: this.calculateCost(
              params.model,
              response.usage.prompt_tokens,
              response.usage.completion_tokens
            ),
            timestamp: new Date().toISOString()
          });
        } else {
          // If usage not provided, use estimate
          await this.recordTokenUsage({
            model: params.model,
            promptTokens: estimatedTokens,
            completionTokens: 0, // Can't estimate completion tokens accurately
            totalTokens: estimatedTokens,
            estimatedCost: this.calculateCost(params.model, estimatedTokens, 0),
            timestamp: new Date().toISOString()
          });
        }

        // Cache the response
        this.cacheResponse(cacheKey, params.model, params, response);

        return response;
      } catch (error) {
        // Handle rate limiting or other API errors
        this.logger.error('OpenAI API error', error);
        
        // If we get a rate limit error, open the circuit breaker
        if (error instanceof Error && error.message.includes('rate limit')) {
          await this.openCircuitBreaker('Rate limit exceeded', 60000); // Open for 1 minute
        }
        
        throw error;
      }
    };

    // Override embeddings method
    client.embeddings.create = async (params: any, options?: any) => {
      // Check circuit breaker
      const circuitCheck = await this.checkCircuitBreaker();
      if (!circuitCheck.allowRequest) {
        throw new Error(`OpenAI API quota exceeded: ${circuitCheck.reason}`);
      }

      // Make the API call
      try {
        const response = await originalCreateEmbedding(params, options);
        
        // Record token usage
        if (response.usage) {
          await this.recordTokenUsage({
            model: params.model,
            promptTokens: response.usage.prompt_tokens,
            completionTokens: 0, // Embeddings don't have completion tokens
            totalTokens: response.usage.total_tokens,
            estimatedCost: this.calculateCost(
              params.model,
              response.usage.prompt_tokens,
              0
            ),
            timestamp: new Date().toISOString()
          });
        }

        return response;
      } catch (error) {
        // Handle rate limiting or other API errors
        this.logger.error('OpenAI API error', error);
        
        // If we get a rate limit error, open the circuit breaker
        if (error instanceof Error && error.message.includes('rate limit')) {
          await this.openCircuitBreaker('Rate limit exceeded', 60000); // Open for 1 minute
        }
        
        throw error;
      }
    };

    return client;
  }

  /**
   * Check if the circuit breaker is open
   */
  public async checkCircuitBreaker(): Promise<CircuitBreakerResult> {
    // If circuit is open, check if we should try half-open
    if (this.circuitState === CircuitState.OPEN) {
      const now = new Date();
      const timeSinceChange = now.getTime() - this.lastCircuitStateChange.getTime();
      
      // If it's been more than 5 minutes, try half-open
      if (timeSinceChange > 5 * 60 * 1000) {
        this.circuitState = CircuitState.HALF_OPEN;
        this.lastCircuitStateChange = now;
        this.logger.info('Circuit breaker entering half-open state');
      } else {
        // Still open
        return {
          state: CircuitState.OPEN,
          reason: 'Circuit breaker is open',
          allowRequest: false,
          fallbackModel: this.config.fallbackModel
        };
      }
    }

    // Check daily token quota
    if (this.metrics.dailyTokens >= this.config.dailyTokenQuota) {
      await this.openCircuitBreaker('Daily token quota exceeded', 60 * 60 * 1000); // 1 hour
      return {
        state: CircuitState.OPEN,
        reason: 'Daily token quota exceeded',
        limit: this.config.dailyTokenQuota,
        current: this.metrics.dailyTokens,
        allowRequest: false,
        fallbackModel: this.config.fallbackModel
      };
    }

    // Check weekly token quota
    if (this.metrics.weeklyTokens >= this.config.weeklyTokenQuota) {
      await this.openCircuitBreaker('Weekly token quota exceeded', 6 * 60 * 60 * 1000); // 6 hours
      return {
        state: CircuitState.OPEN,
        reason: 'Weekly token quota exceeded',
        limit: this.config.weeklyTokenQuota,
        current: this.metrics.weeklyTokens,
        allowRequest: false,
        fallbackModel: this.config.fallbackModel
      };
    }

    // Check daily cost limit
    if (this.metrics.dailyCost >= this.config.dailyCostLimit) {
      await this.openCircuitBreaker('Daily cost limit exceeded', 60 * 60 * 1000); // 1 hour
      return {
        state: CircuitState.OPEN,
        reason: 'Daily cost limit exceeded',
        limit: this.config.dailyCostLimit,
        current: this.metrics.dailyCost,
        allowRequest: false,
        fallbackModel: this.config.fallbackModel
      };
    }

    // Check weekly cost limit
    if (this.metrics.weeklyCost >= this.config.weeklyCostLimit) {
      await this.openCircuitBreaker('Weekly cost limit exceeded', 6 * 60 * 60 * 1000); // 6 hours
      return {
        state: CircuitState.OPEN,
        reason: 'Weekly cost limit exceeded',
        limit: this.config.weeklyCostLimit,
        current: this.metrics.weeklyCost,
        allowRequest: false,
        fallbackModel: this.config.fallbackModel
      };
    }

    // Check alert thresholds and send alerts if needed
    await this.checkAlertThresholds();

    // All checks passed, circuit is closed
    if (this.circuitState !== CircuitState.CLOSED) {
      this.circuitState = CircuitState.CLOSED;
      this.lastCircuitStateChange = new Date();
      this.logger.info('Circuit breaker closed');
    }

    return {
      state: CircuitState.CLOSED,
      allowRequest: true
    };
  }

  /**
   * Open the circuit breaker
   */
  private async openCircuitBreaker(reason: string, resetTimeMs: number): Promise<void> {
    this.circuitState = CircuitState.OPEN;
    this.lastCircuitStateChange = new Date();
    
    this.logger.warn(`Circuit breaker opened: ${reason}`, {
      resetTimeMs,
      dailyTokens: this.metrics.dailyTokens,
      dailyQuota: this.config.dailyTokenQuota,
      dailyCost: this.metrics.dailyCost,
      dailyCostLimit: this.config.dailyCostLimit
    });

    // Send alert
    if (this.config.alertsEnabled) {
      await this.sendAlert(`OpenAI circuit breaker opened: ${reason}`, {
        dailyTokens: this.metrics.dailyTokens,
        dailyQuota: this.config.dailyTokenQuota,
        dailyCost: this.metrics.dailyCost,
        dailyCostLimit: this.config.dailyCostLimit,
        resetTime: new Date(Date.now() + resetTimeMs).toISOString()
      });
    }

    // Set up auto-reset
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
    
    this.resetTimeout = setTimeout(() => {
      this.circuitState = CircuitState.HALF_OPEN;
      this.lastCircuitStateChange = new Date();
      this.logger.info('Circuit breaker auto-reset to half-open state');
    }, resetTimeMs);
  }

  /**
   * Check alert thresholds and send alerts if needed
   */
  private async checkAlertThresholds(): Promise<void> {
    if (!this.config.alertsEnabled) {
      return;
    }

    const thresholdPercent = this.config.alertThresholdPercent;
    const alerts = [];

    // Check daily token quota
    const dailyTokenPercent = (this.metrics.dailyTokens / this.config.dailyTokenQuota) * 100;
    if (dailyTokenPercent >= thresholdPercent) {
      alerts.push(`Daily token usage at ${dailyTokenPercent.toFixed(1)}% of quota`);
    }

    // Check weekly token quota
    const weeklyTokenPercent = (this.metrics.weeklyTokens / this.config.weeklyTokenQuota) * 100;
    if (weeklyTokenPercent >= thresholdPercent) {
      alerts.push(`Weekly token usage at ${weeklyTokenPercent.toFixed(1)}% of quota`);
    }

    // Check daily cost limit
    const dailyCostPercent = (this.metrics.dailyCost / this.config.dailyCostLimit) * 100;
    if (dailyCostPercent >= thresholdPercent) {
      alerts.push(`Daily cost at ${dailyCostPercent.toFixed(1)}% of limit`);
    }

    // Check weekly cost limit
    const weeklyCostPercent = (this.metrics.weeklyCost / this.config.weeklyCostLimit) * 100;
    if (weeklyCostPercent >= thresholdPercent) {
      alerts.push(`Weekly cost at ${weeklyCostPercent.toFixed(1)}% of limit`);
    }

    // Send alerts if any
    if (alerts.length > 0) {
      await this.sendAlert(`OpenAI usage alert: ${alerts.join(', ')}`, {
        dailyTokens: this.metrics.dailyTokens,
        dailyQuota: this.config.dailyTokenQuota,
        dailyCost: this.metrics.dailyCost,
        dailyCostLimit: this.config.dailyCostLimit,
        weeklyTokens: this.metrics.weeklyTokens,
        weeklyQuota: this.config.weeklyTokenQuota,
        weeklyCost: this.metrics.weeklyCost,
        weeklyCostLimit: this.config.weeklyCostLimit
      });
    }
  }

  /**
   * Send an alert
   */
  private async sendAlert(message: string, data: any): Promise<void> {
    try {
      this.logger.warn(message, data);
      
      // Insert into alerts table
      if (this.config.persistenceEnabled) {
        await this.supabase.from('openai_alerts').insert({
          message,
          data,
          created_at: new Date().toISOString()
        });
      }

      // TODO: Add integration with NotificationAgent
      // This would be implemented by importing and using the NotificationAgent
      // or by sending a message to a webhook/queue that the NotificationAgent monitors
    } catch (error) {
      this.logger.error('Failed to send OpenAI alert', error);
    }
  }

  /**
   * Record token usage
   */
  private async recordTokenUsage(usage: TokenUsageRecord): Promise<void> {
    try {
      // Update in-memory metrics
      this.metrics.dailyTokens += usage.totalTokens;
      this.metrics.weeklyTokens += usage.totalTokens;
      this.metrics.monthlyTokens += usage.totalTokens;
      this.metrics.dailyCost += usage.estimatedCost;
      this.metrics.weeklyCost += usage.estimatedCost;
      this.metrics.monthlyCost += usage.estimatedCost;
      this.metrics.lastUpdated = new Date().toISOString();

      // Update model breakdown
      if (!this.metrics.modelBreakdown[usage.model]) {
        this.metrics.modelBreakdown[usage.model] = {
          tokens: 0,
          cost: 0,
          calls: 0
        };
      }
      this.metrics.modelBreakdown[usage.model].tokens += usage.totalTokens;
      this.metrics.modelBreakdown[usage.model].cost += usage.estimatedCost;
      this.metrics.modelBreakdown[usage.model].calls += 1;

      // Persist to database if enabled
      if (this.config.persistenceEnabled) {
        // Insert usage record
        await this.supabase.from('openai_usage').insert({
          model: usage.model,
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
          estimated_cost: usage.estimatedCost,
          created_at: usage.timestamp
        });

        // Update metrics
        await this.supabase.from('openai_metrics').upsert({
          id: 'current',
          daily_tokens: this.metrics.dailyTokens,
          weekly_tokens: this.metrics.weeklyTokens,
          monthly_tokens: this.metrics.monthlyTokens,
          daily_cost: this.metrics.dailyCost,
          weekly_cost: this.metrics.weeklyCost,
          monthly_cost: this.metrics.monthlyCost,
          model_breakdown: this.metrics.modelBreakdown,
          updated_at: this.metrics.lastUpdated
        }, { onConflict: 'id' });
      }

      // Log usage
      this.logger.debug('OpenAI token usage recorded', {
        model: usage.model,
        tokens: usage.totalTokens,
        cost: usage.estimatedCost,
        dailyTokens: this.metrics.dailyTokens,
        dailyQuota: this.config.dailyTokenQuota
      });
    } catch (error) {
      this.logger.error('Failed to record token usage', error);
    }
  }

  /**
   * Calculate cost for token usage
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const modelInfo = this.modelCosts[model] || this.modelCosts['gpt-3.5-turbo']; // Default to gpt-3.5-turbo costs
    
    const promptCost = (promptTokens / 1000) * modelInfo.inputCostPer1k;
    const completionCost = (completionTokens / 1000) * modelInfo.outputCostPer1k;
    
    return promptCost + completionCost;
  }

  /**
   * Estimate token usage for a request
   */
  private estimateTokenUsage(params: any): number {
    let totalTokens = 0;
    
    // Count tokens in messages
    if (params.messages && Array.isArray(params.messages)) {
      for (const message of params.messages) {
        if (message.content) {
          totalTokens += encode(message.content).length;
        }
      }
    }
    
    // Add tokens for system message if present
    if (params.system) {
      totalTokens += encode(params.system).length;
    }
    
    // Add tokens for function definitions if present
    if (params.functions && Array.isArray(params.functions)) {
      for (const func of params.functions) {
        totalTokens += encode(JSON.stringify(func)).length;
      }
    }
    
    // Add a buffer for potential underestimation
    totalTokens = Math.ceil(totalTokens * 1.1);
    
    return totalTokens;
  }

  /**
   * Load metrics from persistent storage
   */
  private async loadMetrics(): Promise<void> {
    if (!this.config.persistenceEnabled) {
      return;
    }

    try {
      // Check if metrics table exists
      await this.ensureMetricsTable();

      // Load current metrics
      const { data, error } = await this.supabase
        .from('openai_metrics')
        .select('*')
        .eq('id', 'current')
        .single();

      if (error) {
        this.logger.warn('Failed to load OpenAI metrics', error);
        return;
      }

      if (data) {
        // Check if we need to reset daily metrics
        const lastUpdated = new Date(data.updated_at);
        const now = new Date();
        const dayDiff = this.getDayDifference(lastUpdated, now);
        const weekDiff = this.getWeekDifference(lastUpdated, now);
        const monthDiff = this.getMonthDifference(lastUpdated, now);

        // Reset metrics if needed
        if (dayDiff >= 1) {
          data.daily_tokens = 0;
          data.daily_cost = 0;
        }

        if (weekDiff >= 1) {
          data.weekly_tokens = 0;
          data.weekly_cost = 0;
        }

        if (monthDiff >= 1) {
          data.monthly_tokens = 0;
          data.monthly_cost = 0;
        }

        // Update metrics
        this.metrics = {
          dailyTokens: data.daily_tokens || 0,
          weeklyTokens: data.weekly_tokens || 0,
          monthlyTokens: data.monthly_tokens || 0,
          dailyCost: data.daily_cost || 0,
          weeklyCost: data.weekly_cost || 0,
          monthlyCost: data.monthly_cost || 0,
          lastUpdated: now.toISOString(),
          modelBreakdown: data.model_breakdown || {}
        };

        this.logger.info('OpenAI metrics loaded', {
          dailyTokens: this.metrics.dailyTokens,
          weeklyTokens: this.metrics.weeklyTokens,
          dailyCost: this.metrics.dailyCost
        });
      }
    } catch (error) {
      this.logger.error('Failed to load OpenAI metrics', error);
    }
  }

  /**
   * Ensure metrics table exists
   */
  private async ensureMetricsTable(): Promise<void> {
    try {
      // Check if table exists by querying it
      const { error } = await this.supabase
        .from('openai_metrics')
        .select('id')
        .limit(1);

      // If no error, table exists
      if (!error) {
        return;
      }

      // Create metrics table
      this.logger.info('Creating OpenAI metrics table');
      
      // Note: Table creation would typically be handled by a migration
      // This is a simplified approach for demonstration
      
      // Initialize with default metrics
      await this.supabase.from('openai_metrics').insert({
        id: 'current',
        daily_tokens: 0,
        weekly_tokens: 0,
        monthly_tokens: 0,
        daily_cost: 0,
        weekly_cost: 0,
        monthly_cost: 0,
        model_breakdown: {},
        updated_at: new Date().toISOString()
      });

      // Create usage table
      await this.supabase.from('openai_usage').insert({
        id: 'init',
        model: 'system',
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        estimated_cost: 0,
        created_at: new Date().toISOString()
      });

      // Create alerts table
      await this.supabase.from('openai_alerts').insert({
        id: 'init',
        message: 'OpenAI Cost Guard initialized',
        data: {},
        created_at: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to create OpenAI metrics table', error);
      throw error;
    }
  }

  /**
   * Generate a cache key for a request
   */
  private generateCacheKey(params: any): string {
    // For chat completions, use the messages as the key
    if (params.messages) {
      return JSON.stringify({
        model: params.model,
        messages: params.messages.map((m: any) => ({
          role: m.role,
          content: m.content
        })),
        temperature: params.temperature || 1,
        max_tokens: params.max_tokens
      });
    }
    
    // For embeddings, use the input as the key
    if (params.input) {
      return JSON.stringify({
        model: params.model,
        input: params.input
      });
    }
    
    // Fallback
    return JSON.stringify(params);
  }

  /**
   * Get cached response if available
   */
  private getCachedResponse(key: string, model: string): CacheEntry | null {
    const entry = this.responseCache.get(key);
    if (!entry) {
      return null;
    }
    
    // Check if cache entry is still valid
    const now = Date.now();
    const cacheAge = now - entry.timestamp;
    const ttl = (this.config.cacheTTLSeconds || 3600) * 1000;
    
    if (cacheAge > ttl) {
      // Cache expired
      this.responseCache.delete(key);
      return null;
    }
    
    // Check if the model matches
    if (entry.model !== model) {
      return null;
    }
    
    return entry;
  }

  /**
   * Cache a response
   */
  private cacheResponse(key: string, model: string, params: any, response: any): void {
    // Only cache if TTL is positive
    if (!this.config.cacheTTLSeconds || this.config.cacheTTLSeconds <= 0) {
      return;
    }
    
    // Extract token usage
    const tokenUsage = response.usage ? {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens
    } : {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
    
    // Store in cache
    this.responseCache.set(key, {
      prompt: params,
      response,
      model,
      timestamp: Date.now(),
      tokenUsage
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const ttl = (this.config.cacheTTLSeconds || 3600) * 1000;
    
    for (const [key, entry] of this.responseCache.entries()) {
      const cacheAge = now - entry.timestamp;
      if (cacheAge > ttl) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Get difference in days between two dates
   */
  private getDayDifference(date1: Date, date2: Date): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    // Reset time component
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    
    // Calculate difference in days
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get difference in weeks between two dates
   */
  private getWeekDifference(date1: Date, date2: Date): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    // Get first day of week (Sunday)
    const day1 = d1.getDay();
    const day2 = d2.getDay();
    
    d1.setDate(d1.getDate() - day1);
    d2.setDate(d2.getDate() - day2);
    
    // Reset time component
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    
    // Calculate difference in weeks
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
  }

  /**
   * Get difference in months between two dates
   */
  private getMonthDifference(date1: Date, date2: Date): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    // Calculate difference in months
    const monthDiff = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    
    return Math.abs(monthDiff);
  }

  /**
   * Get current usage metrics
   */
  public getMetrics(): OpenAIUsageMetrics {
    return { ...this.metrics };
  }

  /**
   * Get circuit breaker status
   */
  public getCircuitStatus(): {
    state: CircuitState;
    lastStateChange: Date;
    metrics: OpenAIUsageMetrics;
    config: OpenAICostGuardConfig;
  } {
    return {
      state: this.circuitState,
      lastStateChange: this.lastCircuitStateChange,
      metrics: { ...this.metrics },
      config: { ...this.config }
    };
  }

  /**
   * Reset daily usage metrics
   */
  public async resetDailyMetrics(): Promise<void> {
    this.metrics.dailyTokens = 0;
    this.metrics.dailyCost = 0;
    this.metrics.lastUpdated = new Date().toISOString();
    
    if (this.config.persistenceEnabled) {
      await this.supabase.from('openai_metrics').upsert({
        id: 'current',
        daily_tokens: 0,
        daily_cost: 0,
        weekly_tokens: this.metrics.weeklyTokens,
        weekly_cost: this.metrics.weeklyCost,
        monthly_tokens: this.metrics.monthlyTokens,
        monthly_cost: this.metrics.monthlyCost,
        model_breakdown: this.metrics.modelBreakdown,
        updated_at: this.metrics.lastUpdated
      }, { onConflict: 'id' });
    }
    
    this.logger.info('Daily OpenAI metrics reset');
  }

  /**
   * Reset circuit breaker
   */
  public async resetCircuitBreaker(): Promise<void> {
    this.circuitState = CircuitState.CLOSED;
    this.lastCircuitStateChange = new Date();
    
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = undefined;
    }
    
    this.logger.info('OpenAI circuit breaker manually reset');
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<OpenAICostGuardConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('OpenAI Cost Guard configuration updated', this.config);
  }

  /**
   * Update model costs
   */
  public updateModelCosts(costs: Partial<ModelCosts>): void {
    this.modelCosts = { ...this.modelCosts, ...costs };
    this.logger.info('OpenAI model costs updated');
  }
}

// Export singleton instance creator
export const getOpenAICostGuard = (
  supabase: SupabaseClient,
  logger: Logger,
  config?: Partial<OpenAICostGuardConfig>,
  modelCosts?: ModelCosts
): OpenAICostGuard => {
  return OpenAICostGuard.getInstance(supabase, logger, config, modelCosts);
};
