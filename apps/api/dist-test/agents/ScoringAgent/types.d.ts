import { SupabaseClient } from '@supabase/supabase-js';
export type BetType = 'single' | 'parlay' | 'teaser' | 'roundrobin' | 'sgp';
export type ScoreTier = 'S' | 'A' | 'B' | 'C' | 'D';
export interface Pick {
    id: string;
    player_name: string;
    bet_type: BetType;
    is_parlay: boolean;
    is_teaser: boolean;
    is_rr: boolean;
    legs?: PickLeg[];
    promoted_to_final: boolean;
    is_valid: boolean;
    created_at: string;
    promoted_final_at?: string;
}
export interface PickLeg {
    player_name: string;
    line_value: number;
    market_type: string;
    odds: number;
    score?: number;
    confidence?: number;
}
export interface ScoreResult {
    tier: ScoreTier;
    score: number;
    confidence: number;
    role_stability: number;
    line_value: number;
    matchup_score: number;
    trend_score: number;
    expected_value: number;
}
export interface ScoringAgentConfig {
    supabase: SupabaseClient;
    metricsPort: number;
    retryAttempts: number;
    scoringThresholds: {
        S: number;
        A: number;
        B: number;
        C: number;
        D: number;
    };
}
export interface ScoringErrorData {
    pickId: string;
    operation: string;
    details?: Record<string, unknown>;
}
export declare class ScoringError extends Error {
    pickId: string;
    operation: string;
    details?: Record<string, unknown>;
    constructor(message: string, data?: Partial<ScoringErrorData>);
}
//# sourceMappingURL=types.d.ts.map