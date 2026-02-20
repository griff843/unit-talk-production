/**
 * SPRINT-SMARTFORM-V2-MATCHUP-FIRST-063
 *
 * V2 Types for One-Page Sportsbook Builder (Manual-First)
 *
 * Key principles:
 * - Matchup is REQUIRED for every ticket (manually built from team selections)
 * - Units are REQUIRED before submit
 * - All legs belong to a matchup
 * - Player/market selections filter to matchup teams
 */

import { Sport, TicketType, BetCategory, Direction } from '../types';

// =============================================================================
// TEAM TYPES (from catalog API)
// =============================================================================

export interface CatalogTeam {
  id: string;
  name: string;
  abbr: string | null;
  sport: string;
  team_uuid?: string | null;
  logo_url?: string | null;
}

// =============================================================================
// MANUAL MATCHUP (user-built)
// =============================================================================

export interface ManualMatchup {
  sport: Sport;
  away_team: CatalogTeam;
  home_team: CatalogTeam;
  game_date: string;
  game_time?: string; // Optional HH:MM
}

/**
 * Check if a manual matchup is complete (both teams selected)
 */
export function isMatchupComplete(
  matchup: Partial<ManualMatchup> | null
): matchup is ManualMatchup {
  return !!(
    matchup &&
    matchup.sport &&
    matchup.away_team?.id &&
    matchup.home_team?.id &&
    matchup.game_date
  );
}

/**
 * Get display label for matchup
 */
export function getMatchupDisplayLabel(matchup: ManualMatchup): string {
  const away = matchup.away_team.abbr || matchup.away_team.name;
  const home = matchup.home_team.abbr || matchup.home_team.name;
  return `${away} @ ${home}`;
}

// =============================================================================
// BET LEG TYPES
// =============================================================================

export interface BetLeg {
  id: string;
  sport: Sport;

  // Bet details
  bet_type: 'player_prop' | 'spread' | 'moneyline' | 'total' | 'team_total';
  stat_type: string; // PTS, REB, AST, etc.
  selection: string; // "Over", "Under", team name, etc.
  direction?: Direction;

  // Line and odds
  line: number;
  odds: number; // American format integer

  // Player (for player props)
  player_id?: string;
  player_name?: string;

  // Team (for team bets)
  team_id?: string;
  team_name?: string;

  // Source (always 'manual' in V2)
  source: 'manual';

  // Matchup fields (REQUIRED - from ManualMatchup)
  manual_matchup_home: string;
  manual_matchup_away: string;
  manual_game_date: string;

  // Confidence (optional, 0-10)
  confidence: number;
}

// =============================================================================
// FORM STATE
// =============================================================================

export interface V2FormState {
  // Selected capper (required)
  capper_id: string | null;
  capper_name: string | null;

  // Current sport
  sport: Sport;

  // Manual matchup builder state
  matchup: {
    away_team: CatalogTeam | null;
    home_team: CatalogTeam | null;
    game_date: string;
    game_time: string;
  };

  // Bet slip legs
  legs: BetLeg[];

  // Units (required, 0.5-10)
  units: number;

  // Ticket type (derived from leg count)
  ticket_type: TicketType;

  // Notes (optional)
  notes: string;

  // UI state
  isSubmitting: boolean;
  submitError: string | null;

  // Market filter (for MarketBoard)
  marketCategory: BetCategory | 'all';
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface TeamsResponse {
  teams: CatalogTeam[];
  meta: {
    total: number;
    sport: string;
    query?: string | null;
    source: string;
    cache_hit: boolean;
    timestamp: string;
  };
}

export interface CappersResponse {
  cappers: Array<{
    id: string;
    name: string;
    username: string;
    active: boolean;
    stats?: {
      win_rate?: number;
      roi?: number;
    };
  }>;
}

export interface PlayersResponse {
  players: Array<{
    player_id: string;
    player_name: string;
    sport: string;
    team_id: string | null;
    team_name: string | null;
    team_abbr: string | null;
    position: string | null;
    headshot_url: string | null;
  }>;
  meta: {
    total: number;
    sport: string;
    team_id?: string | null;
    query?: string | null;
  };
}

// =============================================================================
// SUBMISSION PAYLOAD
// =============================================================================

export interface V2SubmitPayload {
  capper_id: string;
  sport: Sport;
  ticket_type: TicketType;
  total_units: number;
  notes?: string;
  idempotency_key?: string;
  selections: Array<{
    sport: Sport;
    team_id?: string;
    player_id?: string;
    player_name?: string;
    bet_type: string;
    team?: string;
    stat_type: string;
    line: number;
    leg_odds: number;
    source: 'manual';
    is_live: boolean;
    selection: string;
    direction?: 'over' | 'under';
    confidence: number;
    manual_matchup_home: string;
    manual_matchup_away: string;
    manual_game_date: string;
  }>;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface SportPillsProps {
  selected: Sport;
  onSelect: (sport: Sport) => void;
}

export interface MatchupBuilderProps {
  sport: Sport;
  awayTeam: CatalogTeam | null;
  homeTeam: CatalogTeam | null;
  gameDate: string;
  gameTime: string;
  onAwayTeamChange: (team: CatalogTeam | null) => void;
  onHomeTeamChange: (team: CatalogTeam | null) => void;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  disabled?: boolean;
}

export interface MarketBoardProps {
  sport: Sport;
  awayTeam: CatalogTeam;
  homeTeam: CatalogTeam;
  gameDate: string;
  onAddLeg: (leg: Omit<BetLeg, 'id'>) => void;
  marketCategory: BetCategory | 'all';
  onCategoryChange: (category: BetCategory | 'all') => void;
}

export interface BetSlipProps {
  capper_id: string | null;
  capper_name: string | null;
  matchupComplete: boolean;
  matchupLabel: string | null;
  legs: BetLeg[];
  units: number;
  notes: string;
  isSubmitting: boolean;
  submitError: string | null;
  onCapperSelect: (id: string, name: string) => void;
  onRemoveLeg: (legId: string) => void;
  onEditLeg: (legId: string, updates: Partial<BetLeg>) => void;
  onUnitsChange: (units: number) => void;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  onClearAll: () => void;
}

export interface PlayerPropFormProps {
  sport: Sport;
  awayTeam: CatalogTeam;
  homeTeam: CatalogTeam;
  gameDate: string;
  onAddLeg: (leg: Omit<BetLeg, 'id'>) => void;
}

export interface UnitsInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export interface OddsPillProps {
  odds: number;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface V2ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateV2Form(state: V2FormState): V2ValidationResult {
  const errors: string[] = [];

  if (!state.capper_id) {
    errors.push('Capper is required');
  }

  // Matchup must be complete
  if (!state.matchup.away_team || !state.matchup.home_team) {
    errors.push('Matchup is required (select both teams)');
  }

  if (!state.matchup.game_date) {
    errors.push('Game date is required');
  }

  if (state.legs.length === 0) {
    errors.push('Add at least one bet to your slip');
  }

  if (state.units < 0.5 || state.units > 10) {
    errors.push('Units must be between 0.5 and 10');
  }

  // Validate each leg has required fields
  state.legs.forEach((leg, index) => {
    if (!leg.stat_type) {
      errors.push(`Leg ${index + 1}: Market type is required`);
    }
    if (!leg.selection) {
      errors.push(`Leg ${index + 1}: Selection is required`);
    }
    if (!leg.odds || leg.odds === 0) {
      errors.push(`Leg ${index + 1}: Odds are required`);
    }
    if (!leg.manual_matchup_home || !leg.manual_matchup_away) {
      errors.push(`Leg ${index + 1}: Matchup is required`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

export function getTicketType(legCount: number): TicketType {
  if (legCount <= 1) return 'single';
  return 'parlay';
}

export function formatOdds(odds: number): string {
  if (odds >= 0) return `+${odds}`;
  return odds.toString();
}

export function calculateParlayOdds(legs: BetLeg[]): number {
  if (legs.length < 2) return legs[0]?.odds || 0;

  // Convert American odds to decimal, multiply, convert back
  const decimalOdds = legs.map(leg => {
    if (leg.odds > 0) {
      return leg.odds / 100 + 1;
    } else {
      return 100 / Math.abs(leg.odds) + 1;
    }
  });

  const combinedDecimal = decimalOdds.reduce((acc, odds) => acc * odds, 1);

  // Convert back to American
  if (combinedDecimal >= 2) {
    return Math.round((combinedDecimal - 1) * 100);
  } else {
    return Math.round(-100 / (combinedDecimal - 1));
  }
}

export function generateLegId(): string {
  return `leg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
