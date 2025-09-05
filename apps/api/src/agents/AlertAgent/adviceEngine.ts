import { getOpenAICircuitStatus, getOpenAIUsageMetrics } from '../../services/openaiClient';
import { logger } from '../../utils/logger';

// import { AIOrchestrator } from './aiOrchestrator'; // Unused
import { aiModelRouter, AIRequest, AIResponse } from '../../ai/routing';
import { aiResponseCache } from '../../ai/cache';

// Define the pick payload type
interface PickPayload {
  id: string;
  player_name: string;
  market_type: string;
  line: number;
  odds: number;
  is_sharp_fade?: boolean;
  tier?: string;
  edge_score?: number;
}

// Market context analyzer
// import { MarketContextAnalyzer } from './marketContext';



/*
// Commented out unused class - remove if not needed
class MarketContextAnalyzer {
  async analyzeContext(pick: PickPayload): Promise<any> {
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

  private async calculateVolatility(_pick: PickPayload): Promise<number> {
    // Simplified volatility calculation
    // In production, this would analyze historical line movements
    return 0.5; // Default moderate volatility
  }

  private async analyzeSentiment(_pick: PickPayload): Promise<number> {
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
*/

// Enhanced advice engine with caching, fallback, and circuit-breaker awareness
export class AdviceEngine {
  private cache: Map<string, { advice: any; timestamp: number }> = new Map();
  // private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes - unused
  // private readonly _MAX_RETRIES = 3; // Used in retryWithBackoff method - unused
  // private readonly _RETRY_DELAY_BASE = 1000; // Used in retryWithBackoff method - unused
  private readonly CACHE_HIT_METRICS: { hits: number; misses: number; total: number } = { 
    hits: 0, 
    misses: 0, 
    total: 0 
  };

  constructor() {
    // Removed AI orchestrator initialization - unused
  }

  async getAdviceForPick(pick: PickPayload): Promise<string> {
    try {
      // Generate context for AI request
      const context = {
        player: pick.player_name,
        market: pick.market_type,
        line: pick.line,
        odds: pick.odds,
        tier: pick.tier,
        edge: pick.edge_score,
        sharpFade: pick.is_sharp_fade,
        timestamp: Date.now()
      };

      // Check if requery is needed (odds movement or context change)
      const requeryCheck = aiResponseCache.shouldRequeryAdvice(
        pick.id, 
        pick.odds, 
        pick.line, 
        context
      );

      if (!requeryCheck.shouldRequery && requeryCheck.cachedEntry) {
        logger.info(`🎯 Cache HIT for pick ${pick.id}: ${requeryCheck.cachedEntry.content.substring(0, 50)}...`);
        this.CACHE_HIT_METRICS.hits++;
        this.CACHE_HIT_METRICS.total++;
        
        // Return cached content with hit tracking
        const response: AIResponse = {
          ...requeryCheck.cachedEntry,
          cached: true,
          processingTime: 0, // Cached responses have no processing time
          quality: 'cached'
        };
        
        return this.formatAdvice(response);
      }

      if (requeryCheck.shouldRequery && requeryCheck.reason) {
        logger.info(`🔄 Cache MISS for pick ${pick.id}: ${requeryCheck.reason}`);
      }

      this.CACHE_HIT_METRICS.misses++;
      this.CACHE_HIT_METRICS.total++;

      // Create AI request with MVP detection
      const aiRequest: AIRequest = {
        type: 'advice',
        prompt: this.buildAdvicePrompt(pick, context),
        context,
        metadata: {
          propId: pick.id,
          odds: pick.odds,
          line: pick.line,
          isMVP: pick.tier === 'S' || (pick.edge_score ? pick.edge_score > 80 : false) // MVP picks get premium model
        }
      };

      // Execute request through AI routing system
      const response = await aiModelRouter.executeRequest(aiRequest);

      // Store in cache
      const cacheKey = aiResponseCache.generateAdviceCacheKey(pick.id, pick.odds, pick.line, context);
      aiResponseCache.set(
        cacheKey,
        response.content,
        response.model,
        response.provider,
        response.tokenCount,
        response.cost
      );

      // Log AI routing metrics
      logger.info(`🤖 AI Advice Generated`, {
        pickId: pick.id,
        model: response.model,
        provider: response.provider,
        tokens: response.tokenCount,
        cost: response.cost,
        processingTime: response.processingTime,
        cached: response.cached
      });

      return this.formatAdvice(response);
      
    } catch (error) {
      logger.error('Failed to get AI advice:', error as Error);
      
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


  private buildAdvicePrompt(pick: PickPayload, context: any): string {
    return `Provide betting advice for this player prop:

Player: ${pick.player_name}
Market: ${pick.market_type}
Line: ${pick.line}
Odds: ${pick.odds}
Tier: ${pick.tier || 'Unknown'}
Edge Score: ${pick.edge_score || 'N/A'}
Sharp Fade: ${pick.is_sharp_fade ? 'Yes' : 'No'}

Context: ${JSON.stringify(context, null, 2)}

Please provide:
1. Clear recommendation (PLAY, FADE, HOLD, or PASS)
2. Confidence level (1-100%)
3. Key reasoning factors
4. Risk assessment

Keep response concise and actionable.`;
  }

  private formatAdvice(response: AIResponse | any): string {
    // Handle AIResponse from new routing system
    if (response && typeof response === 'object' && 'content' in response) {
      let formatted = response.content;
      
      if (response.model && response.cached !== undefined) {
        const cacheStatus = response.cached ? '💾 CACHED' : '🤖 FRESH';
        formatted += `\n\n*${cacheStatus} • ${response.model}${response.cost ? ` • $${response.cost.toFixed(4)}` : ''}*`;
      }
      
      return formatted;
    }

    // Handle legacy format
    if (typeof response === 'string') {
      return response;
    }

    const { advice, confidence, reasoning, model } = response;
    
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

  private getFallbackAdvice(pick: PickPayload): string {
    // Rule-based fallback when AI is unavailable
    if (pick.is_sharp_fade) {
      return '**FADE** - Sharp money indicates line movement against this pick. Consider fading or avoiding.';
    }
    
    if (pick.tier === 'S' || pick.tier === 'A') {
      return '**HOLD** - High-tier pick with strong edge score. Monitor for optimal entry timing.';
    }
    
    if (pick.edge_score && pick.edge_score < 10) {
      return '**PASS** - Low edge professional_score suggests limited value. Consider waiting for better opportunities.';
    }
    
    return '**HOLD** - Standard pick requiring manual review. AI analysis unavailable.';
  }

  private getQuotaErrorFallbackAdvice(pick: PickPayload, metrics: any): string {
    // Enhanced fallback when quota is exceeded
    let advice = this.getFallbackAdvice(pick);
    
    // Add quota information
    advice += `\n\n*Note: AI analysis unavailable due to quota limits. Current usage: ${metrics.dailyTokens.toLocaleString()} / ${metrics.dailyQuota?.toLocaleString() || 'unknown'} tokens.*`;
    
    return advice;
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
    logger.info('Advice cache cleared', {});
  }

  public async getModelPerformance(): Promise<Map<string, any>> {
    // Return empty map for now since AIOrchestrator doesn't have this method
    return new Map();
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
export async function getAdviceForPick(pick: PickPayload): Promise<string> {
  return adviceEngine.getAdviceForPick(pick);
}



