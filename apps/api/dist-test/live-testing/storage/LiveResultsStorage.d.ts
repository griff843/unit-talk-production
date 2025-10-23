/**
 * Phase 9: Live Results Storage and Reporting System
 *
 * Persistent storage system for live testing results with comprehensive
 * reporting capabilities and data export functionality.
 */
import { LiveBet, LiveTestingConfig, DailyResult, WeeklyResult, PhaseResult, SportResult, CLVTrack, RiskReport } from '../types';
export declare class LiveResultsStorage {
    private logger;
    private config;
    constructor(config: LiveTestingConfig);
    storeLiveBet(bet: LiveBet): Promise<void>;
    updateLiveBetResult(betId: string, result: 'WIN' | 'LOSS' | 'PUSH', pnl: number, clv?: number): Promise<void>;
    private getBetStake;
    storeDailyReport(report: DailyResult): Promise<void>;
    storeWeeklyReport(report: WeeklyResult): Promise<void>;
    storePhaseReport(report: PhaseResult): Promise<void>;
    storeCLVTrack(track: CLVTrack): Promise<void>;
    storeRiskReport(report: RiskReport): Promise<void>;
    getLiveBets(phase?: string, dateRange?: {
        start: string;
        end: string;
    }, limit?: number): Promise<LiveBet[]>;
    getDailyReports(dateRange?: {
        start: string;
        end: string;
    }, phase?: string): Promise<DailyResult[]>;
    getPhaseReports(): Promise<PhaseResult[]>;
    getCLVTracks(betId?: string, dateRange?: {
        start: string;
        end: string;
    }): Promise<CLVTrack[]>;
    getPerformanceByPhase(): Promise<PhaseResult[]>;
    getPerformanceBySport(): Promise<SportResult[]>;
    private calculateConfidence;
    exportAllData(format?: 'json' | 'csv'): Promise<string>;
    private convertDataToCSV;
    createTablesIfNotExist(): Promise<void>;
    private convertToLiveBet;
    private convertToDailyResult;
    private convertToPhaseResult;
    private convertToCLVTrack;
}
//# sourceMappingURL=LiveResultsStorage.d.ts.map