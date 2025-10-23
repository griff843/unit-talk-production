/**
 * Professional-Grade Devigging Service
 * Removes bookmaker margin (vig/juice) from all odds sources
 * This is THE fundamental requirement for sharp betting systems
 *
 * @module DeviggingService
 */
export interface DeviggingResult {
    trueProb: number;
    fairOdds: number;
    totalVig: number;
    edge: number;
    impliedProbability: number;
}
export interface TwoWayMarket {
    odds1: number;
    odds2: number;
}
export interface MultiWayMarket {
    odds: number[];
}
/**
 * Professional devigging service implementing multiple methods
 * Used by all sharp betting services (Unabated, OddsJam, etc.)
 */
export declare class DeviggingService {
    private static instance;
    private constructor();
    static getInstance(): DeviggingService;
    /**
     * Convert American odds to implied probability
     */
    private americanToImpliedProb;
    /**
     * Convert probability back to American odds
     */
    private probToAmericanOdds;
    /**
     * Devig two-way market using multiplicative method
     * This is the industry standard for two-outcome markets
     */
    devigTwoWay(market: TwoWayMarket, method?: 'multiplicative' | 'additive' | 'power'): {
        outcome1: DeviggingResult;
        outcome2: DeviggingResult;
        totalVig: number;
        deviggedEdge?: number;
    };
    /**
     * Devig multi-way market (3+ outcomes)
     * Used for futures, props with multiple outcomes
     */
    devigMultiWay(market: MultiWayMarket, method?: 'multiplicative' | 'shin'): {
        outcomes: DeviggingResult[];
        totalVig: number;
    };
    /**
     * Shin devigging method - advanced technique for multi-way markets
     * Accounts for favorite-longshot bias in bookmaker odds
     */
    private shinDevigging;
    private shinFunction;
    private shinDerivative;
    /**
     * Devig exchange odds (back/lay)
     * Exchanges have different vig structure
     */
    devigExchange(backOdds: number, layOdds: number, commission?: number): DeviggingResult;
    /**
     * Devig live/in-play odds with time decay adjustment
     * Live odds have higher vig and time-based adjustments
     */
    devigLive(market: TwoWayMarket, gameProgress: number, // 0-1 (0 = start, 1 = end)
    baseVigMultiplier?: number): {
        outcome1: DeviggingResult;
        outcome2: DeviggingResult;
        totalVig: number;
    };
    /**
     * Calculate edge given model probability and devigged market
     * This is the KEY calculation for finding value
     */
    calculateEdge(modelProb: number, marketOdds: number, includeKellyMultiplier?: boolean): {
        edge: number;
        expectedValue: number;
        kellyFraction: number;
        hasValue: boolean;
    };
    /**
     * Batch devig multiple markets efficiently
     */
    devigBatch(markets: Array<{
        id: string;
        type: 'two-way' | 'multi-way';
        odds: number[];
    }>): Map<string, DeviggingResult[]>;
}
export declare const deviggingService: DeviggingService;
//# sourceMappingURL=DeviggingService.d.ts.map