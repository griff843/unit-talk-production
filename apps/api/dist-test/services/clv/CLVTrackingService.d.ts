/**
 * CLV (Closing Line Value) Tracking Service
 * The North Star metric for professional betting success
 * Tracks whether picks consistently beat the closing line
 *
 * @module CLVTrackingService
 */
export interface CLVEntry {
    propId: string;
    userId?: string;
    sport: string;
    market: string;
    book: string;
    openingLine: number;
    openingOdds: number;
    betLine: number;
    betOdds: number;
    closingLine: number;
    closingOdds: number;
    openingTime: Date;
    betTime: Date;
    closingTime: Date;
    gameTime: Date;
    clv: number;
    clvPercentage: number;
    beatsClosing: boolean;
    modelEdge: number;
    actualResult?: boolean;
    profit?: number;
    deviggedOpeningProb: number;
    deviggedClosingProb: number;
    deviggedCLV: number;
}
export interface CLVStats {
    totalBets: number;
    clvPositive: number;
    clvNegative: number;
    avgCLV: number;
    avgCLVPercentage: number;
    last24h: CLVMetrics;
    last7d: CLVMetrics;
    last30d: CLVMetrics;
    allTime: CLVMetrics;
    bySport: Map<string, CLVMetrics>;
    byMarket: Map<string, CLVMetrics>;
    byBook: Map<string, CLVMetrics>;
}
export interface CLVMetrics {
    count: number;
    avgCLV: number;
    winRate: number;
    roi: number;
    stdDev: number;
}
export declare class CLVTrackingService {
    private static instance;
    private logger;
    private clvCache;
    private constructor();
    static getInstance(): CLVTrackingService;
    /**
     * Track a new pick with opening line data
     */
    trackPick(pick: {
        propId: string;
        userId?: string;
        sport: string;
        market: string;
        book: string;
        betLine: number;
        betOdds: number;
        modelEdge: number;
        openingLine?: number;
        openingOdds?: number;
        gameTime: Date;
    }): Promise<string>;
    /**
     * Update closing line and calculate CLV
     */
    updateClosingLine(propId: string, closingLine: number, closingOdds: number): Promise<CLVEntry>;
    /**
     * Calculate CLV from odds
     */
    private calculateCLV;
    /**
     * Get CLV statistics
     */
    getCLVStats(filters?: {
        userId?: string;
        sport?: string;
        market?: string;
        book?: string;
        startDate?: Date;
        endDate?: Date;
    }): Promise<CLVStats>;
    /**
     * Calculate statistics from CLV entries
     */
    private calculateStats;
    /**
     * Calculate detailed metrics for a set of entries
     */
    private calculateMetrics;
    /**
     * Group entries and calculate metrics
     */
    private groupAndCalculate;
    /**
     * Convert American odds to probability
     */
    private oddsToProb;
    /**
     * Update actual result for CLV entry
     */
    updateResult(propId: string, won: boolean, profit: number): Promise<void>;
    /**
     * Get recent CLV performance for alerts
     */
    getRecentPerformance(hours?: number): Promise<{
        avgCLV: number;
        trend: 'improving' | 'stable' | 'declining';
        alert: boolean;
        message?: string;
    }>;
}
export declare const clvTrackingService: CLVTrackingService;
//# sourceMappingURL=CLVTrackingService.d.ts.map