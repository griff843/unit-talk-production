import { Database } from './supabase';

// Daily Picks Types
export interface DailyPick {
  id: string;
  created_at: string;
  updated_at: string;
  capper_id: string;
  capper_discord_id: string;
  capper_username: string;
  event_date: string;
  status: 'pending' | 'finalized' | 'cancelled' | 'deleted';
  pick_type: 'single' | 'parlay';
  total_legs: number;
  total_odds: number;
  total_units: number;
  analysis: string | null;
  thread_id: string | null;
  message_id: string | null;
  legs: PickLeg[];
  metadata: Record<string, unknown> | null;
}

export interface PickLeg {
  id: string;
  sport: string;
  league: string;
  game_id: string;
  team_home: string;
  team_away: string;
  player_name?: string;
  market_type: string; // 'spread', 'total', 'moneyline', 'player_prop'
  stat_type?: string; // For player props: 'points', 'rebounds', 'assists', etc.
  selection: string; // 'over', 'under', 'home', 'away', player name, etc.
  line: number;
  odds: number;
  units: number;
  confidence?: number;
}

export type DailyPickInsert = Omit<DailyPick, 'id' | 'created_at' | 'updated_at'>;
export type DailyPickUpdate = Partial<DailyPickInsert>;

// Capper Profile Types
export interface CapperProfile {
  id: string;
  created_at: string;
  updated_at: string;
  discord_id: string;
  username: string;
  display_name: string | null;
  tier: string;
  status: 'active' | 'inactive' | 'suspended';
  onboarded_at: string | null;
  thread_id: string | null;
  stats: CapperStats;
  settings: CapperSettings | null;
  metadata: Record<string, unknown> | null;
}

export interface CapperStats {
  total_picks: number;
  wins: number;
  losses: number;
  pushes: number;
  win_rate: number;
  roi: number;
  total_units_wagered: number;
  total_units_won: number;
  profit_loss: number;
  avg_odds: number;
  longest_win_streak: number;
  longest_loss_streak: number;
  current_streak: number;
  current_streak_type: 'win' | 'loss' | 'none';
  best_sport: string | null;
  best_market: string | null;
  last_pick_date: string | null;
}

export interface CapperSettings {
  auto_publish: boolean;
  default_units: number;
  max_units_per_pick: number;
  max_legs_per_parlay: number;
  preferred_sports: string[];
  notification_preferences: {
    pick_reminders: boolean;
    performance_updates: boolean;
    milestone_alerts: boolean;
  };
}

export type CapperProfileInsert = Omit<CapperProfile, 'id' | 'created_at' | 'updated_at'>;
export type CapperProfileUpdate = Partial<CapperProfileInsert>;

// Analytics Events Types
export interface AnalyticsEvent {
  id: string;
  created_at: string;
  event_type: string;
  user_id: string | null;
  capper_id: string | null;
  pick_id: string | null;
  event_data: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
}

export type AnalyticsEventInsert = Omit<AnalyticsEvent, 'id' | 'created_at'>;

// Sports Game Odds Types
export interface SportsGameOdds {
  id: string;
  created_at: string;
  updated_at: string;
  game_id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  game_date: string;
  markets: GameMarkets;
  players: PlayerProps[];
  metadata: Record<string, unknown> | null;
}

export interface GameMarkets {
  spread: {
    home: number;
    away: number;
    home_odds: number;
    away_odds: number;
  } | null;
  total: {
    line: number;
    over_odds: number;
    under_odds: number;
  } | null;
  moneyline: {
    home_odds: number;
    away_odds: number;
  } | null;
}

export interface PlayerProps {
  player_id: string;
  player_name: string;
  team: string;
  props: {
    [stat_type: string]: {
      line: number;
      over_odds: number;
      under_odds: number;
    };
  };
}

// Database response types
export type DailyPicksResponse = Database['public']['Tables']['daily_picks']['Row'];
export type DailyPicksInsert = Database['public']['Tables']['daily_picks']['Insert'];
export type DailyPicksUpdate = Database['public']['Tables']['daily_picks']['Update'];

export type CapperProfilesResponse = Database['public']['Tables']['capper_profiles']['Row'];
export type CapperProfilesInsert = Database['public']['Tables']['capper_profiles']['Insert'];
export type CapperProfilesUpdate = Database['public']['Tables']['capper_profiles']['Update'];

export type AnalyticsEventsResponse = Database['public']['Tables']['analytics_events']['Row'];
export type AnalyticsEventsInsert = Database['public']['Tables']['analytics_events']['Insert'];
export type AnalyticsEventsUpdate = Database['public']['Tables']['analytics_events']['Update'];

export type SportsGameOddsResponse = Database['public']['Tables']['sports_game_odds']['Row'];
export type SportsGameOddsInsert = Database['public']['Tables']['sports_game_odds']['Insert'];
export type SportsGameOddsUpdate = Database['public']['Tables']['sports_game_odds']['Update'];