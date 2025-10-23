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
    stat_type: string;
    player_name: string;
    line: number;
    over_odds: number;
    under_odds: number;
    sport: string;
    created_at: string;
    updated_at: string;
}
export interface Game {
    id: string;
    sport: string;
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
    sport: string;
    created_at: string;
    updated_at: string;
}
export interface Player {
    id: string;
    name: string;
    team_id: string;
    position: string;
    sport: string;
    created_at: string;
    updated_at: string;
}
export interface UnifiedPick {
    id: string;
    user_id: string;
    raw_prop_id?: string;
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
export declare const RawPropSchema: z.ZodObject<{
    id: z.ZodString;
    game_id: z.ZodString;
    player_id: z.ZodString;
    stat_type: z.ZodString;
    player_name: z.ZodString;
    line: z.ZodNumber;
    over_odds: z.ZodNumber;
    under_odds: z.ZodNumber;
    sport: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sport: string;
    created_at: string;
    line: number;
    id: string;
    game_id: string;
    player_id: string;
    stat_type: string;
    player_name: string;
    over_odds: number;
    under_odds: number;
    updated_at: string;
}, {
    sport: string;
    created_at: string;
    line: number;
    id: string;
    game_id: string;
    player_id: string;
    stat_type: string;
    player_name: string;
    over_odds: number;
    under_odds: number;
    updated_at: string;
}>;
export declare const GameSchema: z.ZodObject<{
    id: z.ZodString;
    sport: z.ZodString;
    home_team: z.ZodString;
    away_team: z.ZodString;
    start_time: z.ZodString;
    status: z.ZodEnum<["scheduled", "in_progress", "final", "postponed", "cancelled"]>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "scheduled" | "in_progress" | "final" | "postponed" | "cancelled";
    sport: string;
    created_at: string;
    id: string;
    updated_at: string;
    home_team: string;
    away_team: string;
    start_time: string;
}, {
    status: "scheduled" | "in_progress" | "final" | "postponed" | "cancelled";
    sport: string;
    created_at: string;
    id: string;
    updated_at: string;
    home_team: string;
    away_team: string;
    start_time: string;
}>;
export declare const TeamSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    sport: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    sport: string;
    created_at: string;
    id: string;
    updated_at: string;
}, {
    name: string;
    sport: string;
    created_at: string;
    id: string;
    updated_at: string;
}>;
export declare const PlayerSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    team_id: z.ZodString;
    position: z.ZodString;
    sport: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    sport: string;
    position: string;
    created_at: string;
    id: string;
    updated_at: string;
    team_id: string;
}, {
    name: string;
    sport: string;
    position: string;
    created_at: string;
    id: string;
    updated_at: string;
    team_id: string;
}>;
export declare const UnifiedPickSchema: z.ZodObject<{
    id: z.ZodString;
    user_id: z.ZodString;
    raw_prop_id: z.ZodOptional<z.ZodString>;
    sport: z.ZodString;
    prediction: z.ZodEnum<["over", "under", "yes", "no"]>;
    confidence: z.ZodNumber;
    status: z.ZodEnum<["draft", "pending_review", "approved", "denied", "published", "settled"]>;
    result: z.ZodOptional<z.ZodEnum<["win", "loss", "push", "pending"]>>;
    tier: z.ZodOptional<z.ZodEnum<["S", "A", "B", "C"]>>;
    finalized: z.ZodOptional<z.ZodBoolean>;
    finalized_at: z.ZodOptional<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "pending_review" | "approved" | "denied" | "published" | "settled";
    sport: string;
    confidence: number;
    created_at: string;
    id: string;
    updated_at: string;
    user_id: string;
    prediction: "over" | "under" | "yes" | "no";
    tier?: "A" | "B" | "C" | "S" | undefined;
    raw_prop_id?: string | undefined;
    result?: "push" | "win" | "loss" | "pending" | undefined;
    finalized?: boolean | undefined;
    finalized_at?: string | undefined;
}, {
    status: "draft" | "pending_review" | "approved" | "denied" | "published" | "settled";
    sport: string;
    confidence: number;
    created_at: string;
    id: string;
    updated_at: string;
    user_id: string;
    prediction: "over" | "under" | "yes" | "no";
    tier?: "A" | "B" | "C" | "S" | undefined;
    raw_prop_id?: string | undefined;
    result?: "push" | "win" | "loss" | "pending" | undefined;
    finalized?: boolean | undefined;
    finalized_at?: string | undefined;
}>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    discord_id: z.ZodString;
    username: z.ZodString;
    tier: z.ZodEnum<["Free", "Premium", "VIP", "A", "B", "C"]>;
    capper_tier: z.ZodOptional<z.ZodEnum<["rookie", "pro", "elite", "legend"]>>;
    status: z.ZodEnum<["active", "inactive", "banned"]>;
    total_picks: z.ZodOptional<z.ZodNumber>;
    win_rate: z.ZodOptional<z.ZodNumber>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "inactive" | "banned";
    tier: "A" | "B" | "C" | "Free" | "Premium" | "VIP";
    created_at: string;
    id: string;
    updated_at: string;
    discord_id: string;
    username: string;
    capper_tier?: "elite" | "rookie" | "pro" | "legend" | undefined;
    total_picks?: number | undefined;
    win_rate?: number | undefined;
}, {
    status: "active" | "inactive" | "banned";
    tier: "A" | "B" | "C" | "Free" | "Premium" | "VIP";
    created_at: string;
    id: string;
    updated_at: string;
    discord_id: string;
    username: string;
    capper_tier?: "elite" | "rookie" | "pro" | "legend" | undefined;
    total_picks?: number | undefined;
    win_rate?: number | undefined;
}>;
export declare const CapperThreadSchema: z.ZodObject<{
    id: z.ZodString;
    user_id: z.ZodString;
    thread_id: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    id: string;
    updated_at: string;
    user_id: string;
    thread_id: string;
}, {
    created_at: string;
    id: string;
    updated_at: string;
    user_id: string;
    thread_id: string;
}>;
export declare const AgentLogSchema: z.ZodObject<{
    id: z.ZodString;
    agent: z.ZodString;
    level: z.ZodString;
    message: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    level: string;
    agent: string;
    created_at: string;
    id: string;
    updated_at: string;
    context?: Record<string, unknown> | undefined;
}, {
    message: string;
    level: string;
    agent: string;
    created_at: string;
    id: string;
    updated_at: string;
    context?: Record<string, unknown> | undefined;
}>;
export declare const AgentHealthSchema: z.ZodObject<{
    id: z.ZodString;
    agent: z.ZodString;
    status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
    details: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "healthy" | "unhealthy" | "degraded";
    details: Record<string, unknown>;
    agent: string;
    created_at: string;
    id: string;
    updated_at: string;
}, {
    status: "healthy" | "unhealthy" | "degraded";
    details: Record<string, unknown>;
    agent: string;
    created_at: string;
    id: string;
    updated_at: string;
}>;
export declare const AgentMetricsSchema: z.ZodObject<{
    id: z.ZodString;
    agent: z.ZodString;
    metrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    metrics: Record<string, number>;
    agent: string;
    created_at: string;
    id: string;
    updated_at: string;
}, {
    metrics: Record<string, number>;
    agent: string;
    created_at: string;
    id: string;
    updated_at: string;
}>;
export interface Database {
    public: {
        Tables: Tables;
    };
}
//# sourceMappingURL=supabase-types.d.ts.map