import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
export type Json = string | number | boolean | null | {
    [key: string]: Json;
} | Json[];
export interface BaseRow {
    id: string;
    created_at: string;
    updated_at: string;
    metadata?: Json | null;
}
export declare const PickResult: z.ZodEnum<["win", "loss", "push", "pending"]>;
export type PickResult = z.infer<typeof PickResult>;
export declare const PickStatus: z.ZodEnum<["pending", "finalized", "cancelled", "deleted"]>;
export type PickStatus = z.infer<typeof PickStatus>;
export declare const PickType: z.ZodEnum<["single", "parlay"]>;
export type PickType = z.infer<typeof PickType>;
export declare const UserTier: z.ZodEnum<["member", "trial", "vip", "vip_plus", "capper", "staff", "admin", "owner"]>;
export type UserTier = z.infer<typeof UserTier>;
export declare const SubscriptionTier: z.ZodEnum<["FREE", "PREMIUM", "VIP", "VIP_PLUS"]>;
export type SubscriptionTier = z.infer<typeof SubscriptionTier>;
export declare const CapperTier: z.ZodEnum<["rookie", "pro", "elite", "legend"]>;
export type CapperTier = z.infer<typeof CapperTier>;
export declare const TrendDirection: z.ZodEnum<["up", "down", "neutral"]>;
export type TrendDirection = z.infer<typeof TrendDirection>;
export declare const UnifiedPickSchema: z.ZodObject<{
    id: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    capper_id: z.ZodString;
    player_id: z.ZodString;
    game_id: z.ZodString;
    stat_type: z.ZodString;
    line: z.ZodNumber;
    odds: z.ZodNumber;
    stake: z.ZodNumber;
    payout: z.ZodNumber;
    result: z.ZodEnum<["win", "loss", "push", "pending"]>;
    actual_value: z.ZodNumber;
    tier: z.ZodString;
    ticket_type: z.ZodString;
    sport: z.ZodString;
    league: z.ZodString;
    confidence: z.ZodNumber;
    analysis: z.ZodNullable<z.ZodString>;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    metadata: Record<string, unknown> | null;
    sport: string;
    confidence: number;
    tier: string;
    created_at: string;
    line: number;
    id: string;
    game_id: string;
    player_id: string;
    stat_type: string;
    updated_at: string;
    result: "push" | "win" | "loss" | "pending";
    odds: number;
    analysis: string | null;
    actual_value: number;
    league: string;
    capper_id: string;
    stake: number;
    payout: number;
    ticket_type: string;
}, {
    metadata: Record<string, unknown> | null;
    sport: string;
    confidence: number;
    tier: string;
    created_at: string;
    line: number;
    id: string;
    game_id: string;
    player_id: string;
    stat_type: string;
    updated_at: string;
    result: "push" | "win" | "loss" | "pending";
    odds: number;
    analysis: string | null;
    actual_value: number;
    league: string;
    capper_id: string;
    stake: number;
    payout: number;
    ticket_type: string;
}>;
export declare const DailyPickSchema: z.ZodObject<{
    id: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    capper_id: z.ZodString;
    capper_discord_id: z.ZodString;
    capper_username: z.ZodString;
    event_date: z.ZodString;
    status: z.ZodEnum<["pending", "finalized", "cancelled", "deleted"]>;
    pick_type: z.ZodEnum<["single", "parlay"]>;
    total_legs: z.ZodNumber;
    total_odds: z.ZodNumber;
    total_units: z.ZodNumber;
    analysis: z.ZodNullable<z.ZodString>;
    thread_id: z.ZodNullable<z.ZodString>;
    message_id: z.ZodNullable<z.ZodString>;
    legs: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "finalized" | "cancelled" | "pending" | "deleted";
    metadata: Record<string, unknown> | null;
    created_at: string;
    id: string;
    updated_at: string;
    thread_id: string | null;
    pick_type: "parlay" | "single";
    analysis: string | null;
    capper_id: string;
    message_id: string | null;
    legs: Record<string, unknown>[];
    capper_discord_id: string;
    capper_username: string;
    event_date: string;
    total_legs: number;
    total_odds: number;
    total_units: number;
}, {
    status: "finalized" | "cancelled" | "pending" | "deleted";
    metadata: Record<string, unknown> | null;
    created_at: string;
    id: string;
    updated_at: string;
    thread_id: string | null;
    pick_type: "parlay" | "single";
    analysis: string | null;
    capper_id: string;
    message_id: string | null;
    legs: Record<string, unknown>[];
    capper_discord_id: string;
    capper_username: string;
    event_date: string;
    total_legs: number;
    total_odds: number;
    total_units: number;
}>;
export declare const UserProfileSchema: z.ZodObject<{
    id: z.ZodString;
    discord_id: z.ZodString;
    username: z.ZodNullable<z.ZodString>;
    discriminator: z.ZodNullable<z.ZodString>;
    avatar: z.ZodNullable<z.ZodString>;
    tier: z.ZodEnum<["member", "trial", "vip", "vip_plus", "capper", "staff", "admin", "owner"]>;
    subscription_tier: z.ZodEnum<["FREE", "PREMIUM", "VIP", "VIP_PLUS"]>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    last_active: z.ZodString;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    metadata: Record<string, unknown>;
    tier: "capper" | "vip" | "vip_plus" | "member" | "admin" | "trial" | "staff" | "owner";
    created_at: string;
    id: string;
    updated_at: string;
    discord_id: string;
    username: string | null;
    avatar: string | null;
    discriminator: string | null;
    subscription_tier: "VIP" | "FREE" | "PREMIUM" | "VIP_PLUS";
    last_active: string;
}, {
    metadata: Record<string, unknown>;
    tier: "capper" | "vip" | "vip_plus" | "member" | "admin" | "trial" | "staff" | "owner";
    created_at: string;
    id: string;
    updated_at: string;
    discord_id: string;
    username: string | null;
    avatar: string | null;
    discriminator: string | null;
    subscription_tier: "VIP" | "FREE" | "PREMIUM" | "VIP_PLUS";
    last_active: string;
}>;
export declare const CapperProfileSchema: z.ZodObject<{
    id: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    discord_id: z.ZodString;
    username: z.ZodString;
    display_name: z.ZodNullable<z.ZodString>;
    tier: z.ZodEnum<["rookie", "pro", "elite", "legend"]>;
    status: z.ZodEnum<["active", "inactive", "suspended"]>;
    total_picks: z.ZodNumber;
    wins: z.ZodNumber;
    losses: z.ZodNumber;
    pushes: z.ZodNumber;
    total_units: z.ZodNumber;
    roi: z.ZodNumber;
    win_rate: z.ZodNumber;
    current_streak: z.ZodNumber;
    best_streak: z.ZodNumber;
    worst_streak: z.ZodNumber;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "inactive" | "suspended";
    metadata: Record<string, unknown> | null;
    tier: "elite" | "rookie" | "pro" | "legend";
    roi: number;
    created_at: string;
    id: string;
    updated_at: string;
    discord_id: string;
    username: string;
    total_picks: number;
    win_rate: number;
    wins: number;
    losses: number;
    pushes: number;
    display_name: string | null;
    total_units: number;
    current_streak: number;
    best_streak: number;
    worst_streak: number;
}, {
    status: "active" | "inactive" | "suspended";
    metadata: Record<string, unknown> | null;
    tier: "elite" | "rookie" | "pro" | "legend";
    roi: number;
    created_at: string;
    id: string;
    updated_at: string;
    discord_id: string;
    username: string;
    total_picks: number;
    win_rate: number;
    wins: number;
    losses: number;
    pushes: number;
    display_name: string | null;
    total_units: number;
    current_streak: number;
    best_streak: number;
    worst_streak: number;
}>;
export declare const TrendAnalysisSchema: z.ZodObject<{
    id: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    player_id: z.ZodString;
    stat_type: z.ZodString;
    trend_direction: z.ZodEnum<["up", "down", "neutral"]>;
    streak_length: z.ZodNumber;
    avg_performance: z.ZodNumber;
    edge_volatility: z.ZodNumber;
    confidence: z.ZodNumber;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    metadata: Record<string, unknown> | null;
    confidence: number;
    created_at: string;
    id: string;
    player_id: string;
    stat_type: string;
    updated_at: string;
    trend_direction: "up" | "down" | "neutral";
    streak_length: number;
    avg_performance: number;
    edge_volatility: number;
}, {
    metadata: Record<string, unknown> | null;
    confidence: number;
    created_at: string;
    id: string;
    player_id: string;
    stat_type: string;
    updated_at: string;
    trend_direction: "up" | "down" | "neutral";
    streak_length: number;
    avg_performance: number;
    edge_volatility: number;
}>;
export type UnifiedPick = z.infer<typeof UnifiedPickSchema>;
export type DailyPick = z.infer<typeof DailyPickSchema>;
export type PickUnion = UnifiedPick | DailyPick;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type CapperProfile = z.infer<typeof CapperProfileSchema>;
export type TrendAnalysis = z.infer<typeof TrendAnalysisSchema>;
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
export type TypedSupabaseClient = SupabaseClient<Database>;
export declare function validateUnifiedPick(data: unknown): UnifiedPick;
export declare function validateDailyPick(data: unknown): DailyPick;
export declare function validateUserProfile(data: unknown): UserProfile;
export declare function validateCapperProfile(data: unknown): CapperProfile;
export declare function validateTrendAnalysis(data: unknown): TrendAnalysis;
export declare class SupabaseValidationError extends Error {
    zodError: z.ZodError;
    constructor(message: string, zodError: z.ZodError);
}
export declare class SupabaseQueryError extends Error {
    _error: unknown;
    constructor(message: string, _error: unknown);
}
export declare function safeQuery<T>(promise: Promise<{
    data: T | null;
    error: unknown;
}>, validator: (data: unknown) => T): Promise<T>;
//# sourceMappingURL=supabase-types.d.ts.map