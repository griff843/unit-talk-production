/**
 * PICK_PRESENTATION_STANDARD
 *
 * This contract defines the presentation-ready format for individual picks
 * displayed in Discord embeds.
 *
 * DISCORD-UX-OVERHAUL-001: Standardized pick presentation
 * EMBED-PRODUCTION-CONTRACT-030: Production embed format
 *
 * @see docs/contracts/PICK_PRESENTATION_STANDARD.md
 */

/**
 * Market types for picks
 */
export type PickMarketType =
  | 'player_prop'
  | 'spread'
  | 'moneyline'
  | 'total'
  | 'team_total'
  | 'unknown';

/**
 * Unified picks row type from database
 * Simplified type for presentation builder
 */
export interface UnifiedPickRow {
  id: string;
  bet_slip_id?: string;
  user_id?: string;
  sport: string;
  stat_type?: string;
  bet_type?: string;
  selection?: string;
  line?: number | null;
  odds?: number;
  player_name?: string;
  player_id?: string;
  team?: string;
  matchup?: string;
  tier?: string;
  unit_size?: number;
  units?: number;
  ticket_type?: 'single' | 'parlay';
  leg_index?: number | null;
  direction?: string;
  side?: string;
  manual_matchup_home?: string;
  manual_matchup_away?: string;
  manual_fields_blob?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  created_at?: string;
  posted_to_discord?: boolean;
}

/**
 * PickPresentation - The canonical presentation format for a single pick
 *
 * This is the standardized format used by Discord embed builders.
 * All picks must be converted to this format before display.
 */
export interface PickPresentation {
  /**
   * The main title of the pick
   * Examples:
   * - Player prop: "LeBron James Over 25.5"
   * - Spread: "Lakers -3.5"
   * - Moneyline: "Lakers"
   * - Total: "Over 220.5"
   */
  title: string;

  /**
   * American odds formatted with +/- prefix
   * Examples: "+150", "-110"
   */
  odds_american: string;

  /**
   * Units wagered formatted for display
   * Examples: "1U", "2U", "0.5U"
   */
  units: string;

  /**
   * Capper tier (S, A, B, C, D)
   */
  tier: string;

  /**
   * Capper display name
   */
  capper_name: string;

  /**
   * Market type label for display
   * Examples: "Points OU", "Spread", "Moneyline", "Game Total"
   */
  market_label: string;

  /**
   * Context line with sport/matchup/time
   * Example: "NBA • Heat @ Lakers"
   */
  context_line: string;

  /**
   * Thumbnail URL for embed (team logo or player headshot)
   * Fallback chain: headshot -> team logo -> league logo
   */
  thumbnail_url: string;

  /**
   * Internal market type for processing
   */
  market_type: PickMarketType;
}

/**
 * Format units for display
 */
export function formatUnitsDisplay(units: number | string | null | undefined): string {
  if (units === null || units === undefined) return '1U';
  const num = typeof units === 'string' ? parseFloat(units) : units;
  if (isNaN(num)) return '1U';
  return `${num}U`;
}

/**
 * Format American odds with +/- prefix
 */
export function formatOddsAmerican(odds: number | null | undefined): string {
  if (odds === null || odds === undefined) return '-110';
  return odds > 0 ? `+${odds}` : `${odds}`;
}
