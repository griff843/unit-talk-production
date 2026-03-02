/**
 * Offer Fetch for Probability Layer
 * Sprint: INTELLIGENCE-PROBABILITY-INTEGRATION-002
 * Updated: MARKET-ID-TRUTH-BRIDGE-003 (market-type-specific odds handling)
 *
 * Fetches book offers from provider_offers for devig consensus computation.
 * Returns data in BookOffer format for devigConsensus.ts.
 *
 * MARKET TYPE HANDLING:
 * - Moneyline (market_type_id=1): Uses home_odds/away_odds columns
 * - Spread/Totals: Uses over_odds/under_odds columns
 * - Yes/No props: Uses yes_odds/no_odds columns
 *
 * FAIL-CLOSED: Returns empty array if query fails (let caller handle insufficiency).
 * NO EXTERNAL APIS: Only DB queries. All market data must exist in provider_offers.
 */

import { SupabaseClient } from '@supabase/supabase-js';

import type { BookOffer, BookProfile, LiquidityTier, DataQuality } from './devigConsensus';

// =============================================================================
// MARKET TYPE CONSTANTS
// =============================================================================

/** Market types that use home_odds/away_odds (moneyline-style) */
const MONEYLINE_MARKET_TYPES = [1]; // team_moneyline

/** Market types that use yes_odds/no_odds (binary props) */
const YES_NO_MARKET_TYPES = [5, 6, 10, 11]; // nrfi, yrfi, first_basket, anytime_td

interface OddsColumns {
  sideA: string;
  sideB: string;
  filterA: string;
  filterB: string;
}

/** Determine which odds columns to use based on market type */
function getOddsColumns(marketTypeId: number): OddsColumns {
  if (MONEYLINE_MARKET_TYPES.includes(marketTypeId)) {
    return { sideA: 'home_odds', sideB: 'away_odds', filterA: 'home_odds', filterB: 'away_odds' };
  }
  if (YES_NO_MARKET_TYPES.includes(marketTypeId)) {
    return { sideA: 'yes_odds', sideB: 'no_odds', filterA: 'yes_odds', filterB: 'no_odds' };
  }
  return { sideA: 'over_odds', sideB: 'under_odds', filterA: 'over_odds', filterB: 'under_odds' };
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** Parameters for fetching offers */
export interface FetchOffersParams {
  eventId: string;
  marketTypeId: number;
  participantId: string | null;
  maxAgeHours?: number;
}

interface ProviderOfferRow {
  id: string;
  provider_id: number;
  provider_code: string;
  provider_name: string;
  over_odds: number | null;
  under_odds: number | null;
  snapshot_at: string;
  book_profile: BookProfile | null;
  liquidity_tier: LiquidityTier | null;
  data_quality_default: DataQuality | null;
}

interface ProviderInfo {
  code: string;
  displayName: string;
  bookProfile: BookProfile;
  liquidityTier: LiquidityTier;
  dataQuality: DataQuality;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OfferRow = Record<string, any>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Fetch provider info for a list of provider IDs */
async function fetchProviderMap(
  supabase: SupabaseClient,
  providerIds: number[]
): Promise<Map<number, ProviderInfo>> {
  if (providerIds.length === 0) return new Map();

  const { data: providers, error } = await supabase
    .from('provider_registry')
    .select('id, code, display_name, book_profile, liquidity_tier, data_quality_default')
    .in('id', providerIds);

  if (error || !providers) return new Map();

  return new Map(
    providers.map(p => [
      p.id,
      {
        code: p.code,
        displayName: p.display_name,
        bookProfile: (p.book_profile as BookProfile) || 'retail',
        liquidityTier: (p.liquidity_tier as LiquidityTier) || 'medium',
        dataQuality: (p.data_quality_default as DataQuality) || 'good',
      },
    ])
  );
}

/** Map offer rows to BookOffer format using market-type-specific columns */
function mapOffersToBookOffers(
  offers: OfferRow[],
  oddsColumns: OddsColumns,
  providerMap: Map<number, ProviderInfo>
): BookOffer[] {
  return offers
    .filter(o => o[oddsColumns.sideA] !== null && o[oddsColumns.sideB] !== null)
    .map(o => {
      const provider = providerMap.get(o.provider_id);
      return {
        bookId: String(o.provider_id || o.provider),
        bookName: provider?.displayName || o.provider_name || o.provider || 'Unknown',
        overOdds: o[oddsColumns.sideA] as number,
        underOdds: o[oddsColumns.sideB] as number,
        bookProfile: provider?.bookProfile || 'retail',
        liquidityTier: provider?.liquidityTier || 'medium',
        dataQuality: provider?.dataQuality || 'good',
      };
    });
}

// =============================================================================
// OFFER FETCH FUNCTION
// =============================================================================

/**
 * Fetch book offers for a specific leg from provider_offers.
 * FAIL-CLOSED: Returns empty array on error.
 */
export async function fetchBookOffers(
  supabase: SupabaseClient,
  params: FetchOffersParams
): Promise<BookOffer[]> {
  const { eventId, marketTypeId, participantId, maxAgeHours = 24 } = params;
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
  const cutoffIso = cutoffTime.toISOString();

  try {
    const { data, error } = await supabase.rpc('fetch_book_offers_for_leg', {
      p_event_id: eventId,
      p_market_type_id: marketTypeId,
      p_participant_id: participantId,
      p_cutoff_time: cutoffIso,
    });

    // If RPC doesn't exist, fall back to direct query
    if (
      error &&
      (error.message.includes('does not exist') || error.message.includes('Could not find'))
    ) {
      return await fetchBookOffersDirect(supabase, params);
    }

    if (error) return [];
    return mapRowsToBookOffers(data || []);
  } catch {
    return [];
  }
}

/**
 * Direct query fallback when RPC is not available.
 * MARKET-ID-TRUTH-BRIDGE-003: Updated to handle market-type-specific odds columns.
 */
async function fetchBookOffersDirect(
  supabase: SupabaseClient,
  params: FetchOffersParams
): Promise<BookOffer[]> {
  const { eventId, marketTypeId, participantId, maxAgeHours = 24 } = params;
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
  const cutoffIso = cutoffTime.toISOString();
  const oddsColumns = getOddsColumns(marketTypeId);

  try {
    const offers = await queryOffers(supabase, {
      eventId,
      marketTypeId,
      participantId,
      cutoffIso,
      oddsColumns,
    });
    if (!offers || offers.length === 0) return [];

    const providerIds = [...new Set(offers.map(o => o.provider_id).filter(Boolean))];
    const providerMap = await fetchProviderMap(supabase, providerIds);

    return mapOffersToBookOffers(offers, oddsColumns, providerMap);
  } catch {
    return [];
  }
}

interface QueryOffersParams {
  eventId: string;
  marketTypeId: number;
  participantId: string | null;
  cutoffIso: string;
  oddsColumns: OddsColumns;
}

/** Query offers from view with market-type-specific filtering */
async function queryOffers(
  supabase: SupabaseClient,
  params: QueryOffersParams
): Promise<OfferRow[] | null> {
  const { eventId, marketTypeId, participantId, cutoffIso, oddsColumns } = params;

  let query = supabase
    .from('view_provider_offers_current_v3')
    .select(
      'id, provider_id, provider, provider_name, over_odds, under_odds, home_odds, away_odds, yes_odds, no_odds, snapshot_at'
    )
    .eq('event_id', eventId)
    .eq('market_type_id', marketTypeId)
    .gte('snapshot_at', cutoffIso)
    .not(oddsColumns.filterA, 'is', null)
    .not(oddsColumns.filterB, 'is', null);

  if (participantId) {
    query = query.eq('participant_id', participantId);
  } else {
    query = query.or(
      'participant_id.is.null,participant_id.eq.00000000-0000-0000-0000-000000000000'
    );
  }

  const { data, error } = await query;
  return error ? null : data;
}

/** Map raw database rows to BookOffer format (for RPC results) */
function mapRowsToBookOffers(rows: ProviderOfferRow[]): BookOffer[] {
  return rows
    .filter(r => r.over_odds !== null && r.under_odds !== null)
    .map(r => ({
      bookId: String(r.provider_id || r.provider_code),
      bookName: r.provider_name || r.provider_code || 'Unknown',
      overOdds: r.over_odds as number,
      underOdds: r.under_odds as number,
      bookProfile: r.book_profile || 'retail',
      liquidityTier: r.liquidity_tier || 'medium',
      dataQuality: r.data_quality_default || 'good',
    }));
}

// =============================================================================
// EXPORTS
// =============================================================================

export { fetchBookOffersDirect };
