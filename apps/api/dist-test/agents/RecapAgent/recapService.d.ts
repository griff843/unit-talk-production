import { RecapSummary, ParlayGroup, MicroRecapData, RoiWatcherState, RecapConfig } from '../../types/picks';
/**
 * Enhanced RecapService with production-ready features
 * Handles data querying, processing, and real-time ROI monitoring
 */
export declare class RecapService {
    private supabase;
    private config;
    private roiWatcherState;
    private lastMicroRecapSent;
    constructor(config?: Partial<RecapConfig>);
    /**
     * Initialize the service and set up real-time monitoring
     */
    initialize(): Promise<void>;
    /**
     * Test database connection
     */
    testConnection(): Promise<void>;
    /**
     * Get daily recap data with enhanced analytics
     */
    getDailyRecapData(date: string): Promise<RecapSummary | null>;
    /**
     * Get weekly recap data
     */
    getWeeklyRecapData(startDate: string, endDate: string): Promise<RecapSummary | null>;
    /**
     * Get monthly recap data
     */
    getMonthlyRecapData(startDate: string, endDate: string): Promise<RecapSummary | null>;
    /**
     * Process raw pick data into structured recap summary
     */
    private processRecapData;
    /**
     * Calculate enhanced capper statistics with sparklines
     */
    private calculateCapperStats;
    /**
     * Calculate tier statistics
     */
    private calculateTierStats;
    /**
     * Calculate hot streaks
     */
    private calculateHotStreaks;
    /**
     * Get parlay groups for a date range
     */
    getParlayGroups(startDate: string, endDate?: string): Promise<ParlayGroup[]>;
    /**
     * Real-time ROI monitoring for micro-recaps
     */
    checkRoiThreshold(): Promise<MicroRecapData | null>;
    /**
     * Check if last pick of day was grading_status
     */
    checkLastPickGraded(): Promise<MicroRecapData | null>;
    /**
     * Initialize ROI watcher state
     */
    private initializeRoiWatcher;
    private mapRawPickToUnifiedPick;
    private extractCapper;
    private calculateUnits;
    private buildMatchup;
    private calculateAverageEdge;
    private calculateAverageClv;
    private calculateCurrentStreak;
    private getStreakPicks;
    private generateStreakSparkline;
    private findBestPick;
    private findWorstPick;
    private findBiggestWin;
    private findBadBeat;
    private calculateParlayOdds;
    private determineParlayOutcome;
    private calculateParlayProfitLoss;
    getConfig(): RecapConfig;
    getRoiWatcherState(): RoiWatcherState;
}
//# sourceMappingURL=recapService.d.ts.map