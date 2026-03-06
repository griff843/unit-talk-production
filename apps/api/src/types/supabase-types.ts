/**
 * Supabase Types - API specific types and Zod schemas
 * SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Import canonical types from shared-types
 */

import { z } from 'zod';

// Import canonical types from shared-types
import type {
  Database,
  RawPropsRow,
  GamesRow,
  TeamsRow,
  PlayersRow,
  UnifiedPicksRow,
  UsersRow,
  AgentHealthRow,
} from '@unit-talk/contracts';

// Re-export canonical types
export type RawProp = RawPropsRow;
export type Game = GamesRow;
export type Team = TeamsRow;
export type Player = PlayersRow;
export type UnifiedPick = UnifiedPicksRow;
export type User = UsersRow;
export type AgentHealth = AgentHealthRow;

// Re-export Database
export type { Database };

// Local types not in shared-types
export interface CapperThread {
  id: string;
  user_id: string;
  thread_id: string;
  created_at: string;
  updated_at: string;
}

export interface AgentLog {
  id: string;
  agent: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentMetrics {
  id: string;
  agent: string;
  metrics: Record<string, number>;
  created_at: string;
  updated_at: string;
}

// Tables interface using canonical types
export interface Tables {
  raw_props: {
    Row: RawProp;
    Insert: Omit<RawProp, 'id' | 'created_at'>;
    Update: Partial<Omit<RawProp, 'id' | 'created_at'>>;
  };
  games: {
    Row: Game;
    Insert: Omit<Game, 'id' | 'created_at'>;
    Update: Partial<Omit<Game, 'id' | 'created_at'>>;
  };
  teams: {
    Row: Team;
    Insert: Omit<Team, 'id' | 'created_at'>;
    Update: Partial<Omit<Team, 'id' | 'created_at'>>;
  };
  players: {
    Row: Player;
    Insert: Omit<Player, 'id' | 'created_at'>;
    Update: Partial<Omit<Player, 'id' | 'created_at'>>;
  };
  unified_picks: {
    Row: UnifiedPick;
    Insert: Omit<UnifiedPick, 'id' | 'created_at'>;
    Update: Partial<Omit<UnifiedPick, 'id' | 'created_at'>>;
  };
  users: {
    Row: User;
    Insert: Omit<User, 'id' | 'created_at'>;
    Update: Partial<Omit<User, 'id' | 'created_at'>>;
  };
  capper_threads: {
    Row: CapperThread;
    Insert: Omit<CapperThread, 'id' | 'created_at'>;
    Update: Partial<Omit<CapperThread, 'id' | 'created_at'>>;
  };
  agent_logs: {
    Row: AgentLog;
    Insert: Omit<AgentLog, 'id' | 'created_at'>;
    Update: Partial<Omit<AgentLog, 'id' | 'created_at'>>;
  };
  agent_health: {
    Row: AgentHealth;
    Insert: Omit<AgentHealth, 'id' | 'created_at'>;
    Update: Partial<Omit<AgentHealth, 'id' | 'created_at'>>;
  };
  agent_metrics: {
    Row: AgentMetrics;
    Insert: Omit<AgentMetrics, 'id' | 'created_at'>;
    Update: Partial<Omit<AgentMetrics, 'id' | 'created_at'>>;
  };
}

// Zod schemas for runtime validation
export const RawPropSchema = z.object({
  id: z.string().uuid(),
  game_id: z.string().uuid().nullable(),
  player_id: z.string().uuid().optional(),
  stat_type: z.string(),
  player_name: z.string().nullable(),
  line: z.number().nullable(),
  over_odds: z.number().optional(),
  under_odds: z.number().optional(),
  sport: z.string().optional(),
  market_type: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
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
});

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sport: z.string(),
  abbreviation: z.string(),
  active: z.boolean(),
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
  created_at: z.string(),
  updated_at: z.string(),
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
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  tier: z.string().nullable(),
  discord_id: z.string().nullable(),
  active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CapperThreadSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  thread_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AgentLogSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  level: z.string(),
  message: z.string(),
  context: z.record(z.unknown()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
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

export const AgentMetricsSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  metrics: z.record(z.number()),
  created_at: z.string(),
  updated_at: z.string(),
});
