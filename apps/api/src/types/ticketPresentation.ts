/**
 * TICKET_PRESENTATION_STANDARD
 *
 * This contract defines the presentation-ready format for tickets (single or parlay)
 * displayed in Discord embeds.
 *
 * PARLAY-DISCORD-GROUPING-001: New ticket-level presentation type
 *
 * @see docs/contracts/DISCORD_EMBED_CONTRACT.md
 */

import { PickPresentation, PickMarketType } from './pickPresentation';

/**
 * Ticket types supported
 */
export type TicketType = 'single' | 'parlay';

/**
 * LegPresentation - A single leg within a parlay ticket
 *
 * Simpler than PickPresentation for embed display.
 * Contains only the fields needed for parlay leg display.
 */
export interface LegPresentation {
  /**
   * Position in parlay (1-indexed for display)
   */
  leg_number: number;

  /**
   * The main title of the leg (e.g., "Lakers -3.5", "Over 220.5")
   */
  title: string;

  /**
   * American odds formatted with +/- prefix
   */
  odds_american: string;

  /**
   * Market type label (e.g., "Spread", "Total Points", "Player – Points OU")
   */
  market_label: string;

  /**
   * Matchup string (e.g., "Heat @ Lakers")
   */
  matchup: string | null;

  /**
   * Sport code
   */
  sport: string;

  /**
   * Underlying pick ID
   */
  pick_id: string;

  /**
   * Market type for internal use
   */
  market_type: PickMarketType;
}

/**
 * TicketPresentation - The canonical presentation format for a ticket (single or parlay)
 *
 * For singles: Contains one pick
 * For parlays: Contains 2+ legs with total odds/units
 */
export interface TicketPresentation {
  /**
   * Unique identifier for the ticket
   * Maps to bet_slip_id in unified_picks
   */
  ticket_id: string;

  /**
   * Ticket type: 'single' or 'parlay'
   */
  ticket_type: TicketType;

  /**
   * Capper display name
   */
  capper_name: string;

  /**
   * Capper tier (S, A, B, C, D)
   */
  tier: string;

  /**
   * Total units for the ticket
   */
  total_units: string;

  /**
   * Total odds in American format (for parlays)
   * null for singles
   */
  total_odds_american: string | null;

  /**
   * Total odds in decimal format (for parlays)
   * null for singles
   */
  total_odds_decimal: string | null;

  /**
   * Number of legs in the ticket
   * 1 for singles, 2+ for parlays
   */
  leg_count: number;

  /**
   * Individual legs (for parlays)
   * For singles, this will contain one LegPresentation
   */
  legs: LegPresentation[];

  /**
   * For singles only: full PickPresentation
   * null for parlays (use legs instead)
   */
  single_pick: PickPresentation | null;

  /**
   * Primary sport (most common sport across legs, or single pick's sport)
   */
  primary_sport: string;

  /**
   * Thumbnail URL for embed
   * For parlays: Unit Talk logo or primary sport logo
   * For singles: team/player thumbnail
   */
  thumbnail_url: string;

  /**
   * ISO timestamp when ticket was created
   */
  created_at: string;
}

/**
 * Format total odds for display
 * Handles the +/- prefix for American odds
 */
export function formatTotalOddsAmerican(odds: number | null | undefined): string | null {
  if (odds === null || odds === undefined) return null;
  return odds > 0 ? `+${Math.round(odds)}` : `${Math.round(odds)}`;
}

/**
 * Format total odds decimal for display
 */
export function formatTotalOddsDecimal(odds: number | string | null | undefined): string | null {
  if (odds === null || odds === undefined) return null;
  const num = typeof odds === 'string' ? parseFloat(odds) : odds;
  if (isNaN(num)) return null;
  return num.toFixed(2);
}

/**
 * Format parlay title based on leg count
 * Examples: "2-Leg Parlay", "3-Leg Parlay"
 */
export function formatParlayTitle(legCount: number): string {
  return `${legCount}-Leg Parlay`;
}

/**
 * Get display limit for legs (show first N, then "+M more")
 */
export const MAX_DISPLAY_LEGS = 6;

/**
 * Check if a set of picks constitutes a parlay
 */
export function isParlay(
  picks: Array<{ ticket_type?: string; leg_index?: number | null }>
): boolean {
  if (picks.length === 0) return false;
  if (picks.length > 1) return true;
  if (picks[0]?.ticket_type === 'parlay') return true;
  if (picks[0]?.leg_index !== null && picks[0]?.leg_index !== undefined) return true;
  return false;
}
