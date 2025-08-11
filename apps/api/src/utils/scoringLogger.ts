/**
 * Structured debug logging for scoring system
 * Provides detailed scoring breakdown when SCORING_DEBUG=true
 * Keeps logs compact (<4KB) and redacts PII
 */

import { randomUUID } from 'crypto';

export interface ScoringLogEntry {
  trace_id: string;
  prop_id: string;
  league: string;
  market: string;
  odds_open?: number;
  odds_now?: number;
  devig_win_prob?: number;
  clv_pct?: number;
  features: Array<{
    name: string;
    value: number;
    weight: number;
    contribution: number;
  }>;
  composite: number;
  tier: string;
  kelly_fraction: number;
  timestamp: string;
  processing_time_ms?: number;
  model_version?: string;
  sport_config?: string;
}

interface ScoringDebugContext {
  propId: string;
  sport: string;
  market: string;
  startTime: number;
  traceId: string;
}

export class ScoringLogger {
  private static instance: ScoringLogger;
  private readonly SCORING_DEBUG: boolean;
  private readonly MAX_LOG_SIZE = 4000; // 4KB limit per log entry
  
  private constructor() {
    this.SCORING_DEBUG = process.env.SCORING_DEBUG === 'true';
  }
  
  public static getInstance(): ScoringLogger {
    if (!ScoringLogger.instance) {
      ScoringLogger.instance = new ScoringLogger();
    }
    return ScoringLogger.instance;
  }
  
  /**
   * Check if debug logging is enabled
   */
  public isEnabled(): boolean {
    return this.SCORING_DEBUG;
  }
  
  /**
   * Start a scoring trace
   */
  public startTrace(propId: string, sport: string, market: string): ScoringDebugContext {
    return {
      propId: this.redactPII(propId),
      sport,
      market: this.redactPII(market),
      startTime: Date.now(),
      traceId: randomUUID().substring(0, 8) // Short trace ID
    };
  }
  
  /**
   * Log scoring result with full breakdown
   */
  public logScoringResult(
    context: ScoringDebugContext,
    result: {
      tier: string;
      finalScore: number;
      confidence: number;
      kellyFraction: number;
      featureContributions?: Record<string, number>;
      deviggingResult?: any;
      clvPct?: number;
      modelVersion?: string;
      sportConfig?: string;
    },
    weights: Record<string, number> = {}
  ): void {
    if (!this.SCORING_DEBUG) {
      return;
    }
    
    try {
      const processingTime = Date.now() - context.startTime;
      
      // Build feature contributions array
      const features: Array<{name: string; value: number; weight: number; contribution: number}> = [];
      
      if (result.featureContributions) {
        for (const [name, contribution] of Object.entries(result.featureContributions)) {
          const weight = weights[name] || 0;
          features.push({
            name: this.truncateString(name, 20),
            value: this.roundToDecimal(contribution / (weight || 1), 2), // Back-calculate value
            weight: this.roundToDecimal(weight, 4),
            contribution: this.roundToDecimal(contribution, 2)
          });
        }
      }
      
      // Sort by contribution (highest first) and limit to top 15 to stay under 4KB
      features.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
      const topFeatures = features.slice(0, 15);
      
      const logEntry: ScoringLogEntry = {
        trace_id: context.traceId,
        prop_id: context.propId,
        league: context.sport,
        market: context.market,
        devig_win_prob: this.roundToDecimal(result.deviggingResult?.trueProb || 0, 3),
        clv_pct: this.roundToDecimal(result.clvPct || 0, 2),
        features: topFeatures,
        composite: this.roundToDecimal(result.finalScore, 2),
        tier: result.tier,
        kelly_fraction: this.roundToDecimal(result.kellyFraction, 4),
        timestamp: new Date().toISOString(),
        processing_time_ms: processingTime,
        model_version: result.modelVersion?.substring(0, 20) || 'unknown',
        sport_config: result.sportConfig?.substring(0, 20) || context.sport
      };
      
      // Convert to compact JSON and check size
      const logJson = JSON.stringify(logEntry);
      
      if (logJson.length > this.MAX_LOG_SIZE) {
        // Truncate features if too large
        const truncatedEntry = {
          ...logEntry,
          features: topFeatures.slice(0, Math.floor(topFeatures.length * 0.7)),
          _truncated: true
        };
        console.log('SCORING_DEBUG:', JSON.stringify(truncatedEntry));
      } else {
        console.log('SCORING_DEBUG:', logJson);
      }
      
    } catch (error) {
      console.warn('⚠️ Scoring logger error:', error);
      // Fallback minimal log
      console.log('SCORING_DEBUG:', JSON.stringify({
        trace_id: context.traceId,
        prop_id: context.propId,
        tier: result.tier,
        score: result.finalScore,
        error: 'logging_error',
        timestamp: new Date().toISOString()
      }));
    }
  }
  
  /**
   * Log feature engineering steps
   */
  public logFeatureEngineering(
    context: ScoringDebugContext,
    originalFeatures: any,
    enrichedFeatures: any
  ): void {
    if (!this.SCORING_DEBUG) {
      return;
    }
    
    console.log('SCORING_DEBUG:', JSON.stringify({
      trace_id: context.traceId,
      step: 'feature_engineering',
      original_count: Object.keys(originalFeatures || {}).length,
      enriched_count: Object.keys(enrichedFeatures || {}).length,
      timestamp: new Date().toISOString()
    }));
  }
  
  /**
   * Log devigging results
   */
  public logDevigging(
    context: ScoringDebugContext,
    originalOdds: number,
    deviggingResult: any
  ): void {
    if (!this.SCORING_DEBUG) {
      return;
    }
    
    console.log('SCORING_DEBUG:', JSON.stringify({
      trace_id: context.traceId,
      step: 'devigging',
      original_odds: originalOdds,
      fair_odds: this.roundToDecimal(deviggingResult?.fairOdds || 0, 0),
      vig_removed: this.roundToDecimal(deviggingResult?.totalVig || 0, 2),
      true_prob: this.roundToDecimal(deviggingResult?.trueProb || 0, 3),
      edge: this.roundToDecimal(deviggingResult?.deviggedEdge || 0, 3),
      timestamp: new Date().toISOString()
    }));
  }
  
  /**
   * Log CLV tracking initiation
   */
  public logCLVTracking(
    context: ScoringDebugContext,
    clvTrackingId: string,
    initialLine: number
  ): void {
    if (!this.SCORING_DEBUG) {
      return;
    }
    
    console.log('SCORING_DEBUG:', JSON.stringify({
      trace_id: context.traceId,
      step: 'clv_tracking',
      clv_id: clvTrackingId.substring(0, 8), // Redact full ID
      initial_line: initialLine,
      timestamp: new Date().toISOString()
    }));
  }
  
  /**
   * Log professional path routing
   */
  public logProfessionalRouting(
    context: ScoringDebugContext,
    pathUsed: 'PROFESSIONAL' | 'LEGACY',
    processingTimeMs: number
  ): void {
    if (!this.SCORING_DEBUG) {
      return;
    }
    
    console.log('SCORING_DEBUG:', JSON.stringify({
      trace_id: context.traceId,
      step: 'routing',
      path: pathUsed,
      processing_ms: processingTimeMs,
      timestamp: new Date().toISOString()
    }));
  }
  
  /**
   * Redact personally identifiable information
   */
  private redactPII(value: string): string {
    if (!value) return 'unknown';
    
    // Keep first 3 and last 2 characters, mask the middle
    if (value.length > 8) {
      return value.substring(0, 3) + '***' + value.substring(value.length - 2);
    }
    
    return value.substring(0, 3) + '***';
  }
  
  /**
   * Truncate strings to prevent log bloat
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Round numbers to specified decimal places
   */
  private roundToDecimal(num: number, decimals: number): number {
    return Math.round((num + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}

// Export singleton instance
export const scoringLogger = ScoringLogger.getInstance();