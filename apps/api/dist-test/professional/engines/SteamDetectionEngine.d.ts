/**
 * Steam Detection Engine
 * Feature 1 of 8 Professional Capper Features
 *
 * Real-time steam move detection with volume correlation
 * Monitor line movements >2 points within 5 minutes
 * Correlate with betting volume and sharp money indicators
 * Integration with Optimal API and Odds API data streams
 */
import { EventEmitter } from 'events';
import type { SteamDetectionEngine as ISteamDetectionEngine, SteamDetectionConfig, SteamDetectionInput, SteamAnalysisResult, SteamMonitoringState, SteamDetectionMetrics, SteamEvent, SteamHistoryFilters, EngineHealthStatus } from '../types/steam-detection';
export declare class SteamDetectionEngine extends EventEmitter implements ISteamDetectionEngine {
    private logger;
    private config;
    private monitoringState;
    private steamHistory;
    private isProcessing;
    constructor(config?: Partial<SteamDetectionConfig>);
    private initializeMonitoringState;
    /**
     * Core steam detection algorithm
     */
    detectSteam(input: SteamDetectionInput): Promise<SteamAnalysisResult>;
    /**
     * Analyze line movement patterns
     */
    private analyzeLineMovement;
    /**
     * Analyze volume correlation with line movement
     */
    private analyzeVolumeCorrelation;
    /**
     * Detect sharp money indicators
     */
    private detectSharpMoneyIndicators;
    /**
     * Get historical context for similar events
     */
    private getHistoricalContext;
    /**
     * Generate predictions about future line movement
     */
    private generatePredictions;
    /**
     * Calculate overall steam score
     */
    private calculateSteamScore;
    /**
     * Determine if steam is detected based on score and sport
     */
    private determineSteamDetection;
    /**
     * Calculate confidence in steam detection
     */
    private calculateConfidence;
    /**
     * Determine steam severity
     */
    private determineSeverity;
    /**
     * Generate actionable recommendation
     */
    private generateRecommendation;
    /**
     * Generate reasoning text for recommendation
     */
    private generateReasoningText;
    /**
     * Update monitoring state for a prop
     */
    private updatePropState;
    /**
     * Update performance metrics
     */
    private updateMetrics;
    /**
     * Start monitoring a prop for steam
     */
    startMonitoring(propId: string): void;
    /**
     * Stop monitoring a prop
     */
    stopMonitoring(propId: string): void;
    /**
     * Get current monitoring state
     */
    getMonitoringState(): SteamMonitoringState;
    /**
     * Update engine configuration
     */
    updateConfig(config: Partial<SteamDetectionConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): SteamDetectionConfig;
    /**
     * Get performance metrics
     */
    getMetrics(): SteamDetectionMetrics;
    /**
     * Get steam history with optional filters
     */
    getSteamHistory(filters?: SteamHistoryFilters): SteamEvent[];
    /**
     * Check engine health status
     */
    checkHealth(): Promise<EngineHealthStatus>;
}
//# sourceMappingURL=SteamDetectionEngine.d.ts.map