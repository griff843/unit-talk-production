/**
 * Core Markets Transformer
 *
 * Transforms Odds API event/markets data into unified_picks rows
 * for h2h (moneyline), spreads, and totals markets.
 *
 * Maps to existing schema columns:
 * - source, external_game_id, external_prop_id, market, matchup, game_date
 * - line (numeric), odds (numeric NOT NULL)
 * - posted_at, metadata (jsonb)
 */

import { randomUUID } from 'crypto';

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsApiMarket {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export interface UnifiedPickCoreMarket {
  id: string;
  source: string;
  external_game_id: string;
  external_prop_id: string | null;
  market: 'h2h' | 'spreads' | 'totals' | string;
  selection: string; // Team/player name for the pick (required for unique constraint)
  matchup: string;
  game_date: string;
  line: number | null;
  odds: number;
  posted_at: string;
  metadata: {
    bookmaker: string;
    bookmaker_key: string;
    market_key: string;
    last_update: string;
    event_id: string;
    home_team: string;
    away_team: string;
    sport_key: string;
    sport_title: string;
    team?: string;
    outcome?: string;
    player_name?: string;
  };
}

/**
 * Transform core markets (h2h, spreads, totals) to unified_picks rows
 *
 * @param game - Odds API game with bookmakers and markets
 * @param allowedBookmakers - Optional list of bookmaker keys to include
 * @returns Array of UnifiedPickCoreMarket objects
 */
export function mapCoreMarketsToUnifiedPicks(
  game: OddsApiGame,
  allowedBookmakers?: string[]
): UnifiedPickCoreMarket[] {
  const picks: UnifiedPickCoreMarket[] = [];
  const matchup = `${game.away_team} @ ${game.home_team}`;

  // Filter bookmakers if allowedBookmakers is provided
  const bookmakers = allowedBookmakers
    ? game.bookmakers.filter(b => allowedBookmakers.includes(b.key))
    : game.bookmakers;

  for (const bookmaker of bookmakers) {
    for (const market of bookmaker.markets) {
      const marketKey = market.key.toLowerCase();

      // H2H (Moneyline) - 2 picks per bookmaker (home + away)
      if (marketKey === 'h2h') {
        for (const outcome of market.outcomes) {
          picks.push({
            id: randomUUID(),
            source: 'odds-api',
            external_game_id: game.id,
            external_prop_id: null, // NULL for core markets
            market: 'h2h',
            selection: outcome.name, // Team name
            matchup,
            game_date: game.commence_time,
            line: null, // NULL for h2h
            odds: outcome.price, // American odds as number
            posted_at: market.last_update,
            metadata: {
              bookmaker: bookmaker.title,
              bookmaker_key: bookmaker.key,
              market_key: market.key,
              last_update: market.last_update,
              event_id: game.id,
              home_team: game.home_team,
              away_team: game.away_team,
              sport_key: game.sport_key,
              sport_title: game.sport_title,
              team: outcome.name,
            },
          });
        }
      }

      // Spreads - one pick per outcome (team + spread point)
      else if (marketKey === 'spreads') {
        for (const outcome of market.outcomes) {
          picks.push({
            id: randomUUID(),
            source: 'odds-api',
            external_game_id: game.id,
            external_prop_id: null, // NULL for core markets
            market: 'spreads',
            selection: outcome.name, // Team name
            matchup,
            game_date: game.commence_time,
            line: outcome.point || 0,
            odds: outcome.price, // American odds as number
            posted_at: market.last_update,
            metadata: {
              bookmaker: bookmaker.title,
              bookmaker_key: bookmaker.key,
              market_key: market.key,
              last_update: market.last_update,
              event_id: game.id,
              home_team: game.home_team,
              away_team: game.away_team,
              sport_key: game.sport_key,
              sport_title: game.sport_title,
              team: outcome.name,
            },
          });
        }
      }

      // Totals (Over/Under) - 2 picks per bookmaker
      else if (marketKey === 'totals') {
        for (const outcome of market.outcomes) {
          picks.push({
            id: randomUUID(),
            source: 'odds-api',
            external_game_id: game.id,
            external_prop_id: null, // NULL for core markets
            market: 'totals',
            selection: outcome.name, // 'Over' or 'Under'
            matchup,
            game_date: game.commence_time,
            line: outcome.point || 0,
            odds: outcome.price, // American odds as number
            posted_at: market.last_update,
            metadata: {
              bookmaker: bookmaker.title,
              bookmaker_key: bookmaker.key,
              market_key: market.key,
              last_update: market.last_update,
              event_id: game.id,
              home_team: game.home_team,
              away_team: game.away_team,
              sport_key: game.sport_key,
              sport_title: game.sport_title,
              outcome: outcome.name, // 'Over' or 'Under'
            },
          });
        }
      }

      // Player Props - markets starting with 'player_', 'batter_', or 'pitcher_'
      else if (marketKey.startsWith('player_') || marketKey.startsWith('batter_') || marketKey.startsWith('pitcher_')) {
        for (const outcome of market.outcomes) {
          // MLB props have player name in description field
          const playerName = outcome.description || outcome.name;

          // Include line and outcome (Over/Under) in external_prop_id for uniqueness
          // This prevents duplicates when same prop has both Over and Under
          const line = outcome.point !== undefined ? outcome.point : 'noLine';
          const outcomeType = outcome.name; // 'Over', 'Under', 'Yes', 'No'

          picks.push({
            id: randomUUID(),
            source: 'odds-api',
            external_game_id: game.id,
            external_prop_id: `${game.id}_${market.key}_${playerName}_${line}_${outcomeType}`,
            market: market.key,
            selection: playerName, // Player name
            matchup,
            game_date: game.commence_time,
            line: outcome.point || null,
            odds: outcome.price,
            posted_at: market.last_update,
            metadata: {
              bookmaker: bookmaker.title,
              bookmaker_key: bookmaker.key,
              market_key: market.key,
              last_update: market.last_update,
              event_id: game.id,
              home_team: game.home_team,
              away_team: game.away_team,
              sport_key: game.sport_key,
              sport_title: game.sport_title,
              player_name: playerName,
              outcome: outcome.name, // 'Over' or 'Under' for MLB
            },
          });
        }
      }
    }
  }

  return picks;
}

/**
 * Transform multiple games to unified picks
 */
export function transformGamesToUnifiedPicks(
  games: OddsApiGame[],
  allowedBookmakers?: string[]
): UnifiedPickCoreMarket[] {
  const allPicks: UnifiedPickCoreMarket[] = [];

  // TELEMETRY: Track per-market counts during transform
  const telemetry = {
    perMarketCounts: { h2h: 0, spreads: 0, totals: 0, playerProps: 0 },
    totalPicks: 0,
    gamesProcessed: games.length
  };

  for (const game of games) {
    const picks = mapCoreMarketsToUnifiedPicks(game, allowedBookmakers);
    allPicks.push(...picks);

    // TELEMETRY: Count picks by market
    for (const pick of picks) {
      const market = pick.market.toLowerCase();
      if (market === 'h2h') telemetry.perMarketCounts.h2h++;
      else if (market === 'spreads') telemetry.perMarketCounts.spreads++;
      else if (market === 'totals') telemetry.perMarketCounts.totals++;
      else telemetry.perMarketCounts.playerProps++;
    }
  }

  telemetry.totalPicks = allPicks.length;

  // TELEMETRY: Log transform results
  console.log(`[Transform] TELEMETRY - Transform complete:`, telemetry);
  console.log(`[Transform] TELEMETRY - Markets breakdown:`, {
    h2h: `${telemetry.perMarketCounts.h2h} picks`,
    spreads: `${telemetry.perMarketCounts.spreads} picks`,
    totals: `${telemetry.perMarketCounts.totals} picks`,
    playerProps: `${telemetry.perMarketCounts.playerProps} picks`
  });

  return allPicks;
}