/**
 * SGO → ProviderOfferPayload Adapter
 * Sprint: SPRINT-INGESTION-MIGRATION-044B
 *
 * Transforms SGOPairedProp[] from sgoFetcher into ProviderOfferPayload[]
 * for ingestion into the canonical provider_offers table via
 * upsert_provider_offers_bootstrap RPC.
 */

import type { SGOPairedProp } from '../../logic/providers/sgoFetcher';
import type { ProviderOfferPayload } from '../../services/offersCache';

/**
 * Strip '-over' or '-under' suffix from an SGO market key to get the base market identifier.
 * Example: "points-all-game-ou-over" → "points-all-game-ou"
 */
function stripSideSuffix(marketKey: string): string {
  return marketKey.replace(/-(over|under)$/, '');
}

/**
 * Transform SGOPairedProp[] into ProviderOfferPayload[] for provider_offers ingestion.
 *
 * Skips props that have no odds data (both over and under null).
 * Uses the overMarketKey (or underMarketKey) with side suffix stripped as
 * the canonical provider_market_key.
 */
export function transformSGOToProviderOffers(
  paired: SGOPairedProp[],
  snapshotAt?: string
): ProviderOfferPayload[] {
  const snapshot = snapshotAt || new Date().toISOString();
  const payloads: ProviderOfferPayload[] = [];

  for (const prop of paired) {
    // Skip if no odds data at all
    if (prop.overOdds == null && prop.underOdds == null) {
      continue;
    }

    // Derive base market key (strip -over/-under suffix)
    const rawKey = prop.overMarketKey || prop.underMarketKey;
    if (!rawKey) continue;
    const providerMarketKey = stripSideSuffix(rawKey);

    // Parse line to number
    const line = prop.line != null ? Number(prop.line) : undefined;

    payloads.push({
      provider_key: 'sgo',
      provider_event_id: prop.eventID,
      provider_market_key: providerMarketKey,
      provider_participant_id: prop.playerId ?? undefined,
      line: line != null && isFinite(line) ? line : undefined,
      over_odds: prop.overOdds ?? undefined,
      under_odds: prop.underOdds ?? undefined,
      snapshot_at: snapshot,
      // Enrichment fields for auto-event creation in bootstrap RPC
      sport_key: prop.leagueID.toLowerCase(),
      home_team: prop.homeTeam,
      away_team: prop.awayTeam,
      commence_time: prop.startsAtUTC,
    } as ProviderOfferPayload);
  }

  return payloads;
}
