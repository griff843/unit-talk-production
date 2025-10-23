import { PropObject } from '../../types/propTypes';
import { EDGE_CONFIG } from '../config/edgeConfig';
export type ScoreBreakdown = Record<string, number | string>;
export declare function finalEdgeScore(prop: PropObject, config: typeof EDGE_CONFIG, adminOverrideTier?: string | null): {
    score: number;
    tier: string;
    tags: string[];
    breakdown: ScoreBreakdown;
    postable: boolean;
    solo_lock: boolean;
};
export declare function scorePropEdge(prop: PropObject): {
    edge_score: number;
    tier: string;
    context_tags: string[];
    edge_breakdown: ScoreBreakdown;
};
/**
 * INTERNAL ONLY: Get full scoring details including Zone Threat analysis
 * This function exposes Zone Threat data for internal review and logging
 * DO NOT use this for public-facing features
 */
export declare function getInternalScoringDetails(prop: PropObject): {
    score: number;
    tier: string;
    tags: string[];
    breakdown: ScoreBreakdown;
    postable: boolean;
    solo_lock: boolean;
    zoneThreatAnalysis?: {
        eligible: boolean;
        threatLevel?: string;
        boostApplied?: number;
        pitcherName?: string;
    };
};
//# sourceMappingURL=edgeScoring.d.ts.map