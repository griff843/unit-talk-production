/**
 * V3 Catalog Client for Smart Form
 * SPRINT-SMARTFORM-UX-REBUILD-080
 *
 * Provides cached access to V3 contract views with fail-closed semantics.
 * All data fetched from Supabase views - no direct table access.
 */

import { supabase } from '../supabase';
import type {
  V3Sport,
  V3Event,
  V3MarketGroup,
  V3MarketType,
  V3Participant,
  V3ProviderOffer,
  V3BestOffer,
  V3SegmentType,
} from './types';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// TTLs
const REGISTRY_TTL = 5 * 60 * 1000; // 5 minutes for sports, market groups
const EVENTS_TTL = 60 * 1000; // 1 minute for events (schedule can change)
const OFFERS_TTL = 15 * 1000; // 15 seconds for offers (prices change fast)
const PARTICIPANTS_TTL = 60 * 1000; // 1 minute for rosters

/**
 * Generic cache wrapper with TTL
 */
async function cached<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiry > now) {
    return entry.data;
  }

  const data = await fetcher();
  cache.set(key, { data, expiry: now + ttl });
  return data;
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Clear cache entries matching a prefix
 */
export function clearCachePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

// ============================================================================
// SPORTS
// ============================================================================

/**
 * Fetch active sports from view_sports_active
 */
export async function fetchSports(): Promise<V3Sport[]> {
  return cached(
    'sports',
    async () => {
      const { data, error } = await supabase
        .from('view_sports_active')
        .select('*')
        .order('display_name');

      if (error) {
        console.error('[V3Catalog] fetchSports error:', error);
        throw new Error(`Failed to fetch sports: ${error.message}`);
      }

      return (data || []) as V3Sport[];
    },
    REGISTRY_TTL
  );
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Fetch upcoming events for a sport from view_events_for_form
 */
export async function fetchEvents(sport: string): Promise<V3Event[]> {
  const cacheKey = `events:${sport}`;

  return cached(
    cacheKey,
    async () => {
      const { data, error } = await supabase
        .from('view_events_for_form')
        .select('*')
        .eq('sport', sport)
        .order('scheduled_at', { ascending: true });

      if (error) {
        console.error('[V3Catalog] fetchEvents error:', error);
        throw new Error(`Failed to fetch events: ${error.message}`);
      }

      return (data || []) as V3Event[];
    },
    EVENTS_TTL
  );
}

/**
 * Search events by team name (for typeahead)
 */
export async function searchEvents(sport: string, query: string): Promise<V3Event[]> {
  // Don't cache search results - they're dynamic
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from('view_events_for_form')
    .select('*')
    .eq('sport', sport)
    .or(`home_team.ilike.%${normalizedQuery}%,away_team.ilike.%${normalizedQuery}%`)
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (error) {
    console.error('[V3Catalog] searchEvents error:', error);
    throw new Error(`Failed to search events: ${error.message}`);
  }

  return (data || []) as V3Event[];
}

// ============================================================================
// MARKET GROUPS
// ============================================================================

/**
 * Fetch market groups hierarchy from view_market_groups_hierarchy
 */
export async function fetchMarketGroups(): Promise<V3MarketGroup[]> {
  return cached(
    'marketGroups',
    async () => {
      const { data, error } = await supabase
        .from('view_market_groups_hierarchy')
        .select('*')
        .order('sort_order');

      if (error) {
        console.error('[V3Catalog] fetchMarketGroups error:', error);
        throw new Error(`Failed to fetch market groups: ${error.message}`);
      }

      return (data || []) as V3MarketGroup[];
    },
    REGISTRY_TTL
  );
}

// ============================================================================
// MARKET TYPES
// ============================================================================

/**
 * Fetch market types for a sport from view_market_types_for_sport
 */
export async function fetchMarketTypes(sport: string): Promise<V3MarketType[]> {
  const cacheKey = `marketTypes:${sport}`;

  return cached(
    cacheKey,
    async () => {
      const { data, error } = await supabase
        .from('view_market_types_for_sport')
        .select('*')
        .or(`sport.eq.${sport},sport.is.null`) // Sport-specific or universal
        .order('market_group_name')
        .order('display_name');

      if (error) {
        console.error('[V3Catalog] fetchMarketTypes error:', error);
        throw new Error(`Failed to fetch market types: ${error.message}`);
      }

      return (data || []) as V3MarketType[];
    },
    REGISTRY_TTL
  );
}

/**
 * Fetch market types filtered by market group
 */
export async function fetchMarketTypesByGroup(
  sport: string,
  marketGroup: string
): Promise<V3MarketType[]> {
  const allTypes = await fetchMarketTypes(sport);
  return allTypes.filter(mt => mt.market_group === marketGroup || mt.parent_group === marketGroup);
}

// ============================================================================
// SEGMENT TYPES
// ============================================================================

/**
 * Fetch segment types for a sport
 */
export async function fetchSegmentTypes(sport: string): Promise<V3SegmentType[]> {
  const cacheKey = `segmentTypes:${sport}`;

  return cached(
    cacheKey,
    async () => {
      const { data, error } = await supabase
        .from('segment_types')
        .select('*')
        .contains('applicable_sports', [sport]);

      if (error) {
        console.error('[V3Catalog] fetchSegmentTypes error:', error);
        throw new Error(`Failed to fetch segment types: ${error.message}`);
      }

      return (data || []) as V3SegmentType[];
    },
    REGISTRY_TTL
  );
}

// ============================================================================
// PARTICIPANTS
// ============================================================================

/**
 * Fetch participants for an event from view_participants_for_event
 */
export async function fetchParticipants(eventId: string): Promise<V3Participant[]> {
  const cacheKey = `participants:${eventId}`;

  return cached(
    cacheKey,
    async () => {
      const { data, error } = await supabase
        .from('view_participants_for_event')
        .select('*')
        .eq('event_id', eventId)
        .order('side')
        .order('name');

      if (error) {
        console.error('[V3Catalog] fetchParticipants error:', error);
        throw new Error(`Failed to fetch participants: ${error.message}`);
      }

      return (data || []) as V3Participant[];
    },
    PARTICIPANTS_TTL
  );
}

/**
 * Search participants within an event (for typeahead)
 */
export async function searchParticipants(
  eventId: string,
  query: string,
  participantType?: 'player' | 'team'
): Promise<V3Participant[]> {
  const allParticipants = await fetchParticipants(eventId);
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return allParticipants;
  }

  return allParticipants.filter(p => {
    const matchesQuery =
      p.name.toLowerCase().includes(normalizedQuery) ||
      (p.display_name?.toLowerCase().includes(normalizedQuery) ?? false);
    const matchesType = !participantType || p.participant_type === participantType;
    return matchesQuery && matchesType;
  });
}

// ============================================================================
// PROVIDER OFFERS
// ============================================================================

/**
 * Fetch current offers for an event/market/participant combination
 */
export async function fetchOffers(params: {
  eventId: string;
  marketTypeId: number;
  participantId?: string;
}): Promise<V3ProviderOffer[]> {
  const cacheKey = `offers:${params.eventId}:${params.marketTypeId}:${params.participantId || 'null'}`;

  return cached(
    cacheKey,
    async () => {
      let query = supabase
        .from('view_provider_offers_current_v3')
        .select('*')
        .eq('event_id', params.eventId)
        .eq('market_type_id', params.marketTypeId);

      if (params.participantId) {
        query = query.eq('participant_id', params.participantId);
      }

      const { data, error } = await query.order('provider_name');

      if (error) {
        console.error('[V3Catalog] fetchOffers error:', error);
        throw new Error(`Failed to fetch offers: ${error.message}`);
      }

      return (data || []) as V3ProviderOffer[];
    },
    OFFERS_TTL
  );
}

/**
 * Fetch best offer across providers for a market
 */
export async function fetchBestOffer(params: {
  eventId: string;
  marketTypeId: number;
  participantId?: string;
}): Promise<V3BestOffer | null> {
  const cacheKey = `bestOffer:${params.eventId}:${params.marketTypeId}:${params.participantId || 'null'}`;

  return cached(
    cacheKey,
    async () => {
      let query = supabase
        .from('view_best_offer_by_market')
        .select('*')
        .eq('event_id', params.eventId)
        .eq('market_type_id', params.marketTypeId);

      if (params.participantId) {
        query = query.eq('participant_id', params.participantId);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('[V3Catalog] fetchBestOffer error:', error);
        throw new Error(`Failed to fetch best offer: ${error.message}`);
      }

      return data as V3BestOffer;
    },
    OFFERS_TTL
  );
}

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

interface V3Provider {
  id: number;
  code: string;
  display_name: string;
  api_source: string | null;
  priority: number;
  has_player_props: boolean;
  has_live_odds: boolean;
  meta: Record<string, unknown>;
}

/**
 * Fetch active providers
 */
export async function fetchProviders(): Promise<V3Provider[]> {
  return cached(
    'providers',
    async () => {
      const { data, error } = await supabase
        .from('view_providers_active')
        .select('*')
        .order('priority');

      if (error) {
        console.error('[V3Catalog] fetchProviders error:', error);
        throw new Error(`Failed to fetch providers: ${error.message}`);
      }

      return (data || []) as V3Provider[];
    },
    REGISTRY_TTL
  );
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format event display string
 */
export function formatEventDisplay(event: V3Event): string {
  const away = event.away_display || event.away_team || 'Away';
  const home = event.home_display || event.home_team || 'Home';
  return `${away} @ ${home}`;
}

/**
 * Format scheduled time
 */
export function formatScheduledAt(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format American odds for display
 */
export function formatOdds(odds: number | null): string {
  if (odds === null || odds === undefined) return '-';
  return odds >= 0 ? `+${odds}` : `${odds}`;
}
