/**
 * Ticket Presentation Builder
 *
 * Converts unified_picks rows to presentation-ready ticket format for Discord embeds.
 * Handles both single picks and parlays (2+ legs).
 *
 * PARLAY-DISCORD-GROUPING-001: New ticket-level presentation builder
 *
 * @see docs/contracts/DISCORD_EMBED_CONTRACT.md
 */

import { buildPickPresentation } from './pickPresentationBuilder';
import {
  TicketPresentation,
  LegPresentation,
  formatTotalOddsAmerican,
  formatTotalOddsDecimal,
  isParlay,
} from '../types/ticketPresentation';
import {
  PickPresentation,
  UnifiedPickRow,
  formatUnitsDisplay,
} from '../types/pickPresentation';

/**
 * Default thumbnail for parlays (Unit Talk logo)
 */
const UNIT_TALK_PARLAY_THUMBNAIL = 'https://i.imgur.com/YQKdYUn.png';

/**
 * League logos for parlay thumbnails (if all legs share same sport)
 */
const LEAGUE_LOGOS: Record<string, string> = {
  'NFL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nfl.png',
  'NBA': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png',
  'MLB': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/mlb.png',
  'NHL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nhl.png',
  'NCAAF': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/ncaa.png',
  'NCAAB': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/ncaa.png',
};

/**
 * Get capper name from pick data
 */
function getCapperName(pick: UnifiedPickRow): string {
  return (pick.meta?.capper as string)
    || (pick.meta?.capper_name as string)
    || (pick.meta?.capper_username as string)
    || 'Unit Talk';
}

/**
 * Get matchup string from pick
 */
function getMatchupFromPick(pick: UnifiedPickRow): string | null {
  if (pick.matchup) return pick.matchup;
  if (pick.manual_fields_blob?.matchup) return pick.manual_fields_blob.matchup as string;
  if (pick.manual_matchup_home && pick.manual_matchup_away) {
    return `${pick.manual_matchup_away} @ ${pick.manual_matchup_home}`;
  }
  if (pick.meta?.matchup) return pick.meta.matchup as string;
  return null;
}

/**
 * Build a LegPresentation from a pick and its PickPresentation
 */
function buildLegPresentation(
  pick: UnifiedPickRow,
  presentation: PickPresentation,
  legNumber: number
): LegPresentation {
  return {
    leg_number: legNumber,
    title: presentation.title,
    odds_american: presentation.odds_american,
    market_label: presentation.market_label,
    matchup: getMatchupFromPick(pick),
    sport: pick.sport,
    pick_id: pick.id,
    market_type: presentation.market_type,
  };
}

/**
 * Determine primary sport from a list of picks
 * Returns the most common sport, or first sport if tied
 */
function determinePrimarySport(picks: UnifiedPickRow[]): string {
  if (picks.length === 0) return 'NBA';
  if (picks.length === 1) return picks[0].sport || 'NBA';

  const sportCounts: Record<string, number> = {};
  for (const pick of picks) {
    const sport = pick.sport || 'NBA';
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
  }

  let maxSport = picks[0].sport || 'NBA';
  let maxCount = 0;
  for (const [sport, count] of Object.entries(sportCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxSport = sport;
    }
  }

  return maxSport;
}

/**
 * Get thumbnail for parlay ticket
 * If all legs share the same sport, use league logo
 * Otherwise, use Unit Talk default
 */
function getParlayThumbnail(picks: UnifiedPickRow[]): string {
  if (picks.length === 0) return UNIT_TALK_PARLAY_THUMBNAIL;

  const sports = new Set(picks.map(p => p.sport?.toUpperCase()));
  if (sports.size === 1) {
    const sport = picks[0].sport?.toUpperCase();
    if (sport && LEAGUE_LOGOS[sport]) {
      return LEAGUE_LOGOS[sport];
    }
  }

  return UNIT_TALK_PARLAY_THUMBNAIL;
}

/**
 * Build a TicketPresentation for a SINGLE pick
 */
export async function buildSingleTicketPresentation(
  pick: UnifiedPickRow
): Promise<TicketPresentation> {
  const presentation = await buildPickPresentation(pick);

  const leg: LegPresentation = {
    leg_number: 1,
    title: presentation.title,
    odds_american: presentation.odds_american,
    market_label: presentation.market_label,
    matchup: getMatchupFromPick(pick),
    sport: pick.sport,
    pick_id: pick.id,
    market_type: presentation.market_type,
  };

  return {
    ticket_id: (pick as any).bet_slip_id || pick.id,
    ticket_type: 'single',
    capper_name: presentation.capper_name,
    tier: presentation.tier,
    total_units: presentation.units,
    total_odds_american: null, // Singles don't have total odds
    total_odds_decimal: null,
    leg_count: 1,
    legs: [leg],
    single_pick: presentation, // Full presentation for singles
    primary_sport: pick.sport || 'NBA',
    thumbnail_url: presentation.thumbnail_url,
    created_at: (pick as any).created_at || new Date().toISOString(),
  };
}

/**
 * Build a TicketPresentation for a PARLAY (2+ legs)
 *
 * @param picks - Array of unified_picks rows for the same bet_slip_id
 */
export async function buildParlayTicketPresentation(
  picks: UnifiedPickRow[]
): Promise<TicketPresentation> {
  if (picks.length === 0) {
    throw new Error('Cannot build parlay presentation with zero picks');
  }

  // Sort by leg_index
  const sortedPicks = [...picks].sort((a, b) => {
    const aIdx = (a as any).leg_index ?? 0;
    const bIdx = (b as any).leg_index ?? 0;
    return aIdx - bIdx;
  });

  // Build leg presentations
  const legs: LegPresentation[] = [];
  for (let i = 0; i < sortedPicks.length; i++) {
    const pick = sortedPicks[i];
    const presentation = await buildPickPresentation(pick);
    const legNumber = (pick as any).leg_index ?? (i + 1);
    legs.push(buildLegPresentation(pick, presentation, legNumber));
  }

  // Get ticket-level data from first pick (all legs should have same bet_slip_id data)
  const firstPick = sortedPicks[0] as any;

  // Get total units (from ticket-level field or first leg)
  const totalUnits = firstPick.total_units
    ?? firstPick.units
    ?? sortedPicks.reduce((sum, p) => sum + ((p as any).units ?? 1), 0) / sortedPicks.length;

  // Get total odds (stored on legs)
  const totalOddsAmerican = firstPick.total_ticket_odds_american;
  const totalOddsDecimal = firstPick.total_ticket_odds_decimal;

  // Get capper and tier (same across all legs)
  const capperName = getCapperName(firstPick);
  const tier = firstPick.tier || 'C';

  return {
    ticket_id: firstPick.bet_slip_id || firstPick.id,
    ticket_type: 'parlay',
    capper_name: capperName,
    tier,
    total_units: formatUnitsDisplay(totalUnits),
    total_odds_american: formatTotalOddsAmerican(totalOddsAmerican),
    total_odds_decimal: formatTotalOddsDecimal(totalOddsDecimal),
    leg_count: picks.length,
    legs,
    single_pick: null, // Parlays don't have single_pick
    primary_sport: determinePrimarySport(sortedPicks),
    thumbnail_url: getParlayThumbnail(sortedPicks),
    created_at: firstPick.created_at || new Date().toISOString(),
  };
}

/**
 * Build a TicketPresentation from unified_picks rows
 *
 * Automatically detects if single or parlay based on:
 * - Number of picks
 * - ticket_type field
 * - leg_index field
 *
 * @param picks - Array of unified_picks rows (1 for single, 2+ for parlay)
 */
export async function buildTicketPresentation(
  picks: UnifiedPickRow[]
): Promise<TicketPresentation> {
  if (picks.length === 0) {
    throw new Error('Cannot build ticket presentation with zero picks');
  }

  if (isParlay(picks as any)) {
    return buildParlayTicketPresentation(picks);
  } else {
    return buildSingleTicketPresentation(picks[0]);
  }
}

/**
 * Check if any pick in the ticket is already posted
 * Used for idempotency - if any leg is posted, ticket is already posted
 */
export function isTicketAlreadyPosted(picks: Array<{ posted_to_discord?: boolean; meta?: any }>): boolean {
  return picks.some(pick => {
    if (pick.posted_to_discord === true) return true;
    if (pick.meta?.discord_receipt?.message_id) return true;
    return false;
  });
}

/**
 * Get the discord_message_id if ticket is already posted
 */
export function getExistingDiscordMessageId(picks: Array<{ meta?: any }>): string | null {
  for (const pick of picks) {
    if (pick.meta?.discord_receipt?.message_id) {
      return pick.meta.discord_receipt.message_id;
    }
  }
  return null;
}
