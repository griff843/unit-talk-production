/**
 * Phase 9: Live Testing System
 *
 * Real-world testing infrastructure for syndicate-level ML betting system.
 * Implements paper trading, A/B testing, and performance tracking.
 *
 * @version 1.0.0
 * @author Unit Talk Platform Engineering
 */
export interface LiveTestConfig {
    paperTradingEnabled: boolean;
    startingBankroll: number;
    maxBetSize: number;
    confidenceThreshold: number;
    abTestPercentage: number;
    trackingEnabled: boolean;
}
export interface LiveTestResult {
    testId: string;
    timestamp: Date;
    sport: string;
    prediction: number;
    confidence: number;
    actualOutcome?: boolean;
    profit?: number;
    roi?: number;
}
export declare class LiveTestingSystem {
    private config;
    private bankroll;
    private testResults;
    private abTestGroup;
    constructor(config?: Partial<LiveTestConfig>);
    /**
     * Run live test on a prediction
     */
    runLiveTest(sport: string, prediction: number, confidence: number, betSize?: number): Promise<LiveTestResult>;
    /**
     * Apply treatment strategy for A/B testing
     */
    private applyTreatmentStrategy;
    /**
     * Track test result in database
     */
    private trackTestResult;
    /**
     * Update test with actual outcome
     */
    updateOutcome(testId: string, actualOutcome: boolean): Promise<void>;
    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): {
        totalTests: number;
        winRate: number;
        totalProfit: number;
        roi: number;
        currentBankroll: number;
        abTestComparison: any;
    };
    /**
     * Reset testing system
     */
    reset(): void;
    /**
     * Export test results for analysis
     */
    exportResults(): LiveTestResult[];
}
export declare const liveTestingSystem: LiveTestingSystem;
export default LiveTestingSystem;
//# sourceMappingURL=LiveTestingSystem.d.ts.map