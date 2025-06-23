import { z } from "zod";

export const SPORTS = ["NBA", "MLB", "NFL"] as const;
export const BET_TYPES = ["Player Prop", "Moneyline", "Spread", "Total", "Team Total"] as const;
export const TICKET_TYPES = ["Single", "Parlay", "Teaser", "Round Robin"] as const;
export const CAPPER_OPTIONS = [
  "Griff", "Noah", "Jeffro", "Vicgo", "Sauced",
  "MoneyReef", "Squirrel", "Ziplock", "Jaybird", "Polo"
] as const;

export const STAT_TYPES_BY_SPORT = {
  NBA: ["PTS", "AST", "REB", "3PM", "BLK", "STL", "PRA", "PR", "RA", "TO"],
  MLB: ["TB", "H", "R", "RBI", "BB", "K", "SB", "HR", "Outs"],
  NFL: ["Rush Yds", "Rec Yds", "Pass Yds", "Pass TDs", "INT"],
} as const;

export type Sport = typeof SPORTS[number];
export type BetType = typeof BET_TYPES[number];
export type TicketType = typeof TICKET_TYPES[number];
export type CapperName = typeof CAPPER_OPTIONS[number];
export type StatType = typeof STAT_TYPES_BY_SPORT[Sport][number];

export interface Player {
  id: string;
  player_name: string;
  team: string;
  photo_url?: string;
  stat_type?: string;
  line?: string;
  odds?: string;
}

export interface Game {
  id: string;
  matchup: string;
  home_team: string;
  away_team: string;
  odds?: string;
  game_date: string;
  sport: Sport;
}

export interface SearchResults {
  [key: number]: {
    props: Player[];
    games: Game[];
  };
}

export interface TicketLeg {
  id: string;
  bet_type: BetType;
  stat_type: string;
  player_name: string;
  team: string;
  line: string;
  odds: string;
  outcome: "Over" | "Under" | "";
  matchup: string;
  is_primary: boolean;
  created_at: string;
  risk_level?: "Low" | "Medium" | "High";
  edge?: number;
  marketing_tags?: string[];
}

export const ticketLegSchema = z.object({
  id: z.string().uuid(),
  bet_type: z.enum(BET_TYPES),
  stat_type: z.string(),
  player_name: z.string(),
  team: z.string(),
  line: z.string(),
  odds: z.string(),
  outcome: z.enum(["Over", "Under", ""]),
  matchup: z.string(),
  is_primary: z.boolean(),
  created_at: z.string(),
  risk_level: z.enum(["Low", "Medium", "High"]).optional(),
  edge: z.number().optional(),
  marketing_tags: z.array(z.string()).optional()
});

export const ticketFormSchema = z.object({
  capper: z.enum(CAPPER_OPTIONS),
  ticket_type: z.enum(TICKET_TYPES),
  unit_size: z.number().min(0.5).max(5).step(0.5),
  auto_parlay: z.boolean(),
  sport: z.enum(SPORTS),
  game_date: z.string(),
  legs: z.array(ticketLegSchema).min(1)
});

// Additional types for enhanced form functionality
export interface EnhancedTicketFormData extends TicketFormData {
  imageAttachments?: File[];
  betType?: BetType;
}

export const enhancedTicketFormSchema = ticketFormSchema.extend({
  confidence_level: z.number().min(1).max(10).optional(),
  imageAttachments: z.array(z.instanceof(File)).optional(),
  betType: z.enum(BET_TYPES).optional()
});

export type TicketFormData = z.infer<typeof ticketFormSchema>;

// Additional types for enhanced form functionality
export interface EnhancedTicketFormData extends TicketFormData {
  imageAttachments?: File[];
  betType?: BetType;
}

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
  lines?: any;
}

// Export the schema for enhanced form
// (Already defined above with extensions) 