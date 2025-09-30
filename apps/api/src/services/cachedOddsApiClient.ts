import { ProductionRedisService } from './productionRedis';
import { fetchOddsApiProps, getCreditUsageStatus } from '../agents/FeedAgent/oddsApi';
import { fetchAndFlattenSGOProps } from '../logic/providers/sgoFetcher';
import { fetchOptimalProps } from '../agents/FeedAgent/optimal';
import { logger } from '../shared/logger';

export interface CachedApiCall {
  source: 'odds-api' | 'sgo-api' | 'optimal-api';
  sport: string;
  market?: string;
  params?: Record<string, any>;
}

export interface CacheResult<T = any> {
  data: T;
  fromCache: boolean;
  source: string;
  creditUsed: number;
  cacheKey: string;
  timestamp: string;
}

export interface CreditUsage {
  oddsApi: { used: number; remaining: number };
  sgo: { status: string };
  optimal: { status: string };
}

/**
 * Cache-First Odds API Client
 * Provides Redis-first caching for all provider calls with credit usage tracking
 */
export class CachedOddsApiClient {
  private static instance: CachedOddsApiClient;
  private redis: ProductionRedisService;

  // Credit usage tracking
  private creditUsage: { [key: string]: number } = {};
  private lastCreditCheck = 0;

  // Cache configuration
  private readonly CACHE_TTL_SECONDS = 300; // 5 minutes for market data
  private readonly CREDIT_CHECK_INTERVAL = 60 * 1000; // Check credits every minute

  private constructor() {
    this.redis = ProductionRedisService.getInstance();

    // Start periodic credit usage reset
    setInterval(() => {
      this.resetCreditUsage();
    }, 60 * 60 * 1000); // Reset every hour

    logger.info('CachedOddsApiClient initialized');
  }

  public static getInstance(): CachedOddsApiClient {
    if (!CachedOddsApiClient.instance) {
      CachedOddsApiClient.instance = new CachedOddsApiClient();
    }
    return CachedOddsApiClient.instance;
  }

  /**
   * Generate cache key for API calls
   */
  private generateCacheKey(call: CachedApiCall): string {
    const keyParts = [
      'provider_data',
      call.source,
      call.sport,
      call.market || 'default'
    ];

    if (call.params) {
      const paramHash = Buffer.from(JSON.stringify(call.params)).toString('base64');
      keyParts.push(paramHash);
    }

    return keyParts.join(':');
  }

  /**
   * Check cache first, then make API call if needed
   */
  public async getCachedData<T = any>(call: CachedApiCall): Promise<CacheResult<T>> {
    const cacheKey = this.generateCacheKey(call);
    const startTime = Date.now();

    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached) as T;

        logger.debug('Cache hit for provider data', {
          source: call.source,
          sport: call.sport,
          cacheKey: cacheKey.substring(0, 50) + '...'
        });

        return {
          data: parsedData,
          fromCache: true,
          source: call.source,
          creditUsed: 0,
          cacheKey,
          timestamp: new Date().toISOString()
        };
      }

      // Cache miss - make API call
      logger.info('Cache miss, making API call', {
        source: call.source,
        sport: call.sport,
        market: call.market
      });

      const result = await this.makeApiCall<T>(call);

      // Cache the result
      await this.redis.set(cacheKey, JSON.stringify(result.data), this.CACHE_TTL_SECONDS);

      // Track credit usage
      this.trackCreditUsage(call.source, 1);

      const responseTime = Date.now() - startTime;

      logger.info('API call completed and cached', {
        source: call.source,
        sport: call.sport,
        responseTime,
        dataSize: Array.isArray(result.data) ? result.data.length : 1,
        creditUsed: result.creditUsed
      });

      return {
        ...result,
        fromCache: false,
        cacheKey,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Cached API call failed', {
        source: call.source,
        sport: call.sport,
        error: error instanceof Error ? error.message : String(error),
        cacheKey
      });

      throw error;
    }
  }

  /**
   * Make the actual API call based on source
   */
  private async makeApiCall<T>(call: CachedApiCall): Promise<{ data: T; source: string; creditUsed: number }> {
    switch (call.source) {
      case 'odds-api':
        return await this.callOddsApi<T>(call);

      case 'sgo-api':
        return await this.callSgoApi<T>(call);

      case 'optimal-api':
        return await this.callOptimalApi<T>(call);

      default:
        throw new Error(`Unsupported API source: ${call.source}`);
    }
  }

  /**
   * Call Odds API with event-first architecture
   */
  private async callOddsApi<T>(call: CachedApiCall): Promise<{ data: T; source: string; creditUsed: number }> {
    try {
      // Map sport to odds API key
      const sportKey = this.getSportKeyForOddsApi(call.sport);

      // Determine markets - support both old single market and new multi-market
      let markets: string[] = ['h2h', 'spreads', 'totals']; // Default

      if (call.market) {
        // Legacy single market support
        markets = [call.market];
      } else if (call.params?.markets && Array.isArray(call.params.markets)) {
        // New multi-market support
        markets = call.params.markets;
      }

      // Extract additional params
      const regions = call.params?.regions || 'us';
      const oddsFormat = call.params?.oddsFormat || 'american';
      const dateFormat = call.params?.dateFormat || 'iso';
      const daysFrom = call.params?.daysFrom || 1;

      // Use new event-first flow
      const data = await fetchOddsApiProps(
        sportKey as any,
        markets,
        regions,
        oddsFormat as 'decimal' | 'american',
        dateFormat as 'iso' | 'unix',
        daysFrom
      );

      return {
        data: data as T,
        source: 'odds-api',
        creditUsed: 1 // Each event-first batch uses credits
      };
    } catch (error) {
      logger.error('Odds API call failed', {
        sport: call.sport,
        market: call.market,
        params: call.params,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Call SGO API
   */
  private async callSgoApi<T>(call: CachedApiCall): Promise<{ data: T; source: string; creditUsed: number }> {
    try {
      const apiKey = process.env.SGO_API_KEY;
      if (!apiKey) {
        throw new Error('SGO_API_KEY not configured');
      }

      const leagueID = this.getLeagueIdForSgo(call.sport);

      const data = await fetchAndFlattenSGOProps({
        apiKey,
        leagueID,
        oddsAvailable: true,
        limit: call.params?.limit || 100
      });

      return {
        data: data as T,
        source: 'sgo-api',
        creditUsed: 1 // SGO charges per call
      };
    } catch (error) {
      logger.error('SGO API call failed', {
        sport: call.sport,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Call Optimal API
   */
  private async callOptimalApi<T>(call: CachedApiCall): Promise<{ data: T; source: string; creditUsed: number }> {
    try {
      const data = await fetchOptimalProps(call.sport, call.params?.date);

      return {
        data: data as T,
        source: 'optimal-api',
        creditUsed: 1 // Optimal charges per call
      };
    } catch (error) {
      logger.error('Optimal API call failed', {
        sport: call.sport,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Track credit usage per source
   */
  private trackCreditUsage(source: string, credits: number): void {
    if (!this.creditUsage[source]) {
      this.creditUsage[source] = 0;
    }
    this.creditUsage[source] += credits;

    logger.debug('Credit usage updated', {
      source,
      creditsUsed: credits,
      totalUsed: this.creditUsage[source]
    });
  }

  /**
   * Get current credit usage
   */
  public async getCreditUsage(): Promise<CreditUsage> {
    try {
      // Get real-time credit status from Odds API
      const oddsApiStatus = await getCreditUsageStatus();

      return {
        oddsApi: {
          used: oddsApiStatus.monthlyUsed,
          remaining: oddsApiStatus.monthlyLimit - oddsApiStatus.monthlyUsed
        },
        sgo: {
          status: 'Active - API calls tracked'
        },
        optimal: {
          status: 'API key expired - needs renewal'
        }
      };
    } catch (error) {
      logger.warn('Failed to get credit usage', { error: (error as Error).message });

      return {
        oddsApi: { used: 0, remaining: 0 },
        sgo: { status: 'Status check failed' },
        optimal: { status: 'API key expired - needs renewal' }
      };
    }
  }

  /**
   * Reset hourly credit usage tracking
   */
  private resetCreditUsage(): void {
    const previousUsage = { ...this.creditUsage };
    this.creditUsage = {};

    logger.info('Hourly credit usage reset', {
      previousHourUsage: previousUsage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get sport key mapping for Odds API
   */
  private getSportKeyForOddsApi(sport: string): string {
    const mapping: { [key: string]: string } = {
      'NFL': 'americanfootball_nfl',
      'NBA': 'basketball_nba',
      'MLB': 'baseball_mlb',
      'NHL': 'icehockey_nhl',
      'NCAAF': 'americanfootball_ncaaf',
      'NCAAB': 'basketball_ncaab',
      'WNBA': 'basketball_wnba',
      'EPL': 'soccer_epl',
      'ATP': 'tennis_atp'
    };

    return mapping[sport.toUpperCase()] || sport.toLowerCase();
  }

  /**
   * Get league ID mapping for SGO API
   */
  private getLeagueIdForSgo(sport: string): string {
    const mapping: { [key: string]: string } = {
      'NFL': 'NFL',
      'NBA': 'NBA',
      'MLB': 'MLB',
      'NHL': 'NHL',
      'NCAAF': 'NCAAF',
      'WNBA': 'WNBA'
    };

    const leagueId = mapping[sport.toUpperCase()];
    if (!leagueId) {
      throw new Error(`Unsupported sport for SGO: ${sport}`);
    }

    return leagueId;
  }

  /**
   * Warm up cache with frequently requested data
   */
  public async warmupCache(sports: string[] = ['NFL', 'NBA', 'MLB', 'NHL'], providers?: string[]): Promise<void> {
    logger.info('🔥 Starting cache warmup', {
      sports: sports,
      providersSpecified: providers || ['auto-detect'],
      totalSports: sports.length,
      timestamp: new Date().toISOString()
    });

    const warmupPromises = sports.map(async (sport) => {
      try {
        // Warm up with provider-aware source for each sport
        const primarySource = this.getProviderAwareSource(sport, providers);

        if (!primarySource) {
          logger.warn('⚠️ No available provider for sport, skipping warmup', {
            sport,
            providersSpecified: providers,
            availableProviders: ['odds-api', 'sgo-api', 'optimal-api']
          });
          return;
        }

        logger.info('🌡️ Warming cache for sport', { sport, source: primarySource });

        // Use core markets for warmup (not player-props which is invalid)
        await this.getCachedData({
          source: primarySource,
          sport,
          params: {
            markets: ['h2h', 'spreads', 'totals'], // Core markets
            regions: 'us',
            oddsFormat: 'american',
            dateFormat: 'iso',
            daysFrom: 1
          }
        });

        logger.info('✅ Cache warmed successfully', { sport, source: primarySource });
      } catch (error) {
        logger.error('❌ Cache warmup failed for sport', {
          sport,
          error: error instanceof Error ? error.message : String(error),
          providersSpecified: providers
        });
      }
    });

    const results = await Promise.allSettled(warmupPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info('🎯 Cache warmup completed', {
      totalSports: sports.length,
      successful,
      failed,
      successRate: `${((successful / sports.length) * 100).toFixed(1)}%`,
      duration: `${Date.now() - Date.parse(new Date().toISOString())}ms`
    });
  }

  /**
   * Get primary source for a sport based on routing config
   */
  private getPrimarySource(sport: string): 'odds-api' | 'sgo-api' | 'optimal-api' {
    // Match the routing logic from dataSourceRouter
    switch (sport.toUpperCase()) {
      case 'NCAAF':
      case 'NCAAB':
      case 'WNBA':
      case 'EPL':
      case 'ATP':
        return 'odds-api';

      default:
        return 'sgo-api'; // SGO is primary for major sports
    }
  }

  /**
   * Get provider-aware source for a sport respecting enabled providers
   */
  private getProviderAwareSource(sport: string, providers?: string[]): 'odds-api' | 'sgo-api' | 'optimal-api' | null {
    if (!providers || providers.length === 0) {
      // No provider restrictions, use default logic but prefer odds-api
      return 'odds-api';
    }

    // Provider priority: try primary source first, then fallback to available providers
    const defaultSource = this.getPrimarySource(sport);

    // Map provider names to API source names
    const providerMap: Record<string, 'odds-api' | 'sgo-api' | 'optimal-api'> = {
      'odds-api': 'odds-api',
      'oddsapi': 'odds-api',
      'sgo-api': 'sgo-api',
      'sgo': 'sgo-api',
      'optimal-api': 'optimal-api',
      'optimal': 'optimal-api'
    };

    // First, try the default source if it's in the providers list
    const normalizedProviders = providers.map(p => p.toLowerCase());
    for (const [key, value] of Object.entries(providerMap)) {
      if (normalizedProviders.includes(key) && value === defaultSource) {
        return value;
      }
    }

    // Fallback: use first available provider
    for (const provider of normalizedProviders) {
      if (providerMap[provider]) {
        return providerMap[provider];
      }
    }

    return null; // No valid providers found
  }

  /**
   * Health check for cached client
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      const redisHealth = await this.redis.healthCheck();
      const creditStatus = await this.getCreditUsage();

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!redisHealth) {
        status = 'degraded';
      }

      // Check if we're running low on credits
      if (creditStatus.oddsApi.remaining < 100) {
        status = status === 'healthy' ? 'degraded' : 'unhealthy';
      }

      return {
        status,
        details: {
          redis: redisHealth,
          creditUsage: creditStatus,
          hourlyUsage: this.creditUsage,
          cacheStatus: this.redis.getConnectionStatus()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Clear cache for specific source and sport
   */
  public async clearCache(source?: string, sport?: string): Promise<void> {
    logger.info('Clearing cached data', { source, sport });

    if (source && sport) {
      const cacheKey = this.generateCacheKey({ source: source as any, sport });
      await this.redis.del(cacheKey);
    } else {
      // For broader cache clearing, we'd need to implement pattern matching
      logger.warn('Broad cache clearing not implemented - use specific source/sport');
    }
  }
}

// Export singleton instance
export const cachedOddsApiClient = CachedOddsApiClient.getInstance();