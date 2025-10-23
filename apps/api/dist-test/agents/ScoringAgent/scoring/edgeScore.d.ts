type RawProp = {
    league: 'NBA' | 'MLB' | 'NHL';
    odds: number;
    statType?: string;
    dvp_score?: number;
    position?: string;
    context_flag?: boolean;
};
export declare function scorePick(prop: RawProp): {
    score: number;
    tier: 'S' | 'A' | 'B' | 'C';
    breakdown: Record<string, any>;
};
export {};
//# sourceMappingURL=edgeScore.d.ts.map