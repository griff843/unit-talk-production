/**
 * Line Shopping Engine - Performance-Critical Odds Optimization Service
 *
 * MISSION: Identify +EV opportunities >2% edge across multiple sportsbooks
 * PERFORMANCE TARGET: Complete analysis in <5 seconds with efficient API usage
 *
 * Features:
 * - Real-time odds comparison across OddsAPI + Optimal sources
 * - Intelligent API quota management for 500 free tier limits
 * - Circuit breaker patterns for API failures
 * - Thread-safe concurrent processing
 * - Integration with existing FeedAgent workflow
 * - Sharp grading rules compliance
 *
 * @module LineShoppingEngine
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { circuitBreaker } from './enhanced-circuit-breaker';
import { supabaseClient } from './supabaseClient';
import { fetchOddsApiProps, getCreditUsageStatus } from '../agents/FeedAgent/oddsApi';
import { fetchOptimalProps, getRateLimitStatus } from '../agents/FeedAgent/optimal';
import { apiQuotaCoordinator } from './APIQuotaCoordinator';
import { requireSupabase } from '../utils/supabaseUtils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface LineShoppingConfig {
  maxConcurrentRequests: number;
  processingTimeoutMs: number;
  minEdgeThreshold: number; // Minimum +EV threshold (default 2%)
  quotaWarningThreshold: number; // API quota warning threshold (80%)
  cacheExpiryMs: number;
  enableRealTimeUpdates: boolean;
  enableCircuitBreaker: boolean;
}

export interface OddsComparison {
  propId: string;
  market: string;
  line: number;
  sport: string;
  player?: string;

  // Odds from different sources
  oddsApiPrice?: number;
  optimalPrice?: number;
  sgoPrice?: number; // From existing SGO data

  // Analysis results
  bestPrice: number;
  bestSource: string;
  edgeValue: number; // +EV percentage
  devigedEdge: number; // Devigged edge value
  impliedProbability: number;

  // Quality metrics
  dataFreshness: number; // Seconds since last update
  confidenceScore: number; // 0-1 confidence in pricing
  arbitrageOpportunity: boolean;

  // Metadata
  lastUpdated: Date;
  apiCallsUsed: number;
  processingTimeMs: number;
}

export interface LineShoppingResult {
  totalProps: number;
  edgeOpportunities: OddsComparison[];
  arbitrageOpportunities: OddsComparison[];
  apiQuotaUsage: {
    oddsApi: { used: number; limit: number; remaining: number };
    optimal: { used: number; limit: number; remaining: number };
  };
  processingStats: {
    totalTimeMs: number;
    avgTimePerProp: number;
    successRate: number;
    failureCount: number;
  };
  metadata: {
    timestamp: Date;
    sportsCovered: string[];
    marketsCovered: string[];
    freshDataPercentage: number;
  };
}

export interface QuotaManager {
  oddsApiUsed: number;
  oddsApiLimit: number;
  optimalUsed: number;
  optimalLimit: number;
  lastReset: Date;
  emergencyMode: boolean;
}

// ============================================================================
// LINE SHOPPING ENGINE CLASS
// ============================================================================

export class LineShoppingEngine extends EventEmitter {
  private config: LineShoppingConfig;
  private logger: any;
  private quotaManager: QuotaManager;
  private priceCache: Map<string, OddsComparison> = new Map();
  private processingQueue: Map<string, Promise<OddsComparison | null>> = new Map();
  private isProcessing: boolean = false;

  constructor(config?: Partial<LineShoppingConfig>) {
    super();

    this.config = {
      maxConcurrentRequests: 5,
      processingTimeoutMs: 4500, // <5 second target
      minEdgeThreshold: 2.0, // 2% minimum edge
      quotaWarningThreshold: 0.8, // 80% quota warning
      cacheExpiryMs: 300000, // 5 minutes
      enableRealTimeUpdates: true,
      enableCircuitBreaker: true,
      ...config
    };

    this.logger = createLogger('LineShoppingEngine');

    this.quotaManager = {
      oddsApiUsed: 0,
      oddsApiLimit: 500, // Free tier limit
      optimalUsed: 0,
      optimalLimit: 10000, // Premium tier
      lastReset: new Date(),
      emergencyMode: false
    };

    // Register circuit breakers for external APIs
    if (this.config.enableCircuitBreaker) {
      circuitBreaker.registerService('odds-api-line-shopping', {
        failureThreshold: 3,
        resetTimeoutMs: 30000,
        timeoutMs: 8000,
        retryAttempts: 2
      });

      circuitBreaker.registerService('optimal-api-line-shopping', {
        failureThreshold: 3,
        resetTimeoutMs: 30000,
        timeoutMs: 8000,
        retryAttempts: 2
      });
    }

    // Initialize quota tracking
    this.initializeQuotaTracking();

    this.logger.info('🛒 LineShoppingEngine initialized', {
      config: this.config,
      quotaLimits: {
        oddsApi: this.quotaManager.oddsApiLimit,
        optimal: this.quotaManager.optimalLimit
      }
    });
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  /**
   * Find best lines and +EV opportunities for a set of props
   */
  async findBestLines(
    propIds: string[],
    sport?: string,
    market?: string
  ): Promise<LineShoppingResult> {
    if (this.isProcessing) {
      throw new Error('LineShoppingEngine is currently processing. Please wait.');
    }

    const startTime = Date.now();
    this.isProcessing = true;

    try {
      this.logger.info('🔍 Starting line shopping analysis', {
        propCount: propIds.length,
        sport,
        market,
        quotaStatus: this.getQuotaStatus()
      });

      // Check quota availability
      if (this.quotaManager.emergencyMode) {
        this.logger.warn('⚠️ Emergency mode active - limited API usage');
      }

      // Process props in concurrent batches
      const edgeOpportunities: OddsComparison[] = [];
      const arbitrageOpportunities: OddsComparison[] = [];
      let totalApiCalls = 0;
      let failureCount = 0;

      // Split into batches for concurrent processing
      const batches = this.chunkArray(propIds, this.config.maxConcurrentRequests);

      for (const batch of batches) {
        const batchPromises = batch.map(propId =>
          this.processSingleProp(propId, sport, market)
        );

        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            const comparison = result.value;
            totalApiCalls += comparison.apiCallsUsed;

            // Check for edge opportunities
            if (comparison.edgeValue >= this.config.minEdgeThreshold) {
              edgeOpportunities.push(comparison);
            }

            // Check for arbitrage opportunities
            if (comparison.arbitrageOpportunity) {
              arbitrageOpportunities.push(comparison);

              // Store arbitrage opportunity in database
              await this.storeArbitrageOpportunity(
                [comparison.propId],
                comparison.edgeValue,
                [comparison.bestSource]
              );
            }
          } else {
            failureCount++;
            if (result.status === 'rejected') {
              this.logger.warn('❌ Prop processing failed', {
                error: result.reason?.message || 'Unknown error'
              });
            }
          }
        }

        // Rate limiting between batches
        if (batches.length > 1) {
          await this.sleep(1000);
        }
      }

      const totalTimeMs = Date.now() - startTime;
      const successCount = propIds.length - failureCount;

      // Emit events for monitoring
      this.emit('analysisComplete', {
        edgeOpportunities: edgeOpportunities.length,
        arbitrageOpportunities: arbitrageOpportunities.length,
        processingTime: totalTimeMs
      });

      // Log results
      this.logger.info('✅ Line shopping analysis complete', {
        processed: propIds.length,
        edgeOpportunities: edgeOpportunities.length,
        arbitrageOpportunities: arbitrageOpportunities.length,
        timeMs: totalTimeMs,
        avgTimePerProp: totalTimeMs / propIds.length,
        apiCallsUsed: totalApiCalls
      });

      return {
        totalProps: propIds.length,
        edgeOpportunities: edgeOpportunities.sort((a, b) => b.edgeValue - a.edgeValue),
        arbitrageOpportunities,
        apiQuotaUsage: {
          oddsApi: {
            used: this.quotaManager.oddsApiUsed,
            limit: this.quotaManager.oddsApiLimit,
            remaining: this.quotaManager.oddsApiLimit - this.quotaManager.oddsApiUsed
          },
          optimal: {
            used: this.quotaManager.optimalUsed,
            limit: this.quotaManager.optimalLimit,
            remaining: this.quotaManager.optimalLimit - this.quotaManager.optimalUsed
          }
        },
        processingStats: {
          totalTimeMs,
          avgTimePerProp: totalTimeMs / propIds.length,
          successRate: successCount / propIds.length,
          failureCount
        },
        metadata: {
          timestamp: new Date(),
          sportsCovered: sport ? [sport] : [...new Set(edgeOpportunities.map(o => o.sport))],
          marketsCovered: market ? [market] : [...new Set(edgeOpportunities.map(o => o.market))],
          freshDataPercentage: this.calculateFreshDataPercentage(edgeOpportunities)
        }
      };

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get real-time quota status
   */
  getQuotaStatus(): {
    oddsApi: { used: number; limit: number; percentage: number };
    optimal: { used: number; limit: number; percentage: number };
    emergencyMode: boolean;
  } {
    return {
      oddsApi: {
        used: this.quotaManager.oddsApiUsed,
        limit: this.quotaManager.oddsApiLimit,
        percentage: (this.quotaManager.oddsApiUsed / this.quotaManager.oddsApiLimit) * 100
      },
      optimal: {
        used: this.quotaManager.optimalUsed,
        limit: this.quotaManager.optimalLimit,
        percentage: (this.quotaManager.optimalUsed / this.quotaManager.optimalLimit) * 100
      },
      emergencyMode: this.quotaManager.emergencyMode
    };
  }

  /**
   * Clear cache and reset processing state
   */
  reset(): void {
    this.priceCache.clear();
    this.processingQueue.clear();
    this.isProcessing = false;
    this.logger.info('🔄 LineShoppingEngine reset');
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  /**
   * Process a single prop for line shopping
   */
  private async processSingleProp(
    propId: string,
    sport?: string,
    market?: string
  ): Promise<OddsComparison | null> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cached = this.getCachedComparison(propId);
      if (cached) {
        return cached;
      }

      // Check if already processing
      if (this.processingQueue.has(propId)) {
        return await this.processingQueue.get(propId)!;
      }

      // Create processing promise
      const processingPromise = this.executeLineShoppingForProp(propId, sport, market);
      this.processingQueue.set(propId, processingPromise);

      try {
        const result = await Promise.race([
          processingPromise,
          this.timeoutPromise(this.config.processingTimeoutMs)
        ]);

        if (result) {
          result.processingTimeMs = Date.now() - startTime;
          this.cacheComparison(propId, result);
        }

        return result;
      } finally {
        this.processingQueue.delete(propId);
      }

    } catch (error) {
      this.logger.error('❌ Error processing prop for line shopping', {
        propId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Execute the actual line shopping logic for a prop
   */
  private async executeLineShoppingForProp(
    propId: string,
    sport?: string,
    market?: string
  ): Promise<OddsComparison | null> {
    try {
      // Get base prop data from database
      const baseProp = await this.getBasePropData(propId);
      if (!baseProp) {
        this.logger.warn('⚠️ Base prop not found', { propId });
        return null;
      }

      const comparison: Partial<OddsComparison> = {
        propId,
        market: baseProp.market || market || 'unknown',
        line: baseProp.line || 0,
        sport: baseProp.sport || sport || 'unknown',
        player: baseProp.player_name,
        sgoPrice: baseProp.over || baseProp.under,
        lastUpdated: new Date(),
        apiCallsUsed: 0
      };

      let apiCallsUsed = 0;
      const oddsData: number[] = [];
      const sourcePrices: { source: string; price: number }[] = [];

      // Add SGO price if available
      if (comparison.sgoPrice) {
        oddsData.push(comparison.sgoPrice);
        sourcePrices.push({ source: 'sgo-api', price: comparison.sgoPrice });
      }

      // Fetch from OddsAPI if quota available
      if (this.shouldCallOddsApi()) {
        try {
          const oddsApiResult = await this.fetchOddsApiData(baseProp);
          if (oddsApiResult) {
            comparison.oddsApiPrice = oddsApiResult.price;
            oddsData.push(oddsApiResult.price);
            sourcePrices.push({ source: 'odds-api', price: oddsApiResult.price });
            apiCallsUsed += oddsApiResult.apiCallsUsed;
            this.updateQuotaUsage('oddsApi', oddsApiResult.apiCallsUsed);
          }
        } catch (error) {
          this.logger.warn('⚠️ OddsAPI fetch failed', {
            propId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Fetch from Optimal if quota available
      if (this.shouldCallOptimal()) {
        try {
          const optimalResult = await this.fetchOptimalData(baseProp);
          if (optimalResult) {
            comparison.optimalPrice = optimalResult.price;
            oddsData.push(optimalResult.price);
            sourcePrices.push({ source: 'optimal-api', price: optimalResult.price });
            apiCallsUsed += optimalResult.apiCallsUsed;
            this.updateQuotaUsage('optimal', optimalResult.apiCallsUsed);
          }
        } catch (error) {
          this.logger.warn('⚠️ Optimal fetch failed', {
            propId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Analyze odds if we have data from multiple sources
      if (oddsData.length < 2) {
        this.logger.debug('🔍 Insufficient data for comparison', {
          propId,
          sourcesFound: oddsData.length
        });
        return null;
      }

      // Calculate best price and edge
      const bestPrice = Math.max(...oddsData);
      const bestSource = sourcePrices.find(s => s.price === bestPrice)?.source || 'unknown';

      // Calculate edge value
      const averagePrice = oddsData.reduce((sum, price) => sum + price, 0) / oddsData.length;
      const impliedProbability = this.americanOddsToImpliedProbability(bestPrice);
      const averageImpliedProb = this.americanOddsToImpliedProbability(averagePrice);
      const edgeValue = ((impliedProbability / averageImpliedProb) - 1) * 100;

      // Calculate devigged edge (simplified calculation)
      const devigedEdge = this.calculateDevigedEdge(oddsData);

      // Check for arbitrage opportunity
      const arbitrageOpportunity = this.detectArbitrageOpportunity(sourcePrices);

      // Calculate confidence score based on data freshness and source count
      const confidenceScore = this.calculateConfidenceScore(
        oddsData.length,
        baseProp.created_at ? Date.now() - new Date(baseProp.created_at).getTime() : 0
      );

      const finalComparison: OddsComparison = {
        ...comparison as OddsComparison,
        bestPrice,
        bestSource,
        edgeValue,
        devigedEdge,
        impliedProbability,
        dataFreshness: baseProp.created_at ?
          (Date.now() - new Date(baseProp.created_at).getTime()) / 1000 : 0,
        confidenceScore,
        arbitrageOpportunity,
        apiCallsUsed,
        processingTimeMs: 0 // Will be set by caller
      };

      // Store line shopping results in database
      await this.storeBestOddsInDatabase(finalComparison, baseProp);

      return finalComparison;

    } catch (error) {
      this.logger.error('❌ Failed to execute line shopping', {
        propId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  // ============================================================================
  // API INTEGRATION METHODS
  // ============================================================================

  /**
   * Fetch odds from OddsAPI with circuit breaker protection
   */
  private async fetchOddsApiData(baseProp: any): Promise<{ price: number; apiCallsUsed: number } | null> {
    // Check API quota before making the call
    const quotaCheck = await apiQuotaCoordinator.requestAPIAccess(
      'odds-api',
      'line-shopping',
      8, // High priority
      { propId: baseProp.prop_id, sport: baseProp.sport }
    );

    if (!quotaCheck.allowed) {
      this.logger.warn('🚫 OddsAPI quota check failed', {
        propId: baseProp.prop_id,
        reason: quotaCheck.reason,
        waitTime: quotaCheck.waitTime
      });
      return null;
    }

    if (!this.config.enableCircuitBreaker) {
      // Direct call without circuit breaker
      return await this.directOddsApiCall(baseProp);
    }

    return await circuitBreaker.executeCall(
      'odds-api-line-shopping',
      () => this.directOddsApiCall(baseProp),
      () => {
        this.logger.warn('🚫 OddsAPI circuit breaker open, using fallback');
        return null;
      }
    );
  }

  /**
   * Direct OddsAPI call implementation
   */
  private async directOddsApiCall(baseProp: any): Promise<{ price: number; apiCallsUsed: number } | null> {
    try {
      // Map sport to OddsAPI format
      const sportKey = this.mapSportToOddsApiKey(baseProp.sport);
      if (!sportKey) {
        return null;
      }

      const props = await fetchOddsApiProps({
        sport: sportKey,
        markets: 'player_props',
        regions: 'us',
        oddsFormat: 'american'
      });

      // Find matching prop in results
      const matchingProp = this.findMatchingProp(props, baseProp);
      if (!matchingProp) {
        return null;
      }

      return {
        price: matchingProp.price,
        apiCallsUsed: 1 // OddsAPI counts as 1 call per request
      };

    } catch (error) {
      this.logger.error('❌ OddsAPI direct call failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Fetch odds from Optimal with circuit breaker protection
   */
  private async fetchOptimalData(baseProp: any): Promise<{ price: number; apiCallsUsed: number } | null> {
    // Check API quota before making the call
    const quotaCheck = await apiQuotaCoordinator.requestAPIAccess(
      'optimal-api',
      'line-shopping',
      9, // Highest priority for premium API
      { propId: baseProp.prop_id, sport: baseProp.sport }
    );

    if (!quotaCheck.allowed) {
      this.logger.warn('🚫 OptimalAPI quota check failed', {
        propId: baseProp.prop_id,
        reason: quotaCheck.reason,
        waitTime: quotaCheck.waitTime
      });
      return null;
    }

    if (!this.config.enableCircuitBreaker) {
      return await this.directOptimalCall(baseProp);
    }

    return await circuitBreaker.executeCall(
      'optimal-api-line-shopping',
      () => this.directOptimalCall(baseProp),
      () => {
        this.logger.warn('🚫 Optimal circuit breaker open, using fallback');
        return null;
      }
    );
  }

  /**
   * Direct Optimal API call implementation
   */
  private async directOptimalCall(baseProp: any): Promise<{ price: number; apiCallsUsed: number } | null> {
    try {
      const props = await fetchOptimalProps({
        sport: baseProp.sport,
        date: new Date().toISOString().split('T')[0]
      });

      const matchingProp = this.findMatchingProp(props, baseProp);
      if (!matchingProp) {
        return null;
      }

      return {
        price: matchingProp.price,
        apiCallsUsed: 1 // Assume 1 call per request
      };

    } catch (error) {
      this.logger.error('❌ Optimal direct call failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // ============================================================================
  // QUOTA MANAGEMENT METHODS
  // ============================================================================

  /**
   * Initialize quota tracking
   */
  private async initializeQuotaTracking(): Promise<void> {
    try {
      // Get current OddsAPI usage
      const oddsApiStatus = await getCreditUsageStatus();
      if (oddsApiStatus) {
        this.quotaManager.oddsApiUsed = oddsApiStatus.used || 0;
        this.quotaManager.oddsApiLimit = oddsApiStatus.limit || 500;
      }

      // Get current Optimal usage
      const optimalStatus = await getRateLimitStatus();
      if (optimalStatus) {
        this.quotaManager.optimalUsed = optimalStatus.used || 0;
        this.quotaManager.optimalLimit = optimalStatus.limit || 10000;
      }

      // Check if emergency mode should be activated
      this.checkEmergencyMode();

      this.logger.info('📊 Quota tracking initialized', {
        oddsApi: `${this.quotaManager.oddsApiUsed}/${this.quotaManager.oddsApiLimit}`,
        optimal: `${this.quotaManager.optimalUsed}/${this.quotaManager.optimalLimit}`,
        emergencyMode: this.quotaManager.emergencyMode
      });

    } catch (error) {
      this.logger.warn('⚠️ Failed to initialize quota tracking', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update quota usage
   */
  private updateQuotaUsage(api: 'oddsApi' | 'optimal', callsUsed: number): void {
    if (api === 'oddsApi') {
      this.quotaManager.oddsApiUsed += callsUsed;
    } else {
      this.quotaManager.optimalUsed += callsUsed;
    }

    this.checkEmergencyMode();

    // Emit quota warning if approaching limit
    const oddsApiPercentage = (this.quotaManager.oddsApiUsed / this.quotaManager.oddsApiLimit);
    const optimalPercentage = (this.quotaManager.optimalUsed / this.quotaManager.optimalLimit);

    if (oddsApiPercentage >= this.config.quotaWarningThreshold) {
      this.emit('quotaWarning', {
        api: 'oddsApi',
        usage: this.quotaManager.oddsApiUsed,
        limit: this.quotaManager.oddsApiLimit,
        percentage: oddsApiPercentage * 100
      });
    }

    if (optimalPercentage >= this.config.quotaWarningThreshold) {
      this.emit('quotaWarning', {
        api: 'optimal',
        usage: this.quotaManager.optimalUsed,
        limit: this.quotaManager.optimalLimit,
        percentage: optimalPercentage * 100
      });
    }
  }

  /**
   * Check if emergency mode should be activated
   */
  private checkEmergencyMode(): void {
    const oddsApiPercentage = this.quotaManager.oddsApiUsed / this.quotaManager.oddsApiLimit;
    const optimalPercentage = this.quotaManager.optimalUsed / this.quotaManager.optimalLimit;

    const shouldActivateEmergency = oddsApiPercentage >= 0.95 || optimalPercentage >= 0.95;

    if (shouldActivateEmergency && !this.quotaManager.emergencyMode) {
      this.quotaManager.emergencyMode = true;
      this.logger.warn('🚨 Emergency mode ACTIVATED - API quotas nearly exhausted');
      this.emit('emergencyModeActivated', this.getQuotaStatus());
    } else if (!shouldActivateEmergency && this.quotaManager.emergencyMode) {
      this.quotaManager.emergencyMode = false;
      this.logger.info('✅ Emergency mode DEACTIVATED - API quotas restored');
      this.emit('emergencyModeDeactivated', this.getQuotaStatus());
    }
  }

  /**
   * Check if we should call OddsAPI based on quota
   */
  private shouldCallOddsApi(): boolean {
    if (this.quotaManager.emergencyMode) {
      return false;
    }

    const percentage = this.quotaManager.oddsApiUsed / this.quotaManager.oddsApiLimit;
    return percentage < 0.9; // Stop at 90% usage
  }

  /**
   * Check if we should call Optimal based on quota
   */
  private shouldCallOptimal(): boolean {
    if (this.quotaManager.emergencyMode) {
      return false;
    }

    const percentage = this.quotaManager.optimalUsed / this.quotaManager.optimalLimit;
    return percentage < 0.9; // Stop at 90% usage
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get base prop data from database
   */
  private async getBasePropData(propId: string): Promise<any> {
    try {
      if (!supabaseClient) {
        throw new Error('Database client not configured');
      }

      const supa1 = requireSupabase();
      const { data, error } = await supa1
        .from('sports_game_odds')
        .select('*')
        .eq('id', propId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('❌ Failed to get base prop data', {
        propId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Calculate devigged edge value
   */
  private calculateDevigedEdge(odds: number[]): number {
    // Simplified devigging calculation
    // In a real implementation, this would use proper devigging algorithms
    const impliedProbs = odds.map(odd => this.americanOddsToImpliedProbability(odd));
    const avgImpliedProb = impliedProbs.reduce((sum, prob) => sum + prob, 0) / impliedProbs.length;

    // Remove typical vig (assume 4.5% total vig)
    const vigAdjustment = 0.045 / 2; // Split vig between both sides
    const devigedProb = avgImpliedProb - vigAdjustment;

    return Math.max(0, devigedProb * 100);
  }

  /**
   * Convert American odds to implied probability
   */
  private americanOddsToImpliedProbability(americanOdds: number): number {
    if (americanOdds > 0) {
      return 100 / (americanOdds + 100);
    } else {
      return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
    }
  }

  /**
   * Detect arbitrage opportunity
   */
  private detectArbitrageOpportunity(sourcePrices: { source: string; price: number }[]): boolean {
    if (sourcePrices.length < 2) {
      return false;
    }

    // For arbitrage, we need both sides of the bet
    // This is a simplified check - real implementation would need more complex logic
    const priceSpread = Math.max(...sourcePrices.map(s => s.price)) -
                       Math.min(...sourcePrices.map(s => s.price));

    return priceSpread > 50; // If price difference > 50 points, potential arbitrage
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(sourceCount: number, dataAgeMs: number): number {
    // Base score from number of sources
    let score = Math.min(sourceCount / 3, 1); // Perfect score with 3+ sources

    // Reduce score based on data age
    const ageMinutes = dataAgeMs / (1000 * 60);
    if (ageMinutes > 30) {
      score *= 0.5; // 50% penalty for data older than 30 minutes
    } else if (ageMinutes > 10) {
      score *= 0.8; // 20% penalty for data older than 10 minutes
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate fresh data percentage
   */
  private calculateFreshDataPercentage(comparisons: OddsComparison[]): number {
    if (comparisons.length === 0) {
      return 0;
    }

    const freshThresholdMs = 5 * 60 * 1000; // 5 minutes
    const freshCount = comparisons.filter(c => c.dataFreshness * 1000 < freshThresholdMs).length;

    return (freshCount / comparisons.length) * 100;
  }

  /**
   * Map sport to OddsAPI key
   */
  private mapSportToOddsApiKey(sport: string): string | null {
    const mapping: Record<string, string> = {
      'NFL': 'americanfootball_nfl',
      'NBA': 'basketball_nba',
      'MLB': 'baseball_mlb',
      'NHL': 'icehockey_nhl',
      'NCAAF': 'americanfootball_ncaaf',
      'NCAAB': 'basketball_ncaab',
      'WNBA': 'basketball_wnba'
    };

    return mapping[sport.toUpperCase()] || null;
  }

  /**
   * Find matching prop in API results
   */
  private findMatchingProp(props: any[], baseProp: any): { price: number } | null {
    // This is a simplified matching algorithm
    // Real implementation would need sophisticated prop matching logic
    for (const prop of props) {
      if (prop.player_name === baseProp.player_name &&
          prop.market === baseProp.market &&
          Math.abs(prop.line - baseProp.line) < 0.5) {
        return {
          price: prop.over_odds || prop.under_odds || prop.odds
        };
      }
    }

    return null;
  }

  /**
   * Get cached comparison
   */
  private getCachedComparison(propId: string): OddsComparison | null {
    const cached = this.priceCache.get(propId);
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const ageMs = Date.now() - cached.lastUpdated.getTime();
    if (ageMs > this.config.cacheExpiryMs) {
      this.priceCache.delete(propId);
      return null;
    }

    return cached;
  }

  /**
   * Cache comparison result
   */
  private cacheComparison(propId: string, comparison: OddsComparison): void {
    this.priceCache.set(propId, comparison);

    // Cleanup old cache entries periodically
    if (this.priceCache.size > 1000) {
      const oldestEntries = Array.from(this.priceCache.entries())
        .sort(([,a], [,b]) => a.lastUpdated.getTime() - b.lastUpdated.getTime())
        .slice(0, 200);

      oldestEntries.forEach(([key]) => this.priceCache.delete(key));
    }
  }

  /**
   * Timeout promise helper
   */
  private timeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Store best odds data in database
   */
  private async storeBestOddsInDatabase(comparison: OddsComparison, baseProp: any): Promise<void> {
    try {
      if (!supabaseClient) {
        this.logger.warn('Supabase client not available, skipping database storage');
        return;
      }

      // Get the raw_props ID for the prop_id
      const supa2 = requireSupabase();
      const { data: propData, error: propError } = await supa2
        .from('sports_game_odds')
        .select('id')
        .eq('prop_id', comparison.propId)
        .single();

      if (propError || !propData) {
        this.logger.warn('Raw prop not found for best odds storage', {
          propId: comparison.propId,
          error: propError?.message
        });
        return;
      }

      // Store each source's odds
      const oddsEntries = [];

      if (comparison.oddsApiPrice) {
        oddsEntries.push({
          prop_id: propData.id,
          source: 'odds-api',
          odds: comparison.oddsApiPrice,
          edge_pct: comparison.bestSource === 'odds-api' ? comparison.edgeValue : null,
          is_best_available: comparison.bestSource === 'odds-api',
          captured_at: new Date().toISOString(),
          market_status: 'active'
        });
      }

      if (comparison.optimalPrice) {
        oddsEntries.push({
          prop_id: propData.id,
          source: 'optimal-api',
          odds: comparison.optimalPrice,
          edge_pct: comparison.bestSource === 'optimal-api' ? comparison.edgeValue : null,
          is_best_available: comparison.bestSource === 'optimal-api',
          captured_at: new Date().toISOString(),
          market_status: 'active'
        });
      }

      if (comparison.sgoPrice) {
        oddsEntries.push({
          prop_id: propData.id,
          source: 'sgo-api',
          odds: comparison.sgoPrice,
          edge_pct: comparison.bestSource === 'sgo-api' ? comparison.edgeValue : null,
          is_best_available: comparison.bestSource === 'sgo-api',
          captured_at: new Date().toISOString(),
          market_status: 'active'
        });
      }

      if (oddsEntries.length > 0) {
        const supa3 = requireSupabase();
      const { error } = await supa3
          .from('best_odds')
          .insert(oddsEntries);

        if (error) {
          this.logger.error('Failed to store best odds in database', {
            propId: comparison.propId,
            error: error.message
          });
        } else {
          this.logger.debug('Best odds stored in database', {
            propId: comparison.propId,
            entriesStored: oddsEntries.length,
            bestSource: comparison.bestSource
          });
        }
      }
    } catch (error) {
      this.logger.error('Error storing best odds in database', {
        propId: comparison.propId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Store arbitrage opportunities in database
   */
  private async storeArbitrageOpportunity(propIds: string[], profitMargin: number, books: string[]): Promise<void> {
    try {
      if (!supabaseClient) {
        return;
      }

      // Get raw_props IDs for the prop_ids
      const supa4 = requireSupabase();
      const { data: propData, error: propError } = await supa4
        .from('sports_game_odds')
        .select('id, prop_id')
        .in('prop_id', propIds);

      if (propError || !propData || propData.length === 0) {
        this.logger.warn('Props not found for arbitrage storage', { propIds });
        return;
      }

      const rawPropIds = propData.map(p => p.id);

      const supa5 = requireSupabase();
      const { error } = await supa5
        .from('arbitrage_opportunities')
        .insert({
          prop_ids: rawPropIds,
          combined_odds: {},
          profit_margin: profitMargin,
          expiry_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          status: 'active',
          books_involved: books,
          risk_level: profitMargin > 5 ? 'low' : profitMargin > 2 ? 'medium' : 'high',
          detected_at: new Date().toISOString()
        });

      if (error) {
        this.logger.error('Failed to store arbitrage opportunity', {
          propIds,
          error: error.message
        });
      } else {
        this.logger.info('Arbitrage opportunity stored', {
          propIds,
          profitMargin,
          books
        });
      }
    } catch (error) {
      this.logger.error('Error storing arbitrage opportunity', {
        propIds,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export singleton instance for global use
export const lineShoppingEngine = new LineShoppingEngine();

// Export factory function for custom configurations
export const createLineShoppingEngine = (config?: Partial<LineShoppingConfig>) =>
  new LineShoppingEngine(config);