import { z } from 'zod';
export declare const BetTypeEnum: z.ZodEnum<["single", "parlay", "teaser", "roundrobin", "sgp"]>;
export type BetType = z.infer<typeof BetTypeEnum>;
export declare const GradeTierEnum: z.ZodEnum<["S", "A", "B", "C", "D"]>;
export type GradeTier = z.infer<typeof GradeTierEnum>;
export declare const PickLegSchema: z.ZodObject<{
    player_name: z.ZodString;
    line_value: z.ZodNumber;
    market_type: z.ZodString;
    odds: z.ZodNumber;
    score: z.ZodOptional<z.ZodNumber>;
    confidence: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    player_name: string;
    odds: number;
    market_type: string;
    line_value: number;
    metadata?: Record<string, unknown> | undefined;
    score?: number | undefined;
    confidence?: number | undefined;
}, {
    player_name: string;
    odds: number;
    market_type: string;
    line_value: number;
    metadata?: Record<string, unknown> | undefined;
    score?: number | undefined;
    confidence?: number | undefined;
}>;
export type PickLeg = z.infer<typeof PickLegSchema>;
export declare const PickSchema: z.ZodObject<{
    id: z.ZodString;
} & {
    player_name: z.ZodString;
    bet_type: z.ZodEnum<["single", "parlay", "teaser", "roundrobin", "sgp"]>;
    is_parlay: z.ZodBoolean;
    is_teaser: z.ZodBoolean;
    is_rr: z.ZodBoolean;
    legs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        player_name: z.ZodString;
        line_value: z.ZodNumber;
        market_type: z.ZodString;
        odds: z.ZodNumber;
        score: z.ZodOptional<z.ZodNumber>;
        confidence: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        player_name: string;
        odds: number;
        market_type: string;
        line_value: number;
        metadata?: Record<string, unknown> | undefined;
        score?: number | undefined;
        confidence?: number | undefined;
    }, {
        player_name: string;
        odds: number;
        market_type: string;
        line_value: number;
        metadata?: Record<string, unknown> | undefined;
        score?: number | undefined;
        confidence?: number | undefined;
    }>, "many">>;
    promoted_to_final: z.ZodBoolean;
    is_valid: z.ZodBoolean;
} & {
    created_at: z.ZodString;
    updated_at: z.ZodString;
} & {
    promoted_final_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    id: string;
    player_name: string;
    updated_at: string;
    is_valid: boolean;
    bet_type: "parlay" | "single" | "teaser" | "sgp" | "roundrobin";
    promoted_to_final: boolean;
    is_parlay: boolean;
    is_teaser: boolean;
    is_rr: boolean;
    legs?: {
        player_name: string;
        odds: number;
        market_type: string;
        line_value: number;
        metadata?: Record<string, unknown> | undefined;
        score?: number | undefined;
        confidence?: number | undefined;
    }[] | undefined;
    promoted_final_at?: string | undefined;
}, {
    created_at: string;
    id: string;
    player_name: string;
    updated_at: string;
    is_valid: boolean;
    bet_type: "parlay" | "single" | "teaser" | "sgp" | "roundrobin";
    promoted_to_final: boolean;
    is_parlay: boolean;
    is_teaser: boolean;
    is_rr: boolean;
    legs?: {
        player_name: string;
        odds: number;
        market_type: string;
        line_value: number;
        metadata?: Record<string, unknown> | undefined;
        score?: number | undefined;
        confidence?: number | undefined;
    }[] | undefined;
    promoted_final_at?: string | undefined;
}>;
export type Pick = z.infer<typeof PickSchema>;
export declare const ScoreComponentSchema: z.ZodObject<{
    value: z.ZodNumber;
    confidence: z.ZodNumber;
    factors: z.ZodRecord<z.ZodString, z.ZodNumber>;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    value: number;
    metadata: Record<string, unknown>;
    confidence: number;
    factors: Record<string, number>;
}, {
    value: number;
    metadata: Record<string, unknown>;
    confidence: number;
    factors: Record<string, number>;
}>;
export declare const GradeResultSchema: z.ZodObject<{
    tier: z.ZodEnum<["S", "A", "B", "C", "D"]>;
    score: z.ZodNumber;
    confidence: z.ZodNumber;
    role_stability: z.ZodNumber;
    line_value: z.ZodNumber;
    matchup_score: z.ZodNumber;
    trend_score: z.ZodNumber;
    expected_value: z.ZodNumber;
    components: z.ZodRecord<z.ZodString, z.ZodObject<{
        value: z.ZodNumber;
        confidence: z.ZodNumber;
        factors: z.ZodRecord<z.ZodString, z.ZodNumber>;
        metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        value: number;
        metadata: Record<string, unknown>;
        confidence: number;
        factors: Record<string, number>;
    }, {
        value: number;
        metadata: Record<string, unknown>;
        confidence: number;
        factors: Record<string, number>;
    }>>;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    metadata: Record<string, unknown>;
    score: number;
    confidence: number;
    tier: "A" | "B" | "C" | "D" | "S";
    components: Record<string, {
        value: number;
        metadata: Record<string, unknown>;
        confidence: number;
        factors: Record<string, number>;
    }>;
    role_stability: number;
    trend_score: number;
    matchup_score: number;
    expected_value: number;
    line_value: number;
}, {
    metadata: Record<string, unknown>;
    score: number;
    confidence: number;
    tier: "A" | "B" | "C" | "D" | "S";
    components: Record<string, {
        value: number;
        metadata: Record<string, unknown>;
        confidence: number;
        factors: Record<string, number>;
    }>;
    role_stability: number;
    trend_score: number;
    matchup_score: number;
    expected_value: number;
    line_value: number;
}>;
export type GradeResult = z.infer<typeof GradeResultSchema>;
export declare const GradingEventSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
} & {
    type: z.ZodEnum<["pick_received", "grading_started", "grading_completed", "grading_failed", "pick_promoted", "pick_rejected"]>;
    data: z.ZodObject<{
        pick: z.ZodObject<{
            id: z.ZodString;
        } & {
            player_name: z.ZodString;
            bet_type: z.ZodEnum<["single", "parlay", "teaser", "roundrobin", "sgp"]>;
            is_parlay: z.ZodBoolean;
            is_teaser: z.ZodBoolean;
            is_rr: z.ZodBoolean;
            legs: z.ZodOptional<z.ZodArray<z.ZodObject<{
                player_name: z.ZodString;
                line_value: z.ZodNumber;
                market_type: z.ZodString;
                odds: z.ZodNumber;
                score: z.ZodOptional<z.ZodNumber>;
                confidence: z.ZodOptional<z.ZodNumber>;
                metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            }, "strip", z.ZodTypeAny, {
                player_name: string;
                odds: number;
                market_type: string;
                line_value: number;
                metadata?: Record<string, unknown> | undefined;
                score?: number | undefined;
                confidence?: number | undefined;
            }, {
                player_name: string;
                odds: number;
                market_type: string;
                line_value: number;
                metadata?: Record<string, unknown> | undefined;
                score?: number | undefined;
                confidence?: number | undefined;
            }>, "many">>;
            promoted_to_final: z.ZodBoolean;
            is_valid: z.ZodBoolean;
        } & {
            created_at: z.ZodString;
            updated_at: z.ZodString;
        } & {
            promoted_final_at: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            created_at: string;
            id: string;
            player_name: string;
            updated_at: string;
            is_valid: boolean;
            bet_type: "parlay" | "single" | "teaser" | "sgp" | "roundrobin";
            promoted_to_final: boolean;
            is_parlay: boolean;
            is_teaser: boolean;
            is_rr: boolean;
            legs?: {
                player_name: string;
                odds: number;
                market_type: string;
                line_value: number;
                metadata?: Record<string, unknown> | undefined;
                score?: number | undefined;
                confidence?: number | undefined;
            }[] | undefined;
            promoted_final_at?: string | undefined;
        }, {
            created_at: string;
            id: string;
            player_name: string;
            updated_at: string;
            is_valid: boolean;
            bet_type: "parlay" | "single" | "teaser" | "sgp" | "roundrobin";
            promoted_to_final: boolean;
            is_parlay: boolean;
            is_teaser: boolean;
            is_rr: boolean;
            legs?: {
                player_name: string;
                odds: number;
                market_type: string;
                line_value: number;
                metadata?: Record<string, unknown> | undefined;
                score?: number | undefined;
                confidence?: number | undefined;
            }[] | undefined;
            promoted_final_at?: string | undefined;
        }>;
        result: z.ZodOptional<z.ZodObject<{
            tier: z.ZodEnum<["S", "A", "B", "C", "D"]>;
            score: z.ZodNumber;
            confidence: z.ZodNumber;
            role_stability: z.ZodNumber;
            line_value: z.ZodNumber;
            matchup_score: z.ZodNumber;
            trend_score: z.ZodNumber;
            expected_value: z.ZodNumber;
            components: z.ZodRecord<z.ZodString, z.ZodObject<{
                value: z.ZodNumber;
                confidence: z.ZodNumber;
                factors: z.ZodRecord<z.ZodString, z.ZodNumber>;
                metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, "strip", z.ZodTypeAny, {
                value: number;
                metadata: Record<string, unknown>;
                confidence: number;
                factors: Record<string, number>;
            }, {
                value: number;
                metadata: Record<string, unknown>;
                confidence: number;
                factors: Record<string, number>;
            }>>;
            metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            metadata: Record<string, unknown>;
            score: number;
            confidence: number;
            tier: "A" | "B" | "C" | "D" | "S";
            components: Record<string, {
                value: number;
                metadata: Record<string, unknown>;
                confidence: number;
                factors: Record<string, number>;
            }>;
            role_stability: number;
            trend_score: number;
            matchup_score: number;
            expected_value: number;
            line_value: number;
        }, {
            metadata: Record<string, unknown>;
            score: number;
            confidence: number;
            tier: "A" | "B" | "C" | "D" | "S";
            components: Record<string, {
                value: number;
                metadata: Record<string, unknown>;
                confidence: number;
                factors: Record<string, number>;
            }>;
            role_stability: number;
            trend_score: number;
            matchup_score: number;
            expected_value: number;
            line_value: number;
        }>>;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        pick: {
            created_at: string;
            id: string;
            player_name: string;
            updated_at: string;
            is_valid: boolean;
            bet_type: "parlay" | "single" | "teaser" | "sgp" | "roundrobin";
            promoted_to_final: boolean;
            is_parlay: boolean;
            is_teaser: boolean;
            is_rr: boolean;
            legs?: {
                player_name: string;
                odds: number;
                market_type: string;
                line_value: number;
                metadata?: Record<string, unknown> | undefined;
                score?: number | undefined;
                confidence?: number | undefined;
            }[] | undefined;
            promoted_final_at?: string | undefined;
        };
        error?: string | undefined;
        result?: {
            metadata: Record<string, unknown>;
            score: number;
            confidence: number;
            tier: "A" | "B" | "C" | "D" | "S";
            components: Record<string, {
                value: number;
                metadata: Record<string, unknown>;
                confidence: number;
                factors: Record<string, number>;
            }>;
            role_stability: number;
            trend_score: number;
            matchup_score: number;
            expected_value: number;
            line_value: number;
        } | undefined;
    }, {
        pick: {
            created_at: string;
            id: string;
            player_name: string;
            updated_at: string;
            is_valid: boolean;
            bet_type: "parlay" | "single" | "teaser" | "sgp" | "roundrobin";
            promoted_to_final: boolean;
            is_parlay: boolean;
            is_teaser: boolean;
            is_rr: boolean;
            legs?: {
                player_name: string;
                odds: number;
                market_type: string;
                line_value: number;
                metadata?: Record<string, unknown> | undefined;
                score?: number | undefined;
                confidence?: number | undefined;
            }[] | undefined;
            promoted_final_at?: string | undefined;
        };
        error?: string | undefined;
        result?: {
            metadata: Record<string, unknown>;
            score: number;
            confidence: number;
            tier: "A" | "B" | "C" | "D" | "S";
            components: Record<string, {
                value: number;
                metadata: Record<string, unknown>;
                confidence: number;
                factors: Record<string, number>;
            }>;
            role_stability: number;
            trend_score: number;
            matchup_score: number;
            expected_value: number;
            line_value: number;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "pick_received" | "grading_started" | "grading_completed" | "grading_failed" | "pick_promoted" | "pick_rejected";
    data: {
        pick: {
            created_at: string;
            id: string;
            player_name: string;
            updated_at: string;
            is_valid: boolean;
            bet_type: "parlay" | "single" | "teaser" | "sgp" | "roundrobin";
            promoted_to_final: boolean;
            is_parlay: boolean;
            is_teaser: boolean;
            is_rr: boolean;
            legs?: {
                player_name: string;
                odds: number;
                market_type: string;
                line_value: number;
                metadata?: Record<string, unknown> | undefined;
                score?: number | undefined;
                confidence?: number | undefined;
            }[] | undefined;
            promoted_final_at?: string | undefined;
        };
        error?: string | undefined;
        result?: {
            metadata: Record<string, unknown>;
            score: number;
            confidence: number;
            tier: "A" | "B" | "C" | "D" | "S";
            components: Record<string, {
                value: number;
                metadata: Record<string, unknown>;
                confidence: number;
                factors: Record<string, number>;
            }>;
            role_stability: number;
            trend_score: number;
            matchup_score: number;
            expected_value: number;
            line_value: number;
        } | undefined;
    };
    timestamp: string;
    id: string;
}, {
    type: "pick_received" | "grading_started" | "grading_completed" | "grading_failed" | "pick_promoted" | "pick_rejected";
    data: {
        pick: {
            created_at: string;
            id: string;
            player_name: string;
            updated_at: string;
            is_valid: boolean;
            bet_type: "parlay" | "single" | "teaser" | "sgp" | "roundrobin";
            promoted_to_final: boolean;
            is_parlay: boolean;
            is_teaser: boolean;
            is_rr: boolean;
            legs?: {
                player_name: string;
                odds: number;
                market_type: string;
                line_value: number;
                metadata?: Record<string, unknown> | undefined;
                score?: number | undefined;
                confidence?: number | undefined;
            }[] | undefined;
            promoted_final_at?: string | undefined;
        };
        error?: string | undefined;
        result?: {
            metadata: Record<string, unknown>;
            score: number;
            confidence: number;
            tier: "A" | "B" | "C" | "D" | "S";
            components: Record<string, {
                value: number;
                metadata: Record<string, unknown>;
                confidence: number;
                factors: Record<string, number>;
            }>;
            role_stability: number;
            trend_score: number;
            matchup_score: number;
            expected_value: number;
            line_value: number;
        } | undefined;
    };
    timestamp: string;
    id: string;
}>;
export type GradingEvent = z.infer<typeof GradingEventSchema>;
export declare const GradingThresholdsSchema: z.ZodObject<{
    S: z.ZodNumber;
    A: z.ZodNumber;
    B: z.ZodNumber;
    C: z.ZodNumber;
    D: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    A: number;
    B: number;
    C: number;
    D: number;
    S: number;
}, {
    A: number;
    B: number;
    C: number;
    D: number;
    S: number;
}>;
export declare const ScoringAgentConfigSchema: z.ZodObject<{
    thresholds: z.ZodObject<{
        S: z.ZodNumber;
        A: z.ZodNumber;
        B: z.ZodNumber;
        C: z.ZodNumber;
        D: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        A: number;
        B: number;
        C: number;
        D: number;
        S: number;
    }, {
        A: number;
        B: number;
        C: number;
        D: number;
        S: number;
    }>;
    confidenceMinimum: z.ZodNumber;
    roleStabilityWeight: z.ZodNumber;
    lineValueWeight: z.ZodNumber;
    matchupWeight: z.ZodNumber;
    trendWeight: z.ZodNumber;
    expectedValueWeight: z.ZodNumber;
    rules: z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodBoolean;
        weight: z.ZodNumber;
        threshold: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        weight: number;
        threshold: number;
    }, {
        enabled: boolean;
        weight: number;
        threshold: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    thresholds: {
        A: number;
        B: number;
        C: number;
        D: number;
        S: number;
    };
    rules: Record<string, {
        enabled: boolean;
        weight: number;
        threshold: number;
    }>;
    confidenceMinimum: number;
    roleStabilityWeight: number;
    lineValueWeight: number;
    matchupWeight: number;
    trendWeight: number;
    expectedValueWeight: number;
}, {
    thresholds: {
        A: number;
        B: number;
        C: number;
        D: number;
        S: number;
    };
    rules: Record<string, {
        enabled: boolean;
        weight: number;
        threshold: number;
    }>;
    confidenceMinimum: number;
    roleStabilityWeight: number;
    lineValueWeight: number;
    matchupWeight: number;
    trendWeight: number;
    expectedValueWeight: number;
}>;
export type ScoringAgentConfig = z.infer<typeof ScoringAgentConfigSchema>;
export declare function validatePick(data: unknown): Pick;
export declare function validateGradeResult(data: unknown): GradeResult;
export declare function validateGradingEvent(data: unknown): GradingEvent;
export declare function validateScoringConfig(data: unknown): ScoringAgentConfig;
//# sourceMappingURL=index.d.ts.map