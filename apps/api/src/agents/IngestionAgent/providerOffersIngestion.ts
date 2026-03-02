/**
 * Provider Offers Ingestion Worker
 * Sprint: MARKET-DATA-INGESTION-WIREUP-002
 *
 * Single-writer surface for ingesting provider offers into provider_offers table.
 * Uses upsert_provider_offers_v3 RPC with fail-closed quarantine.
 *
 * Data flow:
 * 1. Check Redis cache for recent offers
 * 2. If stale, fetch from OddsAPI
 * 3. Transform to V3 payload format
 * 4. Call upsert_provider_offers_v3 RPC
 * 5. Log credit usage to api_credit_log
 * 6. Update cache
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { getCachedOffers, setCachedOffers, ProviderOfferPayload } from '../../services/offersCache';
import { logger } from '../../shared/logger';

// Provider key mapping: OddsAPI bookmaker key → provider_registry code
const BOOKMAKER_TO_PROVIDER: Record<string, string> = {
  fanduel: 'fanduel',
  draftkings: 'draftkings',
  betmgm: 'betmgm',
  caesars: 'caesars',
  pointsbetus: 'pointsbet',
  williamhill_us: 'caesars', // William Hill is now Caesars
  betrivers: 'betrivers',
  espnbet: 'espnbet',
  pinnacle: 'pinnacle',
};

// Market key mapping: OddsAPI market key → provider_market_key for mapping lookup
const MARKET_KEY_MAP: Record<string, string> = {
  h2h: 'moneyline',
  spreads: 'spread',
  totals: 'total',
};

// Supported sports for ingestion
const SUPPORTED_SPORTS = [
  'basketball_nba',
  'americanfootball_nfl',
  'baseball_mlb',
  'icehockey_nhl',
] as const;

type SupportedSport = (typeof SUPPORTED_SPORTS)[number];

interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

interface OddsApiMarket {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

interface IngestionResult {
  sportKey: string;
  inserted: number;
  updated: number;
  quarantined: number;
  cached: boolean;
  creditUsed: number;
  durationMs: number;
  error?: string;
}

/**
 * Get Supabase client (singleton)
 */
function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }

  return createClient(url, key);
}

/**
 * Fetch odds from OddsAPI with credit tracking
 */
async function fetchOddsFromApi(
  sportKey: SupportedSport,
  markets: string[] = ['h2h', 'spreads', 'totals']
): Promise<{ games: OddsApiGame[]; creditUsed: number; remainingCredits?: number }> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    throw new Error('ODDS_API_KEY environment variable required');
  }

  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', markets.join(','));
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('dateFormat', 'iso');

  const startTime = Date.now();

  const response = await fetch(url.toString());

  const latencyMs = Date.now() - startTime;
  const remainingCredits = response.headers.get('x-requests-remaining');

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OddsAPI error ${response.status}: ${errorText}`);
  }

  const games = (await response.json()) as OddsApiGame[];

  // Log credit usage to database
  const supabase = getSupabase();
  await supabase.from('api_credit_log').insert({
    provider: 'odds_api',
    endpoint: `/v4/sports/${sportKey}/odds`,
    credits_used: 1,
    response_status: response.status,
    latency_ms: latencyMs,
    remaining_credits: remainingCredits ? parseInt(remainingCredits, 10) : null,
    meta: { markets, gamesReturned: games.length },
  });

  logger.info('OddsAPI request completed', {
    sportKey,
    markets,
    gamesReturned: games.length,
    latencyMs,
    remainingCredits,
  });

  return {
    games,
    creditUsed: 1,
    remainingCredits: remainingCredits ? parseInt(remainingCredits, 10) : undefined,
  };
}

/**
 * Transform OddsAPI games to V3 provider offer payloads
 */
function transformToV3Payloads(games: OddsApiGame[]): Map<string, ProviderOfferPayload[]> {
  const payloadsByProvider = new Map<string, ProviderOfferPayload[]>();

  for (const game of games) {
    for (const bookmaker of game.bookmakers) {
      const providerKey = BOOKMAKER_TO_PROVIDER[bookmaker.key];
      if (!providerKey) {
        logger.debug('Skipping unmapped bookmaker', { bookmakerKey: bookmaker.key });
        continue;
      }

      if (!payloadsByProvider.has(providerKey)) {
        payloadsByProvider.set(providerKey, []);
      }

      const providerPayloads = payloadsByProvider.get(providerKey)!;

      for (const market of bookmaker.markets) {
        const marketKey = MARKET_KEY_MAP[market.key];
        if (!marketKey) {
          logger.debug('Skipping unmapped market', { marketKey: market.key });
          continue;
        }

        for (const outcome of market.outcomes) {
          const payload: ProviderOfferPayload = {
            provider_key: providerKey,
            provider_event_id: game.id,
            provider_market_key: `${marketKey}:${outcome.name}`,
            snapshot_at: new Date().toISOString(),
          };

          // Map odds based on market type
          if (market.key === 'h2h') {
            // Moneyline: home/away odds
            if (outcome.name === game.home_team) {
              payload.home_odds = outcome.price;
            } else if (outcome.name === game.away_team) {
              payload.away_odds = outcome.price;
            }
          } else if (market.key === 'spreads') {
            // Spread: line + over/under odds
            payload.line = outcome.point;
            if (outcome.name === game.home_team) {
              payload.over_odds = outcome.price;
            } else {
              payload.under_odds = outcome.price;
            }
          } else if (market.key === 'totals') {
            // Total: line + over/under
            payload.line = outcome.point;
            if (outcome.name === 'Over') {
              payload.over_odds = outcome.price;
            } else if (outcome.name === 'Under') {
              payload.under_odds = outcome.price;
            }
          }

          providerPayloads.push(payload);
        }
      }
    }
  }

  return payloadsByProvider;
}

/**
 * Call upsert_provider_offers_bootstrap RPC for a single provider
 * Uses bootstrap function that auto-creates canonical events
 */
async function upsertProviderOffers(
  supabase: SupabaseClient,
  providerKey: string,
  offers: ProviderOfferPayload[],
  games: OddsApiGame[]
): Promise<{ inserted: number; updated: number; quarantined: number }> {
  const capturedAt = new Date().toISOString();

  // Enrich offers with game metadata for auto-event creation
  const enrichedOffers = offers.map(offer => {
    const game = games.find(g => g.id === offer.provider_event_id);
    return {
      ...offer,
      sport_key: game?.sport_key,
      home_team: game?.home_team,
      away_team: game?.away_team,
      commence_time: game?.commence_time,
    };
  });

  const { data, error } = await supabase.rpc('upsert_provider_offers_bootstrap', {
    p_provider_key: providerKey,
    p_captured_at: capturedAt,
    p_offers: enrichedOffers,
  });

  if (error) {
    logger.error('upsert_provider_offers_bootstrap failed', {
      providerKey,
      offerCount: offers.length,
      error: error.message,
    });
    throw error;
  }

  const result = data?.[0] || { inserted_count: 0, updated_count: 0, events_created: 0 };

  logger.info('upsert_provider_offers_bootstrap completed', {
    providerKey,
    offerCount: offers.length,
    inserted: result.inserted_count,
    updated: result.updated_count,
    eventsCreated: result.events_created,
  });

  return {
    inserted: result.inserted_count || 0,
    updated: result.updated_count || 0,
    quarantined: 0, // Bootstrap doesn't quarantine
  };
}

/**
 * Main ingestion function for a single sport
 */
export async function ingestProviderOffers(
  sportKey: SupportedSport,
  markets: string[] = ['h2h', 'spreads', 'totals'],
  options: { forceRefresh?: boolean } = {}
): Promise<IngestionResult> {
  const startTime = Date.now();
  const result: IngestionResult = {
    sportKey,
    inserted: 0,
    updated: 0,
    quarantined: 0,
    cached: false,
    creditUsed: 0,
    durationMs: 0,
  };

  try {
    // Check cache first (unless force refresh)
    if (!options.forceRefresh) {
      const cached = await getCachedOffers(sportKey, markets);
      if (cached) {
        result.cached = true;
        result.durationMs = Date.now() - startTime;
        logger.info('Using cached offers', {
          sportKey,
          markets,
          cachedAt: cached.cachedAt,
          offerCount: cached.offers.length,
        });
        return result;
      }
    }

    // Fetch from OddsAPI
    const { games, creditUsed } = await fetchOddsFromApi(sportKey, markets);
    result.creditUsed = creditUsed;

    if (games.length === 0) {
      logger.warn('No games returned from OddsAPI', { sportKey, markets });
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Transform to V3 payloads
    const payloadsByProvider = transformToV3Payloads(games);

    // Get Supabase client
    const supabase = getSupabase();

    // Ingest each provider's offers
    for (const [providerKey, offers] of payloadsByProvider) {
      try {
        const upsertResult = await upsertProviderOffers(supabase, providerKey, offers, games);
        result.inserted += upsertResult.inserted;
        result.updated += upsertResult.updated;
        result.quarantined += upsertResult.quarantined;
      } catch (err) {
        logger.error('Provider ingestion failed', {
          providerKey,
          error: (err as Error).message,
        });
        // Continue with other providers
      }
    }

    // Update cache with raw payloads for deduplication
    const allPayloads = Array.from(payloadsByProvider.values()).flat();
    await setCachedOffers(sportKey, markets, allPayloads);

    result.durationMs = Date.now() - startTime;

    logger.info('Ingestion completed', result);
    return result;
  } catch (error) {
    result.error = (error as Error).message;
    result.durationMs = Date.now() - startTime;
    logger.error('Ingestion failed', { ...result, error: result.error });
    return result;
  }
}

/**
 * Ingest all supported sports
 */
export async function ingestAllSports(
  options: { forceRefresh?: boolean } = {}
): Promise<IngestionResult[]> {
  const results: IngestionResult[] = [];

  for (const sportKey of SUPPORTED_SPORTS) {
    const result = await ingestProviderOffers(sportKey, ['h2h', 'spreads', 'totals'], options);
    results.push(result);

    // Rate limit: wait 1s between sports to avoid hitting API limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

/**
 * Get ingestion stats (for health monitoring)
 */
export async function getIngestionStats(): Promise<{
  provider_offers_count: number;
  quarantine_count: number;
  recent_credit_usage: number;
}> {
  const supabase = getSupabase();

  const [offersResult, quarantineResult, creditResult] = await Promise.all([
    supabase.from('provider_offers').select('id', { count: 'exact', head: true }),
    supabase
      .from('offer_quarantine')
      .select('id', { count: 'exact', head: true })
      .is('resolved_at', null),
    supabase
      .from('api_credit_log')
      .select('credits_used')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const totalCredits = (creditResult.data || []).reduce(
    (sum, row) => sum + (row.credits_used || 0),
    0
  );

  return {
    provider_offers_count: offersResult.count || 0,
    quarantine_count: quarantineResult.count || 0,
    recent_credit_usage: totalCredits,
  };
}
