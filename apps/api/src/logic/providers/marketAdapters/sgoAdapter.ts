/**
 * SGO → NormalizedMarketOffer Adapter
 * Sprint: SPRINT-MULTI-BOOK-MARKET-LAYER-020
 *
 * Transforms SGO raw_props rows into NormalizedMarketOffer[].
 * SGO provides single-book data, so each raw_prop yields at most one offer.
 */

import type { NormalizedMarketOffer } from './types';

// Re-export for consumers
export type { NormalizedMarketOffer } from './types';

/** Minimal raw_prop shape needed by this adapter */
interface SgoRawProp {
  id: string;
  player_name?: string | null;
  sport?: string | null;
  stat_type?: string | null;
  line?: number | null;
  over_odds?: number | null;
  under_odds?: number | null;
  provider?: string | null;
  game_time?: string | null;
  matchup?: string | null;
  created_at?: string;
  event_id?: string | null;
  [key: string]: unknown;
}

/**
 * Convert a single SGO raw_prop to a NormalizedMarketOffer.
 * Returns null if the prop lacks both over and under odds.
 */
export function normalizeSgoRawProp(rawProp: SgoRawProp): NormalizedMarketOffer | null {
  const overOdds = rawProp.over_odds != null ? Number(rawProp.over_odds) : null;
  const underOdds = rawProp.under_odds != null ? Number(rawProp.under_odds) : null;

  // Need at least one side
  if (overOdds == null && underOdds == null) return null;

  const hasBothSides =
    overOdds != null && isFinite(overOdds) && underOdds != null && isFinite(underOdds);

  return {
    providerId: 'sgo',
    providerName: 'SGO',
    eventId: String(rawProp.event_id || rawProp.matchup || rawProp.id),
    player: rawProp.player_name || null,
    statType: String(rawProp.stat_type || 'unknown'),
    line: Number(rawProp.line) || 0,
    overOdds: overOdds ?? -110,
    underOdds: underOdds ?? -110,
    snapshotAt: rawProp.created_at || new Date().toISOString(),
    bookProfile: 'retail',
    liquidityTier: 'medium',
    dataQuality: hasBothSides ? 'good' : 'partial',
  };
}

/**
 * Convert multiple SGO raw_props to NormalizedMarketOffer[].
 * Filters out props that lack odds data.
 */
export function normalizeSgoRawProps(rawProps: SgoRawProp[]): NormalizedMarketOffer[] {
  const offers: NormalizedMarketOffer[] = [];
  for (const rp of rawProps) {
    const offer = normalizeSgoRawProp(rp);
    if (offer) offers.push(offer);
  }
  return offers;
}
