import { z } from 'zod';

export const SPORTS = [
  'NFL',
  'NBA',
  'WNBA',
  'MLB',
  'NHL',
  'NCAAF',
  'NCAAB',
  'UFC/MMA',
  'Boxing',
  'Soccer',
  'Tennis',
  'Golf',
  'NASCAR',
  'F1',
] as const;

export const TICKET_TYPES = ['single', 'parlay', 'teaser', 'round_robin'] as const;

// User tier options
export const USER_TIERS = ['free', 'vip', 'vip_plus'] as const;

// Form step definitions
export const FORM_STEPS = [
  { id: 1, name: 'essentials', title: 'Ticket Essentials', icon: '🎯' },
  { id: 2, name: 'configuration', title: 'Betting Configuration', icon: '⚙️' },
  { id: 3, name: 'bet_details', title: 'Bet Type & Market', icon: '🎲' },
  { id: 4, name: 'selections', title: 'Game & Pick Details', icon: '🏀' },
] as const;

export const ODDS_FORMAT = ['AMERICAN', 'DECIMAL', 'FRACTIONAL'] as const;

/**
 * @deprecated SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036
 * Cappers must be fetched from /api/cappers endpoint.
 * This constant is preserved only for type backward compatibility.
 * DO NOT use for runtime data - will be removed in next major version.
 */
export const CAPPER_OPTIONS = [
  'Select a capper', // Placeholder only
] as const;

export const MARKET_TYPES = [
  'pre_game',
  'live',
  'player_prop',
  'team_prop',
  'game_prop',
  'futures',
] as const;

// Main bet categories
export const BET_CATEGORIES = [
  'spread',
  'total',
  'moneyline',
  'player_prop',
  'team_prop',
  'parlay',
  'teaser',
  'futures',
] as const;

// GAUNTLET-CLOSEOUT-028: Display labels for bet types and ticket types
export const DISPLAY_LABELS: Record<string, string> = {
  // Ticket types
  single: 'Single',
  parlay: 'Parlay',
  teaser: 'Teaser',
  round_robin: 'Round Robin',
  // Bet categories
  spread: 'Spread',
  total: 'Total',
  moneyline: 'Moneyline',
  player_prop: 'Player Prop',
  team_prop: 'Team Prop',
  futures: 'Futures',
  // Market types
  pre_game: 'Pre-Game',
  live: 'Live',
  game_prop: 'Game Prop',
};

// Sport-specific prop types
export const SPORT_PROP_TYPES = {
  NBA: [
    'points',
    'rebounds',
    'assists',
    'threes',
    'steals',
    'blocks',
    'turnovers',
    'minutes',
    'double_double',
    'triple_double',
  ],
  WNBA: [
    'points',
    'rebounds',
    'assists',
    'threes',
    'steals',
    'blocks',
    'turnovers',
    'minutes',
    'double_double',
    'free_throws',
  ],
  NFL: [
    'passing_yards',
    'rushing_yards',
    'receiving_yards',
    'touchdowns',
    'receptions',
    'completions',
    'interceptions',
    'sacks',
    'tackles',
  ],
  MLB: [
    'hits',
    'runs',
    'rbis',
    'strikeouts',
    'home_runs',
    'stolen_bases',
    'walks',
    'innings_pitched',
    'earned_runs',
    'saves',
  ],
  NHL: [
    'goals',
    'assists',
    'points',
    'shots',
    'saves',
    'penalty_minutes',
    'power_play_points',
    'hits',
    'blocked_shots',
  ],
  NCAAB: [
    'points',
    'rebounds',
    'assists',
    'threes',
    'steals',
    'blocks',
    'turnovers',
    'free_throws',
    'fouls',
  ],
  NCAAF: [
    'passing_yards',
    'rushing_yards',
    'receiving_yards',
    'touchdowns',
    'receptions',
    'completions',
    'attempts',
    'interceptions',
    'sacks',
    'tackles',
    'field_goals',
  ],
  'UFC/MMA': ['rounds', 'method', 'fight_time', 'takedowns', 'significant_strikes'],
  Boxing: ['rounds', 'method', 'knockdowns', 'punches_landed', 'connect_percentage'],
  Soccer: ['goals', 'assists', 'shots', 'cards', 'corners', 'offsides', 'saves', 'clean_sheets'],
  Tennis: ['sets', 'games', 'aces', 'double_faults', 'break_points', 'winners', 'unforced_errors'],
  Golf: [
    'score',
    'birdies',
    'eagles',
    'bogeys',
    'fairways_hit',
    'greens_in_regulation',
    'putts',
    'strokes_gained',
  ],
  NASCAR: ['position', 'laps_led', 'top_5', 'top_10', 'fastest_laps', 'stage_wins'],
  F1: ['position', 'fastest_lap', 'points', 'dnf', 'pole_position', 'podium_finish'],
} as const;

// Bet types by category
export const BET_TYPES_BY_CATEGORY = {
  spread: ['point_spread', 'puck_line', 'run_line'],
  total: ['over_under', 'team_total'],
  moneyline: ['moneyline', '3_way_moneyline'],
  player_prop: [], // Will be populated by sport-specific props
  team_prop: ['team_total', 'first_to_score', 'win_margin', 'team_assists', 'team_rebounds'],
  parlay: ['2_leg', '3_leg', '4_leg', '5_leg', '6_leg_plus'],
  teaser: ['6_point', '6.5_point', '7_point', '10_point', '14_point'],
  futures: ['championship', 'division', 'conference', 'mvp', 'awards', 'season_wins'],
} as const;

export type Sport = (typeof SPORTS)[number];
export type TicketType = (typeof TICKET_TYPES)[number];
export type OddsFormat = (typeof ODDS_FORMAT)[number];
export type MarketType = (typeof MARKET_TYPES)[number];
export type BetCategory = (typeof BET_CATEGORIES)[number];
export type UserTier = (typeof USER_TIERS)[number];
export type FormStep = (typeof FORM_STEPS)[number];
export type SportPropType<T extends Sport = Sport> = T extends keyof typeof SPORT_PROP_TYPES
  ? (typeof SPORT_PROP_TYPES)[T][number]
  : string;

// Direction for props and totals
export const DIRECTIONS = ['over', 'under'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export interface TicketLeg {
  id: string;
  sport: Sport;
  bet_category?: BetCategory;
  market_type?: MarketType;
  bet_type?: string;
  game_id?: string;
  team?: string;
  opponent?: string;
  player_name?: string;
  prop_type?: string;
  line?: string;
  odds?: string;
  game_date?: string;
  game_time?: string;
  status: 'open' | 'pending' | 'settled' | 'cancelled';
  // SMARTFORM-UX-CRITICAL-FIXPACK-025: Direction field for props/totals
  direction?: Direction;
}

// Smart form data structure (without risk_amount)
export interface SmartTicketFormData {
  // Step 1: Essentials
  capper: string;
  capper_id?: string; // ACTIVATION-P1-FIXES-001: Store UUID for API submission
  ticket_type: TicketType;
  sport: Sport;
  game_date: string;
  user_tier: UserTier;

  // Step 2: Configuration
  unit_size: number;
  odds_format: OddsFormat;
  auto_parlay: boolean;
  confidence_level: number;

  // Step 3: Bet Details
  bet_type: string;
  market_type: MarketType;

  // Step 4: Selections
  game_selections: GameSelection[];
  legs: TicketLeg[];
  notes?: string;

  // Metadata
  timestamp: string;
  timezone: string;
  status: 'pending' | 'submitted' | 'error';
  current_step: number;
  completed_steps: number[];
}

// Legacy interface for backward compatibility
export interface TicketFormData {
  capper: string;
  ticket_type: 'single' | 'parlay' | 'teaser' | 'round_robin';
  unit_size: number;
  risk_amount: number;
  potential_payout: number;
  odds_format: 'AMERICAN' | 'DECIMAL' | 'FRACTIONAL';
  auto_parlay: boolean;
  sport: Sport;
  game_date: string;
  confidence_level: number;
  user_tier: 'standard' | 'vip' | 'elite';
  timestamp: string;
  timezone: string;
  status: 'pending' | 'submitted' | 'error';
  legs: TicketLeg[];
}

// Smart form validation schema
export const smartTicketFormSchema = z.object({
  // Step 1: Essentials - all required
  capper: z
    .string()
    .min(1, 'Capper selection is required')
    .refine(val => val !== 'Select a capper', 'Please select a valid capper'),
  ticket_type: z.enum(TICKET_TYPES).refine(val => val !== undefined, 'Ticket type is required'),
  sport: z.enum(SPORTS).refine(val => val !== undefined, 'Sport selection is required'),
  game_date: z
    .string()
    .min(1, 'Game date is required')
    .refine(date => {
      // Parse YYYY-MM-DD as local date (not UTC) to avoid timezone mismatch
      const [y, m, d] = date.split('-').map(Number);
      const gameDate = new Date(y, m - 1, d);
      const todayLocal = new Date();
      todayLocal.setHours(0, 0, 0, 0);
      return gameDate >= todayLocal;
    }, 'Cannot select past dates'),
  user_tier: z.enum(USER_TIERS),

  // Step 2: Configuration - all required
  unit_size: z
    .number()
    .min(0.5, 'Minimum unit size is 0.5')
    .max(5, 'Maximum unit size is 5')
    .refine(val => val % 0.5 === 0, 'Unit size must be in 0.5 increments'),
  odds_format: z.enum(ODDS_FORMAT).default('AMERICAN'),
  auto_parlay: z.boolean().default(true),
  confidence_level: z
    .number()
    .min(1, 'Minimum confidence is 1')
    .max(10, 'Maximum confidence is 10')
    .int('Confidence must be a whole number'),

  // Step 3: Bet Details - required
  bet_type: z.string().min(1, 'Bet type is required'),
  market_type: z.enum(MARKET_TYPES).refine(val => val !== undefined, 'Market type is required'),

  // Step 4: Selections - dynamic validation
  game_selections: z
    .array(
      z.object({
        game_id: z.string(),
        selection: z.string(),
        odds: z.string(),
        line: z.string().optional(),
      })
    )
    .min(1, 'At least one selection is required'),

  legs: z.array(
    z.object({
      id: z.string(),
      sport: z.enum(SPORTS),
      market_type: z.enum(MARKET_TYPES),
      bet_type: z.string(),
      game_id: z.string().optional(),
      team: z.string().optional(),
      opponent: z.string().optional(),
      player_name: z.string().optional(),
      prop_type: z.string().optional(),
      line: z.string().optional(),
      odds: z.string().optional(),
      game_date: z.string().optional(),
      game_time: z.string().optional(),
      status: z.enum(['open', 'pending', 'settled', 'cancelled']),
    })
  ),

  notes: z.string().optional(),

  // Metadata
  timestamp: z.string(),
  timezone: z.string(),
  status: z.enum(['pending', 'submitted', 'error']),
  current_step: z.number().min(1).max(4),
  completed_steps: z.array(z.number()),
});

// Legacy schema for backward compatibility
export const ticketFormSchema = z.object({
  capper: z.string().min(1, 'Capper is required'),
  ticket_type: z.enum(['single', 'parlay', 'teaser', 'round_robin']),
  unit_size: z.number().min(0.5).max(5),
  risk_amount: z.number().min(1),
  potential_payout: z.number(),
  odds_format: z.enum(['AMERICAN', 'DECIMAL', 'FRACTIONAL']),
  auto_parlay: z.boolean(),
  sport: z.enum(SPORTS),
  game_date: z.string(),
  confidence_level: z.number().min(1).max(10),
  user_tier: z.enum(['standard', 'vip', 'elite']),
  timestamp: z.string(),
  timezone: z.string(),
  status: z.enum(['pending', 'submitted', 'error']),
  legs: z.array(
    z.object({
      id: z.string(),
      sport: z.enum(SPORTS),
      market_type: z.enum(MARKET_TYPES),
      bet_type: z.string(),
      game_id: z.string().optional(),
      team: z.string().optional(),
      opponent: z.string().optional(),
      player_name: z.string().optional(),
      prop_type: z.string().optional(),
      line: z.string().optional(),
      odds: z.string().optional(),
      game_date: z.string().optional(),
      game_time: z.string().optional(),
      status: z.enum(['open', 'pending', 'settled', 'cancelled']),
    })
  ),
});

export interface EnhancedTicketFormData extends TicketFormData {
  imageAttachments?: File[];
  betCategory?: BetCategory;
}

export const enhancedTicketFormSchema = ticketFormSchema.extend({
  imageAttachments: z.array(z.any()).optional(),
});

export interface EnhancedTicketLeg extends TicketLeg {
  sport: Sport;
  // Remove conflicting properties that are already in TicketLeg
  // betType: BetType; // This conflicts with bet_type
  selection: string;
  // odds: number; // This conflicts with odds: string
  player?: string;
  game?: string;
  // line?: number; // This conflicts with line: string
  confidence: number;
}

export interface SubmissionResult {
  success: boolean;
  ticketId?: string;
  errors?: ValidationError[];
  warnings?: ValidationError[];
  message: string;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  legIndex?: number;
  code?: string;
}

export interface SportConfig {
  name: string;
  betTypes: string[];
  color: string;
  requiresPlayer?: boolean;
  requiresGame?: boolean;
  requiresLine?: boolean;
  minOdds?: number;
  maxOdds?: number;
  logo?: string;
  playerProps?: string[];
  dynamicFields?: string[];
  imageAssets?: {
    playerPath?: string;
    teamPath?: string;
    [key: string]: string | undefined;
  };
  validation?: {
    maxParlay?: number;
    minOdds?: number;
    maxOdds?: number;
    [key: string]: any;
  };
}

export interface PlayerSearchResult {
  id: string;
  name: string;
  team: string;
  position: string;
  sport: string;
  league: string;
  // Database column names
  player_name?: string;
  image_url?: string;
  team_logo?: string;
  recent_performance?: any;
  injury_status?: string;
  player_id?: string;
}

export interface GameSearchResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  sport: string;
  league: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'POSTPONED';
  // Database column names
  home_team?: string;
  away_team?: string;
  game_date?: string;
  game_time?: string;
  matchup?: string;
  home_logo?: string;
  away_logo?: string;
  weather?: any;
}

// Game selection interface for step 4
export interface GameSelection {
  id?: string; // Optional unique identifier for the selection
  game_id?: string; // GAUNTLET-CLOSEOUT-028: Optional for manual entries
  selection: string; // What user picked (team, over/under, etc)
  odds: string;
  line?: string;
  confidence?: number;
  game?: string; // Optional game description
  // PARITY-GATE-001 Stage 7: Manual entry fields for dual-mode
  source?: 'api' | 'manual';
  manual_home_team?: string;
  manual_away_team?: string;
  manual_game_date?: string;
  // Pre-existing fields used by GamePickForm
  bet_type?: string;
  sport?: string;
  team_id?: string;
  player_id?: string; // GAUNTLET-CLOSEOUT-028: For player prop entries
  player_name?: string; // GAUNTLET-CLOSEOUT-028: For player prop entries
  player_headshot_url?: string;
  team_logo_url?: string;
  home_team_logo_url?: string;
  away_team_logo_url?: string;
}

// Step validation interface
export interface StepValidation {
  step: number;
  isValid: boolean;
  errors: ValidationError[];
  canProceed: boolean;
}

// Form state management
export interface FormState {
  currentStep: number;
  completedSteps: number[];
  data: Partial<SmartTicketFormData>;
  validation: { [key: number]: StepValidation };
  isSubmitting: boolean;
}

// Field dependency configuration
export interface FieldDependency {
  field: string;
  dependsOn: string[];
  condition: (values: any) => boolean;
  action: 'show' | 'hide' | 'enable' | 'disable' | 'reset';
}

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Renamed to avoid conflict with canonical CappersRow
export interface TicketCapper {
  id: string;
  name: string;
  active?: boolean;
  stats?: {
    winRate?: number;
    roi?: number;
    lastPick?: string;
    isLive?: boolean;
  };
}

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Legacy alias for backward compatibility
export type Capper = TicketCapper;

// Sport configuration with enhanced features
export interface SportConfigEnhanced extends SportConfig {
  icon: string;
  primaryBetTypes: BetCategory[];
  popularProps?: string[];
  trendingStats?: {
    popularBets: string[];
    winRates: { [key: string]: number };
    marketInsights: string[];
  };
}
