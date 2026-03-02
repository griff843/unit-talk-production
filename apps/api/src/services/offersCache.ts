/**
 * Offers Cache for Market Data
 * Sprint: MARKET-DATA-INGESTION-WIREUP-002
 *
 * TTL-based caching for provider offers to reduce API calls.
 * Uses productionRedis with fallback to memory cache.
 */

import { logger } from '../shared/logger';

import { productionRedis } from './productionRedis';

// Cache TTL in seconds (90s per spec)
const OFFERS_CACHE_TTL_SECONDS = 90;

// Key prefix for offers cache
const OFFERS_KEY_PREFIX = 'offers:v3:';

export interface CachedOffers {
  sportKey: string;
  markets: string[];
  offers: ProviderOfferPayload[];
  cachedAt: string;
  expiresAt: string;
}

export interface ProviderOfferPayload {
  provider_key: string;
  provider_event_id: string;
  provider_market_key: string;
  provider_participant_id?: string;
  line?: number;
  over_odds?: number;
  under_odds?: number;
  home_odds?: number;
  away_odds?: number;
  yes_odds?: number;
  no_odds?: number;
  snapshot_at: string;
}

/**
 * Generate cache key for sport/markets combo
 */
function getCacheKey(sportKey: string, markets: string[]): string {
  const marketsSorted = [...markets].sort().join(',');
  return `${OFFERS_KEY_PREFIX}${sportKey}:${marketsSorted}`;
}

/**
 * Get cached offers for a sport/markets combo
 * Returns null if not cached or expired
 */
export async function getCachedOffers(
  sportKey: string,
  markets: string[]
): Promise<CachedOffers | null> {
  const key = getCacheKey(sportKey, markets);

  try {
    const cached = await productionRedis.get(key);
    if (!cached) {
      return null;
    }

    const parsed: CachedOffers = JSON.parse(cached);

    // Double-check expiry (Redis TTL is authoritative, but belt and suspenders)
    if (new Date(parsed.expiresAt) < new Date()) {
      logger.debug('Offers cache expired (local check)', { sportKey, markets });
      return null;
    }

    logger.debug('Offers cache HIT', {
      sportKey,
      markets,
      offerCount: parsed.offers.length,
      cachedAt: parsed.cachedAt,
    });

    return parsed;
  } catch (error) {
    logger.warn('Error reading offers cache', {
      key,
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Cache offers for a sport/markets combo
 */
export async function setCachedOffers(
  sportKey: string,
  markets: string[],
  offers: ProviderOfferPayload[]
): Promise<void> {
  const key = getCacheKey(sportKey, markets);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OFFERS_CACHE_TTL_SECONDS * 1000);

  const cacheEntry: CachedOffers = {
    sportKey,
    markets,
    offers,
    cachedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  try {
    await productionRedis.set(key, JSON.stringify(cacheEntry), OFFERS_CACHE_TTL_SECONDS);

    logger.debug('Offers cached', {
      sportKey,
      markets,
      offerCount: offers.length,
      ttlSeconds: OFFERS_CACHE_TTL_SECONDS,
    });
  } catch (error) {
    logger.warn('Error writing offers cache', {
      key,
      error: (error as Error).message,
    });
    // Fail-open: don't throw, just log
  }
}

/**
 * Invalidate cache for a sport/markets combo
 */
export async function invalidateOffers(sportKey: string, markets: string[]): Promise<void> {
  const key = getCacheKey(sportKey, markets);

  try {
    await productionRedis.del(key);
    logger.debug('Offers cache invalidated', { sportKey, markets });
  } catch (error) {
    logger.warn('Error invalidating offers cache', {
      key,
      error: (error as Error).message,
    });
  }
}

/**
 * Check if offers are cached (without fetching)
 */
export async function hasOffersCached(sportKey: string, markets: string[]): Promise<boolean> {
  const key = getCacheKey(sportKey, markets);
  return productionRedis.exists(key);
}

/**
 * Get cache TTL constant (for external reference)
 */
export function getOffersCacheTTL(): number {
  return OFFERS_CACHE_TTL_SECONDS;
}
