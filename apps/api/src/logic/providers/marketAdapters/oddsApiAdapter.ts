/**
 * OddsAPI → NormalizedMarketOffer Adapter
 * Sprint: SPRINT-MULTI-BOOK-MARKET-LAYER-020
 *
 * Transforms OddsAPI game data (multi-bookmaker, multi-market) into
 * NormalizedMarketOffer[] for aggregation and consensus computation.
 *
 * The OddsAPI response shape:
 *   game.bookmakers[].markets[].outcomes[]
 *
 * For totals markets, we pair Over/Under outcomes from the same bookmaker
 * into a single NormalizedMarketOffer with overOdds/underOdds.
 */

import { getBookProfile, type NormalizedMarketOffer } from './types';

// Re-export types used by consumers
export type { NormalizedMarketOffer } from './types';

/** OddsAPI outcome (from game.bookmakers[].markets[].outcomes[]) */
interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

/** OddsAPI market (from game.bookmakers[].markets[]) */
interface OddsApiMarket {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
}

/** OddsAPI bookmaker (from game.bookmakers[]) */
interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

/** OddsAPI game (top-level response element) */
interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

/**
 * Convert OddsAPI game data to NormalizedMarketOffer[].
 *
 * For totals/spreads: pairs Over+Under outcomes from the same bookmaker
 * into one offer with both sides.
 *
 * For h2h (moneyline): maps home→over, away→under convention so
 * the offer has two-sided odds.
 */
export function normalizeOddsApiGame(game: OddsApiGame): NormalizedMarketOffer[] {
  const offers: NormalizedMarketOffer[] = [];

  for (const bookmaker of game.bookmakers) {
    const { profile, liquidity } = getBookProfile(bookmaker.key);

    for (const market of bookmaker.markets) {
      const paired = pairOutcomes(market);

      for (const pair of paired) {
        offers.push({
          providerId: bookmaker.key,
          providerName: bookmaker.title,
          eventId: game.id,
          player: null,
          statType: mapMarketKey(market.key),
          line: pair.line,
          overOdds: pair.overOdds,
          underOdds: pair.underOdds,
          snapshotAt: bookmaker.last_update || new Date().toISOString(),
          bookProfile: profile,
          liquidityTier: liquidity,
          dataQuality: 'good',
        });
      }
    }
  }

  return offers;
}

interface PairedOutcome {
  overOdds: number;
  underOdds: number;
  line: number;
}

/** Pair Over/Under (or Home/Away) outcomes from the same market */
function pairOutcomes(market: OddsApiMarket): PairedOutcome[] {
  switch (market.key) {
    case 'h2h':
      return pairH2H(market.outcomes);
    case 'totals':
      return pairTotals(market.outcomes);
    case 'spreads':
      return pairSpreads(market.outcomes);
    default:
      return pairTotals(market.outcomes);
  }
}

/** H2H: home=over, away=under */
function pairH2H(outcomes: OddsApiOutcome[]): PairedOutcome[] {
  if (outcomes.length < 2) return [];

  // OddsAPI h2h outcomes are ordered [home_team, away_team]
  const home = outcomes[0];
  const away = outcomes[1];

  return [
    {
      overOdds: home.price,
      underOdds: away.price,
      line: 0,
    },
  ];
}

/** Totals: pair Over+Under with same point */
function pairTotals(outcomes: OddsApiOutcome[]): PairedOutcome[] {
  const byPoint = new Map<number, { over?: number; under?: number }>();

  for (const o of outcomes) {
    const point = o.point ?? 0;
    const entry = byPoint.get(point) ?? {};
    if (o.name === 'Over') entry.over = o.price;
    else if (o.name === 'Under') entry.under = o.price;
    byPoint.set(point, entry);
  }

  const pairs: PairedOutcome[] = [];
  for (const [point, sides] of byPoint) {
    if (sides.over != null && sides.under != null) {
      pairs.push({ overOdds: sides.over, underOdds: sides.under, line: point });
    }
  }
  return pairs;
}

/** Spreads: pair by absolute point value */
function pairSpreads(outcomes: OddsApiOutcome[]): PairedOutcome[] {
  // Spreads come as [home -3.5, away +3.5] — pair opposites
  if (outcomes.length < 2) return [];

  const byAbsPoint = new Map<number, { fav?: OddsApiOutcome; dog?: OddsApiOutcome }>();

  for (const o of outcomes) {
    const absPoint = Math.abs(o.point ?? 0);
    const entry = byAbsPoint.get(absPoint) ?? {};
    if ((o.point ?? 0) < 0) entry.fav = o;
    else entry.dog = o;
    byAbsPoint.set(absPoint, entry);
  }

  const pairs: PairedOutcome[] = [];
  for (const [absPoint, sides] of byAbsPoint) {
    if (sides.fav && sides.dog) {
      pairs.push({
        overOdds: sides.fav.price,
        underOdds: sides.dog.price,
        line: absPoint,
      });
    }
  }
  return pairs;
}

/** Map OddsAPI market key to our stat_type convention */
function mapMarketKey(key: string): string {
  switch (key) {
    case 'h2h':
      return 'moneyline';
    case 'totals':
      return 'totals';
    case 'spreads':
      return 'spread';
    default:
      return key;
  }
}
