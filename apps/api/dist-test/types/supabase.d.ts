import { z } from 'zod';
import { Database } from './supabase-types';
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
export declare const RawPropSchema: z.ZodObject<{
    id: z.ZodString;
    player_id: z.ZodString;
    player_name: z.ZodString;
    team: z.ZodString;
    opponent: z.ZodString;
    market: z.ZodString;
    line: z.ZodNumber;
    over: z.ZodNumber;
    under: z.ZodNumber;
    market_type: z.ZodString;
    game_time: z.ZodString;
    league: z.ZodString;
    source: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    market: string;
    over: number;
    under: number;
    created_at: string;
    line: number;
    id: string;
    player_id: string;
    player_name: string;
    updated_at: string;
    team: string;
    source: string;
    opponent: string;
    market_type: string;
    league: string;
    game_time: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    market: string;
    over: number;
    under: number;
    created_at: string;
    line: number;
    id: string;
    player_id: string;
    player_name: string;
    updated_at: string;
    team: string;
    source: string;
    opponent: string;
    market_type: string;
    league: string;
    game_time: string;
    metadata?: Record<string, unknown> | undefined;
}>;
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
export declare const GameSchema: z.ZodObject<{
    id: z.ZodString;
    league: z.ZodString;
    home_team: z.ZodString;
    away_team: z.ZodString;
    start_time: z.ZodString;
    status: z.ZodEnum<["scheduled", "live", "completed"]>;
    inning_period: z.ZodOptional<z.ZodString>;
    score_home: z.ZodOptional<z.ZodNumber>;
    score_away: z.ZodOptional<z.ZodNumber>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "live" | "scheduled" | "completed";
    created_at: string;
    id: string;
    updated_at: string;
    home_team: string;
    away_team: string;
    start_time: string;
    league: string;
    metadata?: Record<string, unknown> | undefined;
    inning_period?: string | undefined;
    score_home?: number | undefined;
    score_away?: number | undefined;
}, {
    status: "live" | "scheduled" | "completed";
    created_at: string;
    id: string;
    updated_at: string;
    home_team: string;
    away_team: string;
    start_time: string;
    league: string;
    metadata?: Record<string, unknown> | undefined;
    inning_period?: string | undefined;
    score_home?: number | undefined;
    score_away?: number | undefined;
}>;
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
export declare const TeamSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    league: z.ZodString;
    city: z.ZodString;
    abbreviation: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    created_at: string;
    id: string;
    updated_at: string;
    league: string;
    abbreviation: string;
    city: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    name: string;
    created_at: string;
    id: string;
    updated_at: string;
    league: string;
    abbreviation: string;
    city: string;
    metadata?: Record<string, unknown> | undefined;
}>;
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
export declare const PlayerSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    team_id: z.ZodString;
    position: z.ZodString;
    league: z.ZodString;
    status: z.ZodEnum<["active", "injured", "suspended", "inactive"]>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "inactive" | "suspended" | "injured";
    name: string;
    position: string;
    created_at: string;
    id: string;
    updated_at: string;
    team_id: string;
    league: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    status: "active" | "inactive" | "suspended" | "injured";
    name: string;
    position: string;
    created_at: string;
    id: string;
    updated_at: string;
    team_id: string;
    league: string;
    metadata?: Record<string, unknown> | undefined;
}>;
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
export declare const DailyPickSchema: z.ZodObject<{
    id: z.ZodString;
    raw_prop_id: z.ZodString;
    player_id: z.ZodString;
    game_id: z.ZodString;
    market: z.ZodString;
    line: z.ZodNumber;
    over: z.ZodNumber;
    under: z.ZodNumber;
    grade: z.ZodEnum<["S", "A", "B", "C", "D", "F"]>;
    confidence: z.ZodNumber;
    status: z.ZodEnum<["pending", "approved", "rejected"]>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "approved" | "pending" | "rejected";
    market: string;
    over: number;
    under: number;
    confidence: number;
    created_at: string;
    line: number;
    id: string;
    game_id: string;
    player_id: string;
    updated_at: string;
    raw_prop_id: string;
    grade: "A" | "B" | "C" | "D" | "F" | "S";
    metadata?: Record<string, unknown> | undefined;
}, {
    status: "approved" | "pending" | "rejected";
    market: string;
    over: number;
    under: number;
    confidence: number;
    created_at: string;
    line: number;
    id: string;
    game_id: string;
    player_id: string;
    updated_at: string;
    raw_prop_id: string;
    grade: "A" | "B" | "C" | "D" | "F" | "S";
    metadata?: Record<string, unknown> | undefined;
}>;
export interface UnifiedPick {
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
export declare const UnifiedPickSchema: z.ZodObject<{
    id: z.ZodString;
    daily_pick_id: z.ZodString;
    player_id: z.ZodString;
    game_id: z.ZodString;
    market: z.ZodString;
    line: z.ZodNumber;
    over: z.ZodNumber;
    under: z.ZodNumber;
    grade: z.ZodEnum<["S", "A", "B", "C", "D", "F"]>;
    confidence: z.ZodNumber;
    result: z.ZodEnum<["win", "loss", "push", "pending"]>;
    score: z.ZodNumber;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    market: string;
    over: number;
    under: number;
    score: number;
    confidence: number;
    created_at: string;
    line: number;
    id: string;
    game_id: string;
    player_id: string;
    updated_at: string;
    result: "push" | "win" | "loss" | "pending";
    grade: "A" | "B" | "C" | "D" | "F" | "S";
    daily_pick_id: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    market: string;
    over: number;
    under: number;
    score: number;
    confidence: number;
    created_at: string;
    line: number;
    id: string;
    game_id: string;
    player_id: string;
    updated_at: string;
    result: "push" | "win" | "loss" | "pending";
    grade: "A" | "B" | "C" | "D" | "F" | "S";
    daily_pick_id: string;
    metadata?: Record<string, unknown> | undefined;
}>;
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
export declare const CapperThreadSchema: z.ZodObject<{
    id: z.ZodString;
    discord_thread_id: z.ZodString;
    capper_id: z.ZodString;
    pick_id: z.ZodString;
    status: z.ZodEnum<["active", "archived", "deleted"]>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived" | "deleted";
    created_at: string;
    id: string;
    updated_at: string;
    capper_id: string;
    pick_id: string;
    discord_thread_id: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    status: "active" | "archived" | "deleted";
    created_at: string;
    id: string;
    updated_at: string;
    capper_id: string;
    pick_id: string;
    discord_thread_id: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export interface AgentLog {
    id: string;
    agent: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    metadata?: Record<string, unknown>;
    timestamp: string;
}
export declare const AgentLogSchema: z.ZodObject<{
    id: z.ZodString;
    agent: z.ZodString;
    level: z.ZodEnum<["info", "warn", "error"]>;
    message: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    level: "error" | "warn" | "info";
    timestamp: string;
    agent: string;
    id: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    message: string;
    level: "error" | "warn" | "info";
    timestamp: string;
    agent: string;
    id: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export interface AgentHealth {
    id: string;
    agent: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    health_score: number;
    details: Record<string, unknown>;
    timestamp: string;
}
export declare const AgentHealthSchema: z.ZodObject<{
    id: z.ZodString;
    agent: z.ZodString;
    status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
    health_score: z.ZodNumber;
    details: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "healthy" | "unhealthy" | "degraded";
    details: Record<string, unknown>;
    timestamp: string;
    agent: string;
    id: string;
    health_score: number;
}, {
    status: "healthy" | "unhealthy" | "degraded";
    details: Record<string, unknown>;
    timestamp: string;
    agent: string;
    id: string;
    health_score: number;
}>;
export interface AgentMetrics {
    id: string;
    agent: string;
    metrics: Record<string, number>;
    timestamp: string;
}
export declare const AgentMetricsSchema: z.ZodObject<{
    id: z.ZodString;
    agent: z.ZodString;
    metrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    metrics: Record<string, number>;
    agent: string;
    id: string;
}, {
    timestamp: string;
    metrics: Record<string, number>;
    agent: string;
    id: string;
}>;
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
export type TypedSupabaseClient = Database;
export type TableType<T extends keyof Tables> = Tables[T];
//# sourceMappingURL=supabase.d.ts.map