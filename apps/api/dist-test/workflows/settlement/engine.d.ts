export type SettlementOutcome = 'win' | 'loss' | 'push' | 'void';
export interface SettlementInput {
    league: string;
    market: string;
    line: number;
    betType: string;
    actualStat: number;
}
export interface SettlementResult {
    actualStat: number;
    outcome: SettlementOutcome;
    reason?: string;
}
export declare class SettlementEngine {
    private logger;
    constructor();
    /**
     * Evaluate the outcome of a bet based on actual stats
     */
    evaluate(input: SettlementInput): SettlementResult;
    private normalizeBetType;
    private evaluateOverUnder;
    private evaluateYesNo;
    private evaluateAlternateLine;
    /**
     * Evaluate parlay outcome based on individual leg outcomes
     */
    evaluateParlay(legOutcomes: SettlementOutcome[]): SettlementOutcome;
    /**
     * Validate that a settlement is reasonable
     */
    validateSettlement(league: string, market: string, actualStat: number): boolean;
}
//# sourceMappingURL=engine.d.ts.map