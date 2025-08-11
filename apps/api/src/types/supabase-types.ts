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

export interface RawProp {
  id: string;
  game_id: string;
  player_id: string;
  stat_type: string; // v3.0.0: prop_type → stat_type
  player_name: string; // v3.0.0: added for clarity
  line: number;
  over_odds: number;
  under_odds: number;
  sport: string; // v3.0.0: league → sport
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  sport: string; // v3.0.0: league → sport
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
  sport: string; // v3.0.0: league → sport
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  name: string; // In v3.0.0, this becomes player_name in raw_props
  team_id: string;
  position: string;
  sport: string; // v3.0.0: added for consistency
  created_at: string;
  updated_at: string;
}

// v3.0.0 Unified Pick Interface
export interface UnifiedPick {
  id: string;
  user_id: string; // Foreign key to users table
  raw_prop_id?: string; // Optional link to raw_props
  sport: string;
  prediction: 'over' | 'under' | 'yes' | 'no';
  confidence: number;
  status: 'draft' | 'pending_review' | 'approved' | 'denied' | 'published' | 'settled';
  result?: 'win' | 'loss' | 'push' | 'pending';
  tier?: 'S' | 'A' | 'B' | 'C';
  finalized?: boolean;
  finalized_at?: string;
  created_at: string;
  updated_at: string;
}

// v3.0.0 User Interface (replaces cappers)
export interface User {
  id: string;
  discord_id: string;
  username: string;
  tier: 'Free' | 'Premium' | 'VIP' | 'A' | 'B' | 'C';
  capper_tier?: 'rookie' | 'pro' | 'elite' | 'legend';
  status: 'active' | 'inactive' | 'banned';
  total_picks?: number;
  win_rate?: number;
  created_at: string;
  updated_at: string;
}

export interface CapperThread {
  id: string;
  user_id: string; // v3.0.0: capper_id → user_id
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

// v3.0.0 Zod schemas for validation
export const RawPropSchema = z.object({
  id: z.string().uuid(),
  game_id: z.string().uuid(),
  player_id: z.string().uuid(),
  stat_type: z.string(), // v3.0.0: prop_type → stat_type
  player_name: z.string(),
  line: z.number(),
  over_odds: z.number(),
  under_odds: z.number(),
  sport: z.string(), // v3.0.0: added
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const GameSchema = z.object({
  id: z.string().uuid(),
  sport: z.string(), // v3.0.0: league → sport
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
  sport: z.string(), // v3.0.0: league → sport
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const PlayerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  team_id: z.string().uuid(),
  position: z.string(),
  sport: z.string(), // v3.0.0: added for consistency
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// v3.0.0 Unified Pick Schema
export const UnifiedPickSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  raw_prop_id: z.string().uuid().optional(),
  sport: z.string(),
  prediction: z.enum(['over', 'under', 'yes', 'no']),
  confidence: z.number(),
  status: z.enum(['draft', 'pending_review', 'approved', 'denied', 'published', 'settled']),
  result: z.enum(['win', 'loss', 'push', 'pending']).optional(),
  tier: z.enum(['S', 'A', 'B', 'C']).optional(),
  finalized: z.boolean().optional(),
  finalized_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// v3.0.0 User Schema
export const UserSchema = z.object({
  id: z.string().uuid(),
  discord_id: z.string(),
  username: z.string(),
  tier: z.enum(['Free', 'Premium', 'VIP', 'A', 'B', 'C']),
  capper_tier: z.enum(['rookie', 'pro', 'elite', 'legend']).optional(),
  status: z.enum(['active', 'inactive', 'banned']),
  total_picks: z.number().optional(),
  win_rate: z.number().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CapperThreadSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(), // v3.0.0: capper_id → user_id
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
