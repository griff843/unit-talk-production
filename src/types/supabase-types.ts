import { z } from 'zod';

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
  daily_picks: {
    Row: DailyPick;
    Insert: Omit<DailyPick, 'id' | 'created_at'>;
    Update: Partial<Omit<DailyPick, 'id' | 'created_at'>>;
  };
  final_picks: {
    Row: FinalPick;
    Insert: Omit<FinalPick, 'id' | 'created_at'>;
    Update: Partial<Omit<FinalPick, 'id' | 'created_at'>>;
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

export interface RawProp {
  id: string;
  game_id: string;
  player_id: string;
  prop_type: string;
  line: number;
  over_odds: number;
  under_odds: number;
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
  status: 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  league: string;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  name: string;
  team_id: string;
  position: string;
  created_at: string;
  updated_at: string;
}

export interface DailyPick {
  id: string;
  prop_id: string;
  prediction: 'over' | 'under';
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface FinalPick {
  id: string;
  daily_pick_id: string;
  result: 'win' | 'loss' | 'push' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface CapperThread {
  id: string;
  capper_id: string;
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

export interface AgentHealth {
  id: string;
  agent: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, unknown>;
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

// Zod schemas for validation
export const RawPropSchema = z.object({
  id: z.string().uuid(),
  game_id: z.string().uuid(),
  player_id: z.string().uuid(),
  prop_type: z.string(),
  line: z.number(),
  over_odds: z.number(),
  under_odds: z.number(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const GameSchema = z.object({
  id: z.string().uuid(),
  league: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  start_time: z.string().datetime(),
  status: z.enum(['scheduled', 'in_progress', 'final', 'postponed', 'cancelled']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  league: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const PlayerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  team_id: z.string().uuid(),
  position: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const DailyPickSchema = z.object({
  id: z.string().uuid(),
  prop_id: z.string().uuid(),
  prediction: z.enum(['over', 'under']),
  confidence: z.number(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const FinalPickSchema = z.object({
  id: z.string().uuid(),
  daily_pick_id: z.string().uuid(),
  result: z.enum(['win', 'loss', 'push', 'pending']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CapperThreadSchema = z.object({
  id: z.string().uuid(),
  capper_id: z.string().uuid(),
  thread_id: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const AgentLogSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  level: z.string(),
  message: z.string(),
  context: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const AgentHealthSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  details: z.record(z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const AgentMetricsSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  metrics: z.record(z.number()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// Export Database interface
export interface Database {
  public: {
    Tables: Tables;
  };
} 
