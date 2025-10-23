/**
 * Structured debug logging for scoring system
 * Provides detailed scoring breakdown when SCORING_DEBUG=true
 * Keeps logs compact (<4KB) and redacts PII
 */
export interface ScoringLogEntry {
    trace_id: string;
    prop_id: string;
    league: string;
    market: string;
    odds_open?: number;
    odds_now?: number;
    devig_win_prob?: number;
    clv_pct?: number;
    features: Array<{
        name: string;
        value: number;
        weight: number;
        contribution: number;
    }>;
    composite: number;
    tier: string;
    kelly_fraction: number;
    timestamp: string;
    processing_time_ms?: number;
    model_version?: string;
    sport_config?: string;
}
interface ScoringDebugContext {
    propId: string;
    sport: string;
    market: string;
    startTime: number;
    traceId: string;
}
export declare class ScoringLogger {
    private static instance;
    private readonly SCORING_DEBUG;
    private readonly MAX_LOG_SIZE;
    private constructor();
    static getInstance(): ScoringLogger;
    /**
     * Check if debug logging is enabled
     */
    isEnabled(): boolean;
    /**
     * Start a scoring trace
     */
    startTrace(propId: string, sport: string, market: string): ScoringDebugContext;
    /**
     * Log scoring result with full breakdown
     */
    logScoringResult(context: ScoringDebugContext, result: {
        tier: string;
        finalScore: number;
        confidence: number;
        kellyFraction: number;
        featureContributions?: Record<string, number>;
        deviggingResult?: any;
        clvPct?: number;
        modelVersion?: string;
        sportConfig?: string;
    }, weights?: Record<string, number>): void;
    /**
     * Log feature engineering steps
     */
    logFeatureEngineering(context: ScoringDebugContext, originalFeatures: any, enrichedFeatures: any): void;
    /**
     * Log devigging results
     */
    logDevigging(context: ScoringDebugContext, originalOdds: number, deviggingResult: any): void;
    /**
     * Log CLV tracking initiation
     */
    logCLVTracking(context: ScoringDebugContext, clvTrackingId: string, initialLine: number): void;
    /**
     * Log professional path routing
     */
    logProfessionalRouting(context: ScoringDebugContext, pathUsed: 'PROFESSIONAL' | 'LEGACY', processingTimeMs: number): void;
    /**
     * Redact personally identifiable information
     */
    private redactPII;
    /**
     * Truncate strings to prevent log bloat
     */
    private truncateString;
    /**
     * Round numbers to specified decimal places
     */
    private roundToDecimal;
}
export declare const scoringLogger: ScoringLogger;
export {};
//# sourceMappingURL=scoringLogger.d.ts.map