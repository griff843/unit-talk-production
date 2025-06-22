// src/agents/AlertAgent/adviceEngine.ts
import { FinalPick } from '../../types/picks';
import { AIOrchestrator } from './aiOrchestrator';
import { logger } from '../../services/logging';
import { getOpenAICircuitStatus, getOpenAIUsageMetrics } from '../../services/openaiClient';

// Market context analyzer
class MarketContextAnalyzer {
  async analyzeContext(pick: FinalPick): Promise<any> {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Determine market regime based on recent performance
    const regime = await this.determineMarketRegime();
    
    // Calculate volatility based on recent line movements
    const volatility = await this.calculateVolatility(pick);
    
    // Analyze sentiment from various sources
    const sentiment = await this.analyzeSentiment(pick);
    
    return {
      regime,
      volatility,
      sentiment,
      timeOfDay: this.getTimeOfDay(hour),
      dayOfWeek
    };
  }
  
  private async determineMarketRegime(): Promise<'bull' | 'bear' | 'sideways'> {
    // Simplified regime detection - in production, this would analyze
    // recent market performance, volatility, and trend indicators
    return 'sideways'; // Default for now
  }

  private async calculateVolatility(_pick: FinalPick): Promise<number> {
    // Simplified volatility calculation
    // In production, this would analyze historical line movements
    return 0.5; // Default moderate volatility
  }

  private async analyzeSentiment(_pick: FinalPick): Promise<number> {
    // Simplified sentiment analysis
    // In production, this would analyze social media, news, etc.
    return 0; // Neutral sentiment
  }
  
  private getTimeOfDay(hour: number): string {
    if (hour >= 9 && hour <= 16) return 'market_hours';
    if (hour >= 17 && hour <= 23) return 'evening';
    return 'overnight';
  }
}

// Enhanced advice engine with caching, fallback, and circuit-breaker awareness
export class AdviceEngine {
  private aiOrchestrator: AIOrchestrator;
  private contextAnalyzer: MarketContextAnalyzer;
  private cache: Map<string, { advice: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_BASE = 1000; // 1 second base delay
  private readonly CACHE_HIT_METRICS: { hits: number; misses: number; total: number } = { 
    hits: 0, 
    misses: 0, 
    total: 0 
  };

  constructor() {
    this.aiOrchestrator = new AIOrchestrator();
    this.contextAnalyzer = new MarketContextAnalyzer();
  }

  async getAdviceForPick(pick: FinalPick): Promise<string> {
    try {
      // Check circuit breaker status first
      const circuitStatus = getOpenAICircuitStatus();
      if (circuitStatus.state === 'OPEN') {
        logger.warn(`OpenAI circuit breaker is OPEN: ${circuitStatus.metrics.dailyTokens}/${circuitStatus.config.dailyTokenQuota} tokens used`);
        return this.getCircuitBreakerFallbackAdvice(pick, circuitStatus);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(pick);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.info(`Using cached advice for pick ${pick.id}`);
        this.CACHE_HIT_METRICS.hits++;
        this.CACHE_HIT_METRICS.total++;
        return this.formatAdvice(cached.advice);
      }
      
      this.CACHE_HIT_METRICS.misses++;
      this.CACHE_HIT_METRICS.total++;

      // Analyze market context
      const context = await this.contextAnalyzer.analyzeContext(pick);
      
      // Get AI advice with retries
      const aiAdvice = await this.retryWithBackoff(
        () => this.aiOrchestrator.getAdviceForPick(pick, context),
        this.MAX_RETRIES,
        this.RETRY_DELAY_BASE
      );
      
      // Cache the result
      this.cache.set(cacheKey, {
        advice: aiAdvice,
        timestamp: Date.now()
      });
      
      // Clean up old cache entries
      this.cleanupCache();
      
      return this.formatAdvice(aiAdvice);
      
    } catch (error) {
      logger.error('Failed to get AI advice:', error);
      
      // Check if this is a quota-related error
      const isQuotaError = error instanceof Error && (
        error.message.includes('quota') || 
        error.message.includes('rate limit') || 
        error.message.includes('capacity')
      );
      
      if (isQuotaError) {
        // Get metrics to include in fallback
        const metrics = getOpenAIUsageMetrics();
        return this.getQuotaErrorFallbackAdvice(pick, metrics);
      }
      
      return this.getFallbackAdvice(pick);
    }
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Check if this is a quota-related error - don't retry these
        const isQuotaError = lastError.message.includes('quota') || 
                            lastError.message.includes('rate limit') ||
                            lastError.message.includes('capacity');
        
        if (isQuotaError || attempt === maxRetries) {
          throw lastError;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = baseDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
        logger.info(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms delay`, {
          error: lastError.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Maximum retries exceeded');
  }

  private generateCacheKey(pick: FinalPick): string {
    // Create a unique key based on pick characteristics
    return `${pick.id}-${pick.player_name}-${pick.market_type}-${pick.line}-${pick.odds}`;
  }

  private formatAdvice(aiAdvice: any): string {
    if (typeof aiAdvice === 'string') {
      return aiAdvice;
    }

    const { advice, confidence, reasoning, model } = aiAdvice;
    
    let formattedAdvice = `**${advice}**`;
    
    if (confidence) {
      const confidencePercent = Math.round(confidence * 100);
      formattedAdvice += ` (${confidencePercent}% confidence)`;
    }
    
    if (reasoning) {
      formattedAdvice += `\n\n**Analysis:**\n${reasoning}`;
    }
    
    if (model) {
      formattedAdvice += `\n\n*Generated by ${model}*`;
    }
    
    return formattedAdvice;
  }

  private getFallbackAdvice(pick: FinalPick): string {
    // Rule-based fallback when AI is unavailable
    if (pick.is_sharp_fade) {
      return '**FADE** - Sharp money indicates line movement against this pick. Consider fading or avoiding.';
    }
    
    if (pick.tier === 'S' || pick.tier === 'A') {
      return '**HOLD** - High-tier pick with strong edge score. Monitor for optimal entry timing.';
    }
    
    if (pick.edge_score && pick.edge_score < 10) {
      return '**PASS** - Low edge score suggests limited value. Consider waiting for better opportunities.';
    }
    
    return '**HOLD** - Standard pick requiring manual review. AI analysis unavailable.';
  }

  private getQuotaErrorFallbackAdvice(pick: FinalPick, metrics: any): string {
    // Enhanced fallback when quota is exceeded
    let advice = this.getFallbackAdvice(pick);
    
    // Add quota information
    advice += `\n\n*Note: AI analysis unavailable due to quota limits. Current usage: ${metrics.dailyTokens.toLocaleString()} / ${metrics.dailyQuota?.toLocaleString() || 'unknown'} tokens.*`;
    
    return advice;
  }

  private getCircuitBreakerFallbackAdvice(pick: FinalPick, status: any): string {
    // Enhanced fallback when circuit breaker is open
    let advice = this.getFallbackAdvice(pick);
    
    // Add circuit breaker information
    advice += `\n\n*Note: AI analysis unavailable due to circuit breaker (${status.reason || 'quota exceeded'}). Service will resume automatically.*`;
    
    return advice;
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of Array.from(this.cache.entries())) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  // Public methods for monitoring and management
  public getCacheStats(): { size: number; hitRate: number; hits: number; misses: number; total: number } {
    return {
      size: this.cache.size,
      hitRate: this.CACHE_HIT_METRICS.total > 0 ? 
        this.CACHE_HIT_METRICS.hits / this.CACHE_HIT_METRICS.total : 0,
      hits: this.CACHE_HIT_METRICS.hits,
      misses: this.CACHE_HIT_METRICS.misses,
      total: this.CACHE_HIT_METRICS.total
    };
  }

  public clearCache(): void {
    this.cache.clear();
    logger.info('Advice cache cleared');
  }

  public async getModelPerformance(): Promise<Map<string, any>> {
    return this.aiOrchestrator.getModelPerformance();
  }

  public getCircuitStatus(): any {
    return getOpenAICircuitStatus();
  }

  public getUsageMetrics(): any {
    return getOpenAIUsageMetrics();
  }
}

// Export singleton instance
export const adviceEngine = new AdviceEngine();

// Legacy export for backward compatibility
export async function getAdviceForPick(pick: FinalPick): Promise<string> {
  return adviceEngine.getAdviceForPick(pick);
}
