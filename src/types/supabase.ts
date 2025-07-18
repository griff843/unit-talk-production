import { z } from 'zod';
import { Database } from './supabase-types';

// Raw Props Table
export interface RawProp {
  id: string;
  player_id: string;
  player_name: string;
  team: string;
  opponent: string;
  market: string;
  line: number;
  over: number;
  under: number;
  market_type: string;
  game_time: string;
  league: string;
  source: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export const RawPropSchema = z.object({
  id: z.string().uuid(),
  player_id: z.string(),
  player_name: z.string(),
  team: z.string(),
  opponent: z.string(),
  market: z.string(),
  line: z.number(),
  over: z.number(),
  under: z.number(),
  market_type: z.string(),
  game_time: z.string(),
  league: z.string(),
  source: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.record(z.unknown()).optional()
});

// Games Table
export interface Game {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
  status: 'scheduled' | 'live' | 'completed';
  inning_period?: string;
  score_home?: number;
  score_away?: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export const GameSchema = z.object({
  id: z.string().uuid(),
  league: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  start_time: z.string(),
  status: z.enum(['scheduled', 'live', 'completed']),
  inning_period: z.string().optional(),
  score_home: z.number().optional(),
  score_away: z.number().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.record(z.unknown()).optional()
});

// Teams Table
export interface Team {
  id: string;
  name: string;
  league: string;
  city: string;
  abbreviation: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  league: z.string(),
  city: z.string(),
  abbreviation: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.record(z.unknown()).optional()
});

// Players Table
export interface Player {
  id: string;
  name: string;
  team_id: string;
  position: string;
  league: string;
  status: 'active' | 'injured' | 'suspended' | 'inactive';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export const PlayerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  team_id: z.string().uuid(),
  position: z.string(),
  league: z.string(),
  status: z.enum(['active', 'injured', 'suspended', 'inactive']),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.record(z.unknown()).optional()
});

// Daily Picks Table
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
  metadata: z.record(z.unknown()).optional()
});

// Final Picks Table
export interface FinalPick {
  id: string;
  daily_pick_id: string;
  player_id: string;
  game_id: string;
  market: string;
  line: number;
  over: number;
  under: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  confidence: number;
  result: 'win' | 'loss' | 'push' | 'pending';
  score: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export const FinalPickSchema = z.object({
  id: z.string().uuid(),
  daily_pick_id: z.string().uuid(),
  player_id: z.string().uuid(),
  game_id: z.string().uuid(),
  market: z.string(),
  line: z.number(),
  over: z.number(),
  under: z.number(),
  grade: z.enum(['S', 'A', 'B', 'C', 'D', 'F']),
  confidence: z.number(),
  result: z.enum(['win', 'loss', 'push', 'pending']),
  score: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.record(z.unknown()).optional()
});

// Capper Threads Table
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
  metadata: z.record(z.unknown()).optional()
});

// Agent Logs Table
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
  timestamp: z.string()
});

// Agent Health Table
export interface AgentHealth {
  id: string;
  agent: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  health_score: number;
  details: Record<string, unknown>;
  timestamp: string;
}

export const AgentHealthSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  health_score: z.number(),
  details: z.record(z.unknown()),
  timestamp: z.string()
});

// Agent Metrics Table
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
  timestamp: z.string()
});

// Database type with all tables
export type Tables = {
  raw_props: RawProp;
  games: Game;
  teams: Team;
  players: Player;
  daily_picks: DailyPick;
  final_picks: FinalPick;
  capper_threads: CapperThread;
  agent_logs: AgentLog;
  agent_health: AgentHealth;
  agent_metrics: AgentMetrics;
};

// Type-safe database type
export type TypedSupabaseClient = Database;

// Helper type to get table type
export type TableType<T extends keyof Tables> = Tables[T]; 
