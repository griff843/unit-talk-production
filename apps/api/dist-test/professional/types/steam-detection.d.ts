/**
 * Steam Detection Engine Types
 * Feature 1 of 8 Professional Capper Features
 *
 * Real-time steam move detection with volume correlation
 * Monitor line movements >2 points within 5 minutes
 * Correlate with betting volume and sharp money indicators
 */
export interface SteamDetectionConfig {
    minLineMovement: number;
    timeWindow: number;
    volumeCorrelationThreshold: number;
    reverseLineMovementWeight: number;
    volumeSpikeWeight: number;
    bookmakerReactionWeight: number;
    crossBookConsensusWeight: number;
    enabledBooks: string[];
    updateFrequency: number;
    minVolume: number;
    sportSpecificThresholds: Record<string, SteamSportConfig>;
}
export interface SteamSportConfig {
    sport: string;
    lineMovementMultiplier: number;
    volumeMultiplier: number;
    steamFrequency: number;
    falsePositiveRate: number;
}
export interface SteamDetectionInput {
    propId: string;
    sport: string;
    market: string;
    currentLine: number;
    currentOdds: number;
    timestamp: string;
    lineHistory: LineDataPoint[];
    volumeHistory: VolumeDataPoint[];
    bookmakerData: BookmakerDataPoint[];
}
export interface LineDataPoint {
    timestamp: string;
    line: number;
    odds: number;
    bookmaker: string;
    volume?: number;
}
export interface VolumeDataPoint {
    timestamp: string;
    volume: number;
    side: 'OVER' | 'UNDER';
    bookmaker: string;
    isSharpMoney?: boolean;
}
export interface BookmakerDataPoint {
    timestamp: string;
    bookmaker: string;
    action: 'MOVE_LINE' | 'ADJUST_ODDS' | 'LIMIT_REDUCE' | 'SUSPEND';
    details: any;
}
export interface SteamAnalysisResult {
    steamDetected: boolean;
    steamScore: number;
    confidence: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    lineMovement: {
        totalMovement: number;
        timeToMove: number;
        accelerationRate: number;
        consistency: number;
    };
    volumeCorrelation: {
        correlation: number;
        volumeIncrease: number;
        sharpMoneyPercentage: number;
        publicMoneyPercentage: number;
    };
    sharpIndicators: {
        reverseLineMovement: SharpIndicator;
        volumeSpike: SharpIndicator;
        bookmakerReaction: SharpIndicator;
        crossBookConsensus: SharpIndicator;
        overallSharpScore: number;
    };
    historicalSteam: {
        similarSteamEvents: number;
        avgSteamSuccess: number;
        playerSteamHistory: number;
        marketSteamHistory: number;
    };
    predictions: {
        continuedMovement: number;
        reversalProbability: number;
        finalLineEstimate: number;
        timeToStabilize: number;
    };
    recommendation: SteamActionRecommendation;
}
export interface SharpIndicator {
    detected: boolean;
    score: number;
    confidence: number;
    evidence: string[];
    weight: number;
}
export interface SteamActionRecommendation {
    action: 'BET_IMMEDIATELY' | 'MONITOR_CLOSELY' | 'WAIT_FOR_STABILITY' | 'AVOID_STEAM';
    reasoning: string;
    urgency: 'IMMEDIATE' | 'SOON' | 'MONITOR' | 'NO_ACTION';
    optimalEntryWindow: {
        start: string;
        end: string;
        reasoning: string;
    };
    steamRisk: {
        falsePositiveRisk: number;
        reversalRisk: number;
        continuedrMovementRisk: number;
        overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    };
    steamEdge: {
        currentEdge: number;
        peakEdge: number;
        expectedEdge: number;
        edgeDecayRate: number;
    };
}
export interface SteamDetectionMetrics {
    totalDetections: number;
    truePositives: number;
    falsePositives: number;
    precision: number;
    recall: number;
    f1Score: number;
    avgDetectionLatency: number;
    earlyDetectionRate: number;
    avgSteamEdge: number;
    steamBetSuccess: number;
    avgCLV: number;
    marketsMonitored: number;
    steamEventsPerDay: number;
    avgSteamSize: number;
    sportMetrics: Record<string, SteamSportMetrics>;
}
export interface SteamSportMetrics {
    sport: string;
    detections: number;
    precision: number;
    avgEdge: number;
    avgCLV: number;
    steamFrequency: number;
}
export interface SteamMonitoringState {
    activeProps: Map<string, SteamPropState>;
    recentSteams: SteamEvent[];
    systemLoad: number;
    config: SteamDetectionConfig;
    lastConfigUpdate: string;
    metrics: SteamDetectionMetrics;
    lastMetricsUpdate: string;
    health: {
        status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
        dataFeed: boolean;
        volumeFeed: boolean;
        processingLatency: number;
        errors: string[];
    };
}
export interface SteamPropState {
    propId: string;
    startMonitoring: string;
    currentLine: number;
    initialLine: number;
    totalMovement: number;
    lastUpdate: string;
    steamStatus: 'MONITORING' | 'STEAM_DETECTED' | 'STEAM_ENDED' | 'FALSE_ALARM';
    lastAnalysis: SteamAnalysisResult;
    lineHistory: LineDataPoint[];
    volumeHistory: VolumeDataPoint[];
    analysisHistory: SteamAnalysisResult[];
}
export interface SteamEvent {
    id: string;
    propId: string;
    sport: string;
    market: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    lineMovement: number;
    volumeIncrease: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    confirmed: boolean;
    finalResult?: 'WIN' | 'LOSS' | 'PUSH';
    clv?: number;
    edge?: number;
    detectModel: string;
    confidence: number;
    tags: string[];
}
export interface SteamDetectionEngine {
    detectSteam(input: SteamDetectionInput): Promise<SteamAnalysisResult>;
    startMonitoring(propId: string): void;
    stopMonitoring(propId: string): void;
    getMonitoringState(): SteamMonitoringState;
    updateConfig(config: Partial<SteamDetectionConfig>): void;
    getConfig(): SteamDetectionConfig;
    getMetrics(): SteamDetectionMetrics;
    getSteamHistory(filters?: SteamHistoryFilters): SteamEvent[];
    checkHealth(): Promise<EngineHealthStatus>;
}
export interface SteamHistoryFilters {
    sport?: string;
    market?: string;
    dateRange?: {
        start: string;
        end: string;
    };
    severity?: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];
    confirmed?: boolean;
    minLineMovement?: number;
    maxLineMovement?: number;
}
export interface EngineHealthStatus {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    lastUpdate: string;
    checks: {
        dataConnectivity: boolean;
        processingSpeed: boolean;
        memoryUsage: boolean;
        errorRate: boolean;
    };
    warnings: string[];
    errors: string[];
}
//# sourceMappingURL=steam-detection.d.ts.map