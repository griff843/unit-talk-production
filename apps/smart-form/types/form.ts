/**
 * Central Type System for Production-Grade Smart Form
 *
 * This file consolidates all form-related types with strict TypeScript enforcement.
 * Designed for compatibility with both unified_picks and canonical picks drivers.
 */

import { z } from 'zod';

// ============================================================================
// CORE TYPES
// ============================================================================

export const LEAGUES = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA'] as const;
export type League = (typeof LEAGUES)[number];

export const SIDES = ['over', 'under', 'yes', 'no'] as const;
export type Side = (typeof SIDES)[number];

// ============================================================================
// MARKET TYPES BY LEAGUE
// ============================================================================

export const NBA_MARKET_TYPES = [
  'points',
  'rebounds',
  'assists',
  'threes',
  'steals',
  'blocks',
  'turnovers',
  'pts_rebs_asts',
  'double_double',
  'triple_double',
] as const;

export const NFL_MARKET_TYPES = [
  'passing_yards',
  'rushing_yards',
  'receiving_yards',
  'total_yards',
  'touchdowns',
  'receptions',
  'completions',
  'interceptions',
  'pass_attempts',
  'rush_attempts',
] as const;

export const MLB_MARKET_TYPES = [
  'hits',
  'runs',
  'rbis',
  'home_runs',
  'stolen_bases',
  'total_bases',
  'strikeouts_pitcher',
  'strikeouts_batter',
  'walks',
  'earned_runs',
  'innings_pitched',
  'outs_recorded',
] as const;

export const NHL_MARKET_TYPES = [
  'goals',
  'assists',
  'points',
  'shots_on_goal',
  'saves',
  'blocked_shots',
  'power_play_points',
  'penalty_minutes',
] as const;

export const NCAAB_MARKET_TYPES = NBA_MARKET_TYPES;
export const NCAAF_MARKET_TYPES = NFL_MARKET_TYPES;
export const WNBA_MARKET_TYPES = NBA_MARKET_TYPES;

export type NBAMarketType = (typeof NBA_MARKET_TYPES)[number];
export type NFLMarketType = (typeof NFL_MARKET_TYPES)[number];
export type MLBMarketType = (typeof MLB_MARKET_TYPES)[number];
export type NHLMarketType = (typeof NHL_MARKET_TYPES)[number];

export type MarketType =
  | NBAMarketType
  | NFLMarketType
  | MLBMarketType
  | NHLMarketType;

// Map league to its market types
export type MarketTypeForLeague<L extends League> =
  L extends 'NBA' | 'NCAAB' | 'WNBA' ? NBAMarketType :
  L extends 'NFL' | 'NCAAF' ? NFLMarketType :
  L extends 'MLB' ? MLBMarketType :
  L extends 'NHL' ? NHLMarketType :
  never;

// ============================================================================
// CAPPER
// ============================================================================

export interface Capper {
  id: string;
  name: string;
  active: boolean;
  tier?: string;
  discordId?: string | null;
  stats?: {
    winRate?: number;
    roi?: number;
    totalPicks?: number;
    recentForm?: string;
  };
}

export const CapperSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  active: z.boolean(),
  tier: z.string().optional(),
  discordId: z.string().nullable().optional(),
  stats: z.object({
    winRate: z.number().optional(),
    roi: z.number().optional(),
    totalPicks: z.number().optional(),
    recentForm: z.string().optional(),
  }).optional(),
});

// ============================================================================
// PLAYER
// ============================================================================

export interface Player {
  id: string;
  name: string;
  team: string;
  position?: string;
  league: League;
  headshotUrl?: string | null;
  injury_status?: string | null;
}

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  team: z.string().min(1),
  position: z.string().optional(),
  league: z.enum(LEAGUES),
  headshotUrl: z.string().url().nullable().optional(),
  injury_status: z.string().nullable().optional(),
});

// ============================================================================
// GAME REFERENCE
// ============================================================================

export interface GameRef {
  id: string | null;  // Can be null if game not yet scheduled
  homeTeam: string;
  awayTeam: string;
  dateISO: string;  // YYYY-MM-DD format
  timeUTC?: string | null;  // HH:MM:SS format
  venue?: string | null;
  status?: 'scheduled' | 'live' | 'completed' | 'postponed';
}

export const GameRefSchema = z.object({
  id: z.string().nullable(),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeUTC: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).nullable().optional(),
  venue: z.string().nullable().optional(),
  status: z.enum(['scheduled', 'live', 'completed', 'postponed']).optional(),
});

// ============================================================================
// PICK INPUT (FOR SUBMISSION)
// ============================================================================

export interface PickInput {
  capperId: string;
  league: League;
  playerId: string;
  playerName: string;
  gameId: string | null;  // Optional if game not yet created
  gameDate: string;  // YYYY-MM-DD
  marketType: MarketType;
  line: number;
  side: Side;
  stakeText: string;  // User's written analysis (3-500 chars)
  userScore?: number;  // Optional confidence score 1-10
  teamId?: string | null;
  odds?: number;  // American odds format
}

export const PickInputSchema = z.object({
  capperId: z.string().uuid('Invalid capper ID'),
  league: z.enum(LEAGUES),
  playerId: z.string().min(1, 'Player ID required'),
  playerName: z.string().min(1, 'Player name required'),
  gameId: z.string().nullable(),
  gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
  marketType: z.string().min(1, 'Market type required'),
  line: z.number().finite('Line must be a valid number'),
  side: z.enum(SIDES),
  stakeText: z.string()
    .min(3, 'Stake text must be at least 3 characters')
    .max(500, 'Stake text cannot exceed 500 characters'),
  userScore: z.number().int().min(1).max(10).optional(),
  teamId: z.string().nullable().optional(),
  odds: z.number().int().optional(),
});

// ============================================================================
// MARKET CATALOG (PER LEAGUE)
// ============================================================================

export interface MarketConfig {
  key: MarketType;
  label: string;
  defaultLine?: number;
  step?: number;  // For numeric input (0.5 for NBA, 1 for NFL, etc.)
  oddsFormat?: 'american' | 'decimal' | 'fractional';
}

export const NBA_MARKET_CATALOG: Record<NBAMarketType, MarketConfig> = {
  points: { key: 'points', label: 'Points', defaultLine: 20, step: 0.5 },
  rebounds: { key: 'rebounds', label: 'Rebounds', defaultLine: 8, step: 0.5 },
  assists: { key: 'assists', label: 'Assists', defaultLine: 5, step: 0.5 },
  threes: { key: 'threes', label: '3-Pointers Made', defaultLine: 2, step: 0.5 },
  steals: { key: 'steals', label: 'Steals', defaultLine: 1, step: 0.5 },
  blocks: { key: 'blocks', label: 'Blocks', defaultLine: 1, step: 0.5 },
  turnovers: { key: 'turnovers', label: 'Turnovers', defaultLine: 2, step: 0.5 },
  pts_rebs_asts: { key: 'pts_rebs_asts', label: 'Pts + Rebs + Asts', defaultLine: 30, step: 0.5 },
  double_double: { key: 'double_double', label: 'Double-Double', step: 1 },
  triple_double: { key: 'triple_double', label: 'Triple-Double', step: 1 },
};

export const NFL_MARKET_CATALOG: Record<NFLMarketType, MarketConfig> = {
  passing_yards: { key: 'passing_yards', label: 'Passing Yards', defaultLine: 250, step: 0.5 },
  rushing_yards: { key: 'rushing_yards', label: 'Rushing Yards', defaultLine: 75, step: 0.5 },
  receiving_yards: { key: 'receiving_yards', label: 'Receiving Yards', defaultLine: 60, step: 0.5 },
  total_yards: { key: 'total_yards', label: 'Total Yards', defaultLine: 300, step: 0.5 },
  touchdowns: { key: 'touchdowns', label: 'Touchdowns', defaultLine: 1, step: 0.5 },
  receptions: { key: 'receptions', label: 'Receptions', defaultLine: 5, step: 0.5 },
  completions: { key: 'completions', label: 'Completions', defaultLine: 20, step: 0.5 },
  interceptions: { key: 'interceptions', label: 'Interceptions', defaultLine: 0.5, step: 0.5 },
  pass_attempts: { key: 'pass_attempts', label: 'Pass Attempts', defaultLine: 30, step: 0.5 },
  rush_attempts: { key: 'rush_attempts', label: 'Rush Attempts', defaultLine: 15, step: 0.5 },
};

export const MLB_MARKET_CATALOG: Record<MLBMarketType, MarketConfig> = {
  hits: { key: 'hits', label: 'Hits', defaultLine: 1, step: 0.5 },
  runs: { key: 'runs', label: 'Runs', defaultLine: 1, step: 0.5 },
  rbis: { key: 'rbis', label: 'RBIs', defaultLine: 1, step: 0.5 },
  home_runs: { key: 'home_runs', label: 'Home Runs', defaultLine: 0.5, step: 0.5 },
  stolen_bases: { key: 'stolen_bases', label: 'Stolen Bases', defaultLine: 0.5, step: 0.5 },
  total_bases: { key: 'total_bases', label: 'Total Bases', defaultLine: 1.5, step: 1.0 },
  strikeouts_pitcher: { key: 'strikeouts_pitcher', label: 'Strikeouts (Pitcher)', defaultLine: 5.5, step: 0.5 },
  strikeouts_batter: { key: 'strikeouts_batter', label: 'Strikeouts (Batter)', defaultLine: 1.5, step: 0.5 },
  walks: { key: 'walks', label: 'Walks', defaultLine: 0.5, step: 0.5 },
  earned_runs: { key: 'earned_runs', label: 'Earned Runs', defaultLine: 2.5, step: 0.5 },
  innings_pitched: { key: 'innings_pitched', label: 'Innings Pitched', defaultLine: 5.5, step: 0.5 },
  outs_recorded: { key: 'outs_recorded', label: 'Outs Recorded', defaultLine: 15.5, step: 0.5 },
};

export const NHL_MARKET_CATALOG: Record<NHLMarketType, MarketConfig> = {
  goals: { key: 'goals', label: 'Goals', defaultLine: 0.5, step: 0.5 },
  assists: { key: 'assists', label: 'Assists', defaultLine: 0.5, step: 0.5 },
  points: { key: 'points', label: 'Points', defaultLine: 0.5, step: 0.5 },
  shots_on_goal: { key: 'shots_on_goal', label: 'Shots on Goal', defaultLine: 3.5, step: 0.5 },
  saves: { key: 'saves', label: 'Saves', defaultLine: 25.5, step: 0.5 },
  blocked_shots: { key: 'blocked_shots', label: 'Blocked Shots', defaultLine: 2.5, step: 0.5 },
  power_play_points: { key: 'power_play_points', label: 'Power Play Points', defaultLine: 0.5, step: 0.5 },
  penalty_minutes: { key: 'penalty_minutes', label: 'Penalty Minutes', defaultLine: 1.5, step: 0.5 },
};

export function getMarketCatalog(league: League): Record<string, MarketConfig> {
  switch (league) {
    case 'NBA':
    case 'NCAAB':
    case 'WNBA':
      return NBA_MARKET_CATALOG;
    case 'NFL':
    case 'NCAAF':
      return NFL_MARKET_CATALOG;
    case 'MLB':
      return MLB_MARKET_CATALOG;
    case 'NHL':
      return NHL_MARKET_CATALOG;
    default:
      return {};
  }
}

// ============================================================================
// DISCORD EMBED
// ============================================================================

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  thumbnail?: {
    url: string;
  };
  footer?: {
    text: string;
    icon_url?: string;
  };
  timestamp?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

// ============================================================================
// REPOSITORY INTERFACES (DRIVER ABSTRACTION)
// ============================================================================

export interface PickRecord {
  id: string;
  bet_slip_id: string;
  user_id: string;
  league: League;
  player_id: string;
  game_id: string | null;
  game_date: string;
  stat_type: MarketType;
  line: number;
  side: Side;
  odds?: number;
  stake_text?: string;
  user_score?: number;
  created_at: string;
}

export interface InsertPickResult {
  id: string;
  bet_slip_id: string;
  created_at: string;
}
