/**
 * Pick View Normalization
 *
 * Builds a canonical PickView object from picks table + pick_publish metadata
 * with deterministic precedence rules.
 *
 * Precedence Order:
 * 1. picks.{column} (database columns like selection, odds, confidence, stake)
 * 2. picks.metadata.{key} (metadata JSON in picks table)
 * 3. pick_publish.metadata.{key} (metadata JSON in pick_publish table)
 *
 * Key Normalization:
 * - pickSide/side → selection
 * - market → book (when it's a book name like "FanDuel")
 * - prop_type/bet_type → betType
 * - away_team + home_team → matchup ("Away @ Home")
 */

export interface PickView {
  // Sport & League
  sport?: string; // NCAAB, NFL, NBA, etc.
  league?: string; // Same as sport or more specific

  // Game Context
  matchup?: string; // "Away Team @ Home Team"
  homeTeam?: string;
  awayTeam?: string;
  gameDate?: string;

  // Bet Details
  betType?: string; // moneyline, spread, total, prop
  selection: string; // The pick/side (e.g., "alabama st hornets", "over", "under")
  line?: number; // Point spread or total line
  odds: number; // American odds (e.g., -110, +150)

  // Sizing & Confidence
  units?: number; // Stake in units
  stake?: number; // Same as units
  confidence?: number; // 1-10 or 1-100

  // Market Info
  book?: string; // FanDuel, DraftKings, etc.
  market?: string; // Alternative market descriptor

  // Player (for props)
  playerName?: string;
  playerId?: string;

  // Canonical IDs
  canonical_game_id?: string;
  canonical_player_id?: string;

  // Metadata
  tier?: string; // S, A, B, C tier
  professional_score?: number;
  notes?: string;
  capper_name?: string;
}

interface PickRow {
  id?: string;
  selection?: string;
  odds?: number;
  confidence?: number;
  stake?: number;
  metadata?: Record<string, any>;
  tier?: string;
  professional_score?: number;
  notes?: string;
  player_name?: string;
  capper_name?: string;
  [key: string]: any;
}

interface PublishRow {
  metadata?: Record<string, any>;
  [key: string]: any;
}

/**
 * Normalize key names to standard PickView field names
 */
function normalizeKey(key: string): string {
  const keyMap: Record<string, string> = {
    // Selection variants
    pickSide: 'selection',
    side: 'selection',
    direction: 'selection',

    // Bet type variants
    prop_type: 'betType',
    bet_type: 'betType',
    market_type: 'betType',
    marketType: 'betType',

    // Player variants
    player_name: 'playerName',
    player_id: 'playerId',

    // Team variants
    home_team: 'homeTeam',
    away_team: 'awayTeam',

    // Stake variants
    units: 'stake',

    // Confidence variants
    confidence_score: 'confidence',
    userScore: 'confidence',

    // Capper variants
    capper_name: 'capperName',
    capperName: 'capperName',

    // Game date variants
    game_date: 'gameDate',
    event_time: 'gameDate',
  };

  return keyMap[key] || key;
}

/**
 * Build matchup string from home/away teams
 */
function buildMatchup(awayTeam?: string, homeTeam?: string): string | undefined {
  if (awayTeam && homeTeam) {
    return `${awayTeam} @ ${homeTeam}`;
  }
  return undefined;
}

/**
 * Extract and normalize value from metadata
 */
function extractFromMetadata(
  metadata: Record<string, any> | undefined,
  keys: string[]
): any {
  if (!metadata) return undefined;

  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== null) {
      return metadata[key];
    }
  }

  return undefined;
}

/**
 * Build canonical PickView from pick row and publish row
 *
 * @param pickRow - Row from picks table
 * @param publishRow - Row from pick_publish table (optional)
 * @returns Normalized PickView object
 */
export function buildPickView(pickRow: PickRow, publishRow?: PublishRow): PickView {
  const pickMetadata = pickRow.metadata || {};
  const publishMetadata = publishRow?.metadata || {};

  // Start with database columns (highest priority)
  const view: PickView = {
    selection: pickRow.selection || '',
    odds: pickRow.odds ?? 0, // Use nullish coalescing to allow 0 as valid value
    confidence: pickRow.confidence,
    stake: pickRow.stake,
    tier: pickRow.tier,
    professional_score: pickRow.professional_score,
    notes: pickRow.notes,
    playerName: pickRow.player_name || pickRow.playerName,
    capper_name: pickRow.capper_name || pickRow.capperName,
  };

  // Override odds from metadata if picks.odds is 0 or undefined
  if (!view.odds) {
    view.odds =
      extractFromMetadata(pickMetadata, ['odds']) ||
      extractFromMetadata(publishMetadata, ['odds']) ||
      0;
  }

  // Override confidence from metadata if not set
  if (view.confidence === undefined || view.confidence === null) {
    view.confidence =
      extractFromMetadata(pickMetadata, ['confidence', 'confidence_score', 'userScore']) ||
      extractFromMetadata(publishMetadata, ['confidence', 'confidence_score', 'userScore']);
  }

  // Override stake from metadata if not set
  if (view.stake === undefined || view.stake === null) {
    view.stake =
      extractFromMetadata(pickMetadata, ['stake', 'units']) ||
      extractFromMetadata(publishMetadata, ['stake', 'units']);
  }

  // Override selection from metadata if picks.selection is empty
  if (!view.selection) {
    view.selection =
      extractFromMetadata(pickMetadata, ['selection', 'pickSide', 'side', 'direction']) ||
      extractFromMetadata(publishMetadata, ['selection', 'pickSide', 'side', 'direction']) ||
      'Unknown';
  }

  // Sport/League (from metadata only - not in picks table columns)
  view.sport =
    extractFromMetadata(pickMetadata, ['sport', 'league']) ||
    extractFromMetadata(publishMetadata, ['sport', 'league']);
  view.league = view.sport; // Alias

  // Bet Type
  view.betType =
    extractFromMetadata(pickMetadata, ['betType', 'bet_type', 'prop_type', 'market_type', 'marketType']) ||
    extractFromMetadata(publishMetadata, ['betType', 'bet_type', 'prop_type', 'market_type', 'marketType']);

  // Teams
  view.homeTeam =
    extractFromMetadata(pickMetadata, ['homeTeam', 'home_team']) ||
    extractFromMetadata(publishMetadata, ['homeTeam', 'home_team']);
  view.awayTeam =
    extractFromMetadata(pickMetadata, ['awayTeam', 'away_team']) ||
    extractFromMetadata(publishMetadata, ['awayTeam', 'away_team']);

  // Build matchup
  view.matchup = buildMatchup(view.awayTeam, view.homeTeam);

  // Line
  view.line =
    pickRow.line ||
    extractFromMetadata(pickMetadata, ['line']) ||
    extractFromMetadata(publishMetadata, ['line']);

  // Units (alias for stake)
  view.units = view.stake;

  // Book/Market
  const marketValue =
    extractFromMetadata(pickMetadata, ['book', 'market']) ||
    extractFromMetadata(publishMetadata, ['book', 'market']);

  // Determine if market is actually a book name
  const bookNames = ['fanduel', 'draftkings', 'betmgm', 'caesars', 'pinnacle', 'bet365'];
  if (marketValue && typeof marketValue === 'string') {
    const lowerMarket = marketValue.toLowerCase();
    if (bookNames.some((book) => lowerMarket.includes(book))) {
      view.book = marketValue;
    } else {
      view.market = marketValue;
    }
  }

  // Game Date
  view.gameDate =
    extractFromMetadata(pickMetadata, ['gameDate', 'game_date', 'event_time']) ||
    extractFromMetadata(publishMetadata, ['gameDate', 'game_date', 'event_time']);

  // Player ID
  view.playerId =
    pickRow.playerId ||
    extractFromMetadata(pickMetadata, ['playerId', 'player_id']) ||
    extractFromMetadata(publishMetadata, ['playerId', 'player_id']);

  // Canonical IDs
  view.canonical_game_id =
    extractFromMetadata(pickMetadata, ['canonical_game_id']) ||
    extractFromMetadata(publishMetadata, ['canonical_game_id']);
  view.canonical_player_id =
    extractFromMetadata(pickMetadata, ['canonical_player_id']) ||
    extractFromMetadata(publishMetadata, ['canonical_player_id']);

  return view;
}
