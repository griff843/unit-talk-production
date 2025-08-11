import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// --- Base Types ---
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface BaseRow {
  id: string;
  created_at: string;
  updated_at: string;
  metadata?: Json | null;
}

// --- Enums ---
export const PickResult = z.enum(['win', 'loss', 'push', 'pending']);
export type PickResult = z.infer<typeof PickResult>;

export const PickStatus = z.enum(['pending', 'finalized', 'cancelled', 'deleted']);
export type PickStatus = z.infer<typeof PickStatus>;

export const PickType = z.enum(['single', 'parlay']);
export type PickType = z.infer<typeof PickType>;

export const UserTier = z.enum(['member', 'trial', 'vip', 'vip_plus', 'capper', 'staff', 'admin', 'owner']);
export type UserTier = z.infer<typeof UserTier>;

export const SubscriptionTier = z.enum(['FREE', 'PREMIUM', 'VIP', 'VIP_PLUS']);
export type SubscriptionTier = z.infer<typeof SubscriptionTier>;

export const CapperTier = z.enum(['rookie', 'pro', 'elite', 'legend']);
export type CapperTier = z.infer<typeof CapperTier>;

export const TrendDirection = z.enum(['up', 'down', 'neutral']);
export type TrendDirection = z.infer<typeof TrendDirection>;

// --- Table Schemas ---
export const UnifiedPickSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  capper_id: z.string(),
  player_id: z.string(),
  game_id: z.string(),
  stat_type: z.string(),
  line: z.number(),
  odds: z.number(),
  stake: z.number(),
  payout: z.number(),
  result: PickResult,
  actual_value: z.number(),
  tier: z.string(),
  ticket_type: z.string(),
  sport: z.string(),
  league: z.string(),
  confidence: z.number(),
  analysis: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable()
});

export const DailyPickSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  capper_id: z.string(),
  capper_discord_id: z.string(),
  capper_username: z.string(),
  event_date: z.string(),
  status: PickStatus,
  pick_type: PickType,
  total_legs: z.number(),
  total_odds: z.number(),
  total_units: z.number(),
  analysis: z.string().nullable(),
  thread_id: z.string().nullable(),
  message_id: z.string().nullable(),
  legs: z.array(z.record(z.unknown())),
  metadata: z.record(z.unknown()).nullable()
});

export const UserProfileSchema = z.object({
  id: z.string(),
  discord_id: z.string(),
  username: z.string().nullable(),
  discriminator: z.string().nullable(),
  avatar: z.string().nullable(),
  tier: UserTier,
  subscription_tier: SubscriptionTier,
  created_at: z.string(),
  updated_at: z.string(),
  last_active: z.string(),
  metadata: z.record(z.unknown())
});

export const CapperProfileSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  discord_id: z.string(),
  username: z.string(),
  display_name: z.string().nullable(),
  tier: CapperTier,
  status: z.enum(['active', 'inactive', 'suspended']),
  total_picks: z.number(),
  wins: z.number(),
  losses: z.number(),
  pushes: z.number(),
  total_units: z.number(),
  roi: z.number(),
  win_rate: z.number(),
  current_streak: z.number(),
  best_streak: z.number(),
  worst_streak: z.number(),
  metadata: z.record(z.unknown()).nullable()
});

export const TrendAnalysisSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  player_id: z.string(),
  stat_type: z.string(),
  trend_direction: TrendDirection,
  streak_length: z.number(),
  avg_performance: z.number(),
  edge_volatility: z.number(),
  confidence: z.number(),
  metadata: z.record(z.unknown()).nullable()
});

// --- Type Definitions ---
export type UnifiedPick = z.infer<typeof UnifiedPickSchema>;
export type DailyPick = z.infer<typeof DailyPickSchema>;
export type PickUnion = UnifiedPick | DailyPick; // Renamed to avoid conflict with TypeScript's Pick utility type
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type CapperProfile = z.infer<typeof CapperProfileSchema>;
export type TrendAnalysis = z.infer<typeof TrendAnalysisSchema>;

// --- Database Interface ---
export interface Database {
  public: {
    Tables: {
      unified_picks: {
        Row: UnifiedPick;
        Insert: Partial<UnifiedPick> & Pick<UnifiedPick, 'capper_id' | 'player_id' | 'game_id' | 'stat_type' | 'line' | 'odds' | 'stake' | 'payout' | 'result' | 'actual_value' | 'tier' | 'ticket_type' | 'sport' | 'league' | 'confidence'>;
        Update: Partial<UnifiedPick>;
      };
      daily_picks: {
        Row: DailyPick;
        Insert: Partial<DailyPick> & Pick<DailyPick, 'capper_id' | 'capper_discord_id' | 'capper_username' | 'event_date' | 'pick_type' | 'total_legs' | 'total_odds' | 'total_units'>;
        Update: Partial<DailyPick>;
      };
      user_profiles: {
        Row: UserProfile;
        Insert: Partial<UserProfile> & Pick<UserProfile, 'discord_id'>;
        Update: Partial<UserProfile>;
      };
      capper_profiles: {
        Row: CapperProfile;
        Insert: Partial<CapperProfile> & Pick<CapperProfile, 'discord_id' | 'username' | 'tier'>;
        Update: Partial<CapperProfile>;
      };
      trend_analysis: {
        Row: TrendAnalysis;
        Insert: Partial<TrendAnalysis> & Pick<TrendAnalysis, 'player_id' | 'stat_type' | 'trend_direction' | 'streak_length' | 'avg_performance' | 'edge_volatility' | 'confidence'>;
        Update: Partial<TrendAnalysis>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// --- Type-Safe Client ---
export type TypedSupabaseClient = SupabaseClient<Database>;

// --- Helper Functions ---
export function validateUnifiedPick(data: unknown): UnifiedPick {
  return UnifiedPickSchema.parse(data);
}

export function validateDailyPick(data: unknown): DailyPick {
  return DailyPickSchema.parse(data);
}

export function validateUserProfile(data: unknown): UserProfile {
  return UserProfileSchema.parse(data);
}

export function validateCapperProfile(data: unknown): CapperProfile {
  return CapperProfileSchema.parse(data);
}

export function validateTrendAnalysis(data: unknown): TrendAnalysis {
  return TrendAnalysisSchema.parse(data);
}

// --- Error Types ---
export class SupabaseValidationError extends Error {
  constructor(message: string, public zodError: z.ZodError) {
    super(message);
    this.name = 'SupabaseValidationError';
  }
}

export class SupabaseQueryError extends Error {
  constructor(message: string, public _error: unknown) {
    super(message);
    this.name = 'SupabaseQueryError';
  }
}

// --- Query Helpers ---
export async function safeQuery<T>(
  promise: Promise<{ data: T | null; error: unknown }>,
  validator: (data: unknown) => T
): Promise<T> {
  const { data, error } = await promise;

  if (error) {
    throw new SupabaseQueryError('Supabase query failed', error);
  }

  if (!data) {
    throw new SupabaseQueryError('No data returned', null);
  }

  try {
    return validator(data);
  } catch (_err) {
    if (_err instanceof z.ZodError) {
      throw new SupabaseValidationError('Data validation failed', _err);
    }
    throw _err;
  }
} 
