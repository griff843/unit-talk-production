import { PropObject } from '../../types/propTypes';
import { RawProp } from '../../types/rawProps';
export declare const EDGE_SCORING_VERSION: {
    CURRENT: number;
    LEGACY: number;
    MINIMUM_SUPPORTED: number;
};
export type ScoreBreakdown = Record<string, number | string>;
export interface EdgeScoreResult {
    score: number;
    tier: string;
    tags: string[];
    breakdown: ScoreBreakdown;
    postable: boolean;
    solo_lock: boolean;
    version: number;
}
export interface EdgeScoreConfig {
    version?: number;
    market: Record<string, number>;
    odds: {
        threshold: number;
        high: number;
    };
    trend_score: {
        threshold: number;
        strong: number;
    };
    matchup_score: {
        threshold: number;
        strong: number;
    };
    role_score: {
        threshold: number;
        strong: number;
    };
    line_value_score: {
        threshold: number;
        strong: number;
    };
    source: Record<string, number>;
    tags: Record<string, number>;
    max: number;
    tier_thresholds: {
        S: number;
        A: number;
        B: number;
        C: number;
    };
}
export declare const DEFAULT_EDGE_CONFIG: EdgeScoreConfig;
/**
 * Unified edge scoring function that combines all scoring logic
 * @param prop - The prop to professional_score
 * @param config - Configuration for scoring algorithm
 * @param options - Additional options
 * @returns Complete edge professional_score result
 */
export declare function unifiedEdgeScore(prop: PropObject | RawProp, config?: EdgeScoreConfig, options?: {
    adminOverrideTier?: string | null;
    useLeagueRules?: boolean;
    useLegacyScoring?: boolean;
}): EdgeScoreResult;
/**
 * Legacy compatibility function for finalEdgeScore
 * @deprecated Use unifiedEdgeScore instead
 */
export declare function finalEdgeScore(prop: PropObject, config: any, adminOverrideTier?: string | null): {
    score: number;
    tier: string;
    tags: string[];
    breakdown: ScoreBreakdown;
    postable: boolean;
    solo_lock: boolean;
};
/**
 * Legacy compatibility function for gradePick
 * @deprecated Use unifiedEdgeScore instead
 */
export declare function gradePick(prop: any): {
    score: number;
    tier: 'S' | 'A' | 'B' | 'C';
    breakdown: Record<string, any>;
};
/**
 * Legacy compatibility function for calculateEdgeScore
 * @deprecated Use unifiedEdgeScore instead
 */
export declare function calculateEdgeScore(prop: RawProp): number;
/**
 * Legacy compatibility function for scorePropEdge
 * @deprecated Use unifiedEdgeScore instead
 */
export declare function scorePropEdge(prop: PropObject): {
    edge_score: number;
    tier: string;
    context_tags: string[];
    edge_breakdown: ScoreBreakdown;
};
//# sourceMappingURL=unified-edge-score.d.ts.map