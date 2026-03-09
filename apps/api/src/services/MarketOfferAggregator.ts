/**
 * Market Offer Aggregator
 * Sprint: SPRINT-MULTI-BOOK-MARKET-LAYER-020
 *
 * Groups NormalizedMarketOffer[] by composite key (eventId, player, statType, line)
 * and converts to BookOffer[] for the probability layer's consensus computation.
 *
 * Dual-path resolution:
 *   1. DB-first: fetchBookOffers() from provider_offers (offers persisted by ingestion)
 *   2. In-memory: aggregate from NormalizedMarketOffer[] (direct API fetch, not yet persisted)
 *   3. Single-book fallback: caller constructs one BookOffer from raw_prop (fail-closed preserved)
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { fetchBookOffers } from '../lib/probability/offerFetch';
import { createLogger } from '../utils/logger';

import type { BookOffer } from '../lib/probability/devigConsensus';
import type { FetchOffersParams } from '../lib/probability/offerFetch';
import type { NormalizedMarketOffer } from '../logic/providers/marketAdapters/types';

const logger = createLogger('MarketOfferAggregator');

/** Aggregated market consensus for a unique market */
export interface MarketConsensus {
  key: string;
  bookOffers: BookOffer[];
  providers: string[];
  snapshotRange: { earliest: string; latest: string };
}

export class MarketOfferAggregator {
  private static instance: MarketOfferAggregator;

  static getInstance(): MarketOfferAggregator {
    if (!MarketOfferAggregator.instance) {
      MarketOfferAggregator.instance = new MarketOfferAggregator();
    }
    return MarketOfferAggregator.instance;
  }

  /**
   * Primary path: fetch BookOffer[] from provider_offers via existing fetchBookOffers().
   * Returns whatever the DB has — caller checks length for MIN_BOOKS_FOR_CONSENSUS.
   */
  async aggregateFromDB(
    supabase: SupabaseClient,
    eventId: string,
    marketTypeId: number,
    participantId: string | null
  ): Promise<BookOffer[]> {
    if (!eventId || !marketTypeId) {
      logger.warn('aggregateFromDB called with missing eventId or marketTypeId');
      return [];
    }

    const params: FetchOffersParams = {
      eventId,
      marketTypeId,
      participantId,
      maxAgeHours: 12,
    };

    try {
      const offers = await fetchBookOffers(supabase, params);
      if (offers.length > 0) {
        logger.info(
          `DB-first: ${offers.length} book offer(s) for event=${eventId} market=${marketTypeId}`
        );
      }
      return offers;
    } catch (err) {
      logger.error('aggregateFromDB failed', err);
      return [];
    }
  }

  /**
   * Secondary path: aggregate in-memory NormalizedMarketOffer[] into MarketConsensus groups.
   * Used when offers haven't been persisted to provider_offers yet.
   */
  aggregateFromOffers(offers: NormalizedMarketOffer[]): Map<string, MarketConsensus> {
    const groups = new Map<string, MarketConsensus>();

    for (const offer of offers) {
      const key = buildGroupKey(offer);
      let group = groups.get(key);

      if (!group) {
        group = {
          key,
          bookOffers: [],
          providers: [],
          snapshotRange: { earliest: offer.snapshotAt, latest: offer.snapshotAt },
        };
        groups.set(key, group);
      }

      // Deduplicate — skip if this provider already contributed to this group
      if (group.providers.includes(offer.providerId)) continue;

      group.bookOffers.push(toBookOffer(offer));
      group.providers.push(offer.providerId);

      // Update snapshot range
      if (offer.snapshotAt < group.snapshotRange.earliest) {
        group.snapshotRange.earliest = offer.snapshotAt;
      }
      if (offer.snapshotAt > group.snapshotRange.latest) {
        group.snapshotRange.latest = offer.snapshotAt;
      }
    }

    return groups;
  }

  /**
   * Convert a single NormalizedMarketOffer to BookOffer format
   * for direct use in computeProbabilityLayer().
   */
  toBookOffer(offer: NormalizedMarketOffer): BookOffer {
    return toBookOffer(offer);
  }
}

/** Build composite group key for aggregation */
function buildGroupKey(offer: NormalizedMarketOffer): string {
  return `${offer.eventId}|${offer.player ?? ''}|${offer.statType}|${offer.line}`;
}

/** Convert NormalizedMarketOffer → BookOffer */
function toBookOffer(offer: NormalizedMarketOffer): BookOffer {
  return {
    bookId: offer.providerId,
    bookName: offer.providerName,
    overOdds: offer.overOdds,
    underOdds: offer.underOdds,
    bookProfile: offer.bookProfile,
    liquidityTier: offer.liquidityTier,
    dataQuality: offer.dataQuality,
  };
}

// Singleton export
export const marketOfferAggregator = MarketOfferAggregator.getInstance();
