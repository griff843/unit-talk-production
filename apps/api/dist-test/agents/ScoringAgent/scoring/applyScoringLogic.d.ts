export interface ScoringResult {
    trend_score: number;
    matchup_score: number;
    ev_percent: number;
    confidence_score: number;
    line_value_score: number;
    role_stability: number;
    composite_score: number;
    tier: string;
    [key: string]: any;
}
export declare function applyScoringLogic(prop: any): any;
//# sourceMappingURL=applyScoringLogic.d.ts.map