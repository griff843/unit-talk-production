// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Canonical types from shared-types
import { z } from 'zod';

// Import canonical Database type from shared-types
import type {
  Database,
  RawPropsRow,
  GamesRow,
  TeamsRow,
  PlayersRow,
  UnifiedPicksRow,
  AgentHealthRow,
} from '@unit-talk/shared-types';

// Re-export canonical types with local aliases
export type RawProp = RawPropsRow;
export type Game = GamesRow;
export type Team = TeamsRow;
export type Player = PlayersRow;
export type UnifiedPick = UnifiedPicksRow;
export type AgentHealth = AgentHealthRow;

// Zod schemas for runtime validation
export const RawPropSchema = z.object({
  id: z.string().uuid(),
  player_id: z.string().optional(),
  player_name: z.string().nullable(),
  team: z.string().nullable(),
  opponent: z.string().nullable(),
  market: z.string().optional(),
  stat_type: z.string(),
  market_type: z.string(),
  line: z.number().nullable(),
  odds: z.number().nullable(),
  over_odds: z.number().optional(),
  under_odds: z.number().optional(),
  game_time: z.string().optional(),
  league: z.string().optional(),
  source: z.string().nullable(),
  sport: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  status: z.string(),
});

export const GameSchema = z.object({
  id: z.string().uuid(),
  sport: z.string(),
  league: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  game_date: z.string(),
  start_time: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  meta: z.record(z.unknown()).nullable(),
});

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sport: z.string(),
  abbreviation: z.string(),
  active: z.boolean(),
  league: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PlayerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  team_id: z.string().uuid(),
  position: z.string(),
  sport: z.string(),
  active: z.boolean(),
  league: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

// DailyPick - local definition (deprecated table)
export interface DailyPick {
  id: string;
  raw_prop_id: string;
  player_id: string;
  game_id: string;
  market: string;
  line: number;
  over: number;
  under: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export const DailyPickSchema = z.object({
  id: z.string().uuid(),
  raw_prop_id: z.string().uuid(),
  player_id: z.string().uuid(),
  game_id: z.string().uuid(),
  market: z.string(),
  line: z.number(),
  over: z.number(),
  under: z.number(),
  grade: z.enum(['S', 'A', 'B', 'C', 'D', 'F']),
  confidence: z.number(),
  status: z.enum(['pending', 'approved', 'rejected']),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const UnifiedPickSchema = z.object({
  id: z.string().uuid(),
  player_name: z.string().nullable(),
  sport: z.string().nullable(),
  stat_type: z.string().nullable(),
  line: z.number().nullable(),
  odds: z.number().nullable(),
  direction: z.string().nullable(),
  capper: z.string().nullable(),
  tier: z.string().nullable(),
  posted_to_discord: z.boolean(),
  settlement_status: z.string().nullable(),
  lifecycle_stage: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  meta: z.record(z.unknown()).nullable(),
});

// Capper Threads Table - local definition
export interface CapperThread {
  id: string;
  discord_thread_id: string;
  capper_id: string;
  pick_id: string;
  status: 'active' | 'archived' | 'deleted';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export const CapperThreadSchema = z.object({
  id: z.string().uuid(),
  discord_thread_id: z.string(),
  capper_id: z.string().uuid(),
  pick_id: z.string().uuid(),
  status: z.enum(['active', 'archived', 'deleted']),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

// Agent Logs Table - local definition
export interface AgentLog {
  id: string;
  agent: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export const AgentLogSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  level: z.enum(['info', 'warn', 'error']),
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string(),
});

export const AgentHealthSchema = z.object({
  id: z.string().uuid(),
  agent_name: z.string(),
  status: z.string(),
  last_heartbeat: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Agent Metrics Table - local definition
export interface AgentMetrics {
  id: string;
  agent: string;
  metrics: Record<string, number>;
  timestamp: string;
}

export const AgentMetricsSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  metrics: z.record(z.number()),
  timestamp: z.string(),
});

// Database type with all tables
export type Tables = {
  raw_props: RawProp;
  games: Game;
  teams: Team;
  players: Player;
  daily_picks: DailyPick;
  unified_picks: UnifiedPick;
  capper_threads: CapperThread;
  agent_logs: AgentLog;
  agent_health: AgentHealth;
  agent_metrics: AgentMetrics;
};

// Type-safe database type - re-export from shared-types
export type TypedSupabaseClient = Database;

// Helper type to get table type
export type TableType<T extends keyof Tables> = Tables[T];
