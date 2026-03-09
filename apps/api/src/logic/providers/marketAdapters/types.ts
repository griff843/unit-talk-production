/**
 * Normalized Market Offer Types
 * Sprint: SPRINT-MULTI-BOOK-MARKET-LAYER-020
 *
 * Common interface for multi-book market data from any provider.
 * Adapters convert provider-specific formats to NormalizedMarketOffer,
 * then MarketOfferAggregator groups them into BookOffer[] for the
 * probability layer's consensus computation.
 */

import type {
  BookProfile,
  DataQuality,
  LiquidityTier,
} from '../../../lib/probability/devigConsensus';

/** Normalized market offer from any provider */
export interface NormalizedMarketOffer {
  providerId: string;
  providerName: string;
  eventId: string;
  player: string | null;
  statType: string;
  line: number;
  overOdds: number;
  underOdds: number;
  snapshotAt: string;
  bookProfile: BookProfile;
  liquidityTier: LiquidityTier;
  dataQuality: DataQuality;
}

/** Book profile lookup for known sportsbooks */
export const BOOK_PROFILES: Record<string, { profile: BookProfile; liquidity: LiquidityTier }> = {
  pinnacle: { profile: 'sharp', liquidity: 'high' },
  circa: { profile: 'sharp', liquidity: 'medium' },
  draftkings: { profile: 'market_maker', liquidity: 'high' },
  fanduel: { profile: 'market_maker', liquidity: 'high' },
  betmgm: { profile: 'retail', liquidity: 'medium' },
  caesars: { profile: 'retail', liquidity: 'medium' },
  pointsbet: { profile: 'retail', liquidity: 'low' },
  bovada: { profile: 'retail', liquidity: 'medium' },
  bet365: { profile: 'market_maker', liquidity: 'high' },
  williamhill: { profile: 'market_maker', liquidity: 'medium' },
  sgo: { profile: 'retail', liquidity: 'medium' },
};

/** Get book profile for a provider key, with retail fallback */
export function getBookProfile(providerKey: string): {
  profile: BookProfile;
  liquidity: LiquidityTier;
} {
  return BOOK_PROFILES[providerKey.toLowerCase()] ?? { profile: 'retail', liquidity: 'medium' };
}
