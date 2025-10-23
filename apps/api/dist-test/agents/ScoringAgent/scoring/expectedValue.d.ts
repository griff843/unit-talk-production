interface BettingSideAnalysis {
    side: 'over' | 'under';
    odds: number;
    expectedValue: number;
    impliedProbability: number;
    projectedProbability: number;
    edge: number;
}
export declare function calculateExpectedValue(prop: any): number;
export declare function analyzeBothSides(prop: any): BettingSideAnalysis | null;
export {};
//# sourceMappingURL=expectedValue.d.ts.map