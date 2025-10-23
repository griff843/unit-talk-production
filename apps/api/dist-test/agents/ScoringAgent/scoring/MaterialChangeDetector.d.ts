/**
 * Material Change Detection System
 *
 * Monitors for material changes that require immediate re-scoring of props.
 * Implements sophisticated change detection algorithms with thresholds,
 * state management, and audit trails. Designed for 30-second response times
 * to material events affecting 8K+ simultaneous props.
 */
import { EventEmitter } from 'events';
import { FeatureStoreIntegration } from './FeatureStoreIntegration';
export interface MaterialChange {
    propId: string;
    changeType: MaterialChangeType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    impact: number;
    timestamp: number;
    previousValue: any;
    newValue: any;
    threshold: number;
    sport: string;
    player?: string;
    market?: string;
    source: string;
    confidence: number;
    correlatedChanges: string[];
}
export declare enum MaterialChangeType {
    ODDS_SHIFT = "odds_shift",// Significant odds movement
    LINE_MOVEMENT = "line_movement",// Line movement beyond threshold
    STEAM_MOVE = "steam_move",// Detected steam move
    VOLUME_SPIKE = "volume_spike",// Unusual betting volume
    MARKET_SUSPENSION = "market_suspension",// Market temporarily suspended
    INJURY_NEWS = "injury_news",// New injury information
    LINEUP_CHANGE = "lineup_change",// Starting lineup changes
    USAGE_CHANGE = "usage_change",// Role/usage rate changes
    PERFORMANCE_ANOMALY = "performance_anomaly",// Unusual recent performance
    WEATHER_CHANGE = "weather_change",// Weather condition changes
    VENUE_CHANGE = "venue_change",// Game location changes
    OFFICIAL_CHANGE = "official_change",// Referee changes
    GAME_TIME_CHANGE = "game_time_change",// Start time modifications
    NEWS_BREAK = "news_break",// Breaking news affecting game
    SUSPENSION = "suspension",// Player/team suspension
    TRADE_NEWS = "trade_news",// Trade deadline activity
    MODEL_UPDATE = "model_update",// ML model refresh
    DATA_CORRECTION = "data_correction",// Historical data correction
    CALCULATION_ERROR = "calculation_error"
}
interface ChangeThreshold {
    changeType: MaterialChangeType;
    sport: string;
    threshold: number;
    timeWindow: number;
    minConfidence: number;
}
export declare class MaterialChangeDetector extends EventEmitter {
    private logger;
    private featureStore;
    private propStates;
    private changeQueue;
    private processingInterval;
    private readonly PROCESSING_INTERVAL_MS;
    private readonly MAX_QUEUE_SIZE;
    private readonly STATE_CLEANUP_INTERVAL;
    private changeThresholds;
    constructor(featureStore: FeatureStoreIntegration);
    /**
     * Register a prop for change monitoring
     */
    registerProp(propId: string, sport: string, watchedFactors?: string[], initialValues?: Record<string, any>): void;
    /**
     * Update prop values and detect changes
     */
    updatePropValues(propId: string, newValues: Record<string, any>, source?: string): Promise<MaterialChange[]>;
    /**
     * Batch update multiple props
     */
    batchUpdateProps(updates: Array<{
        propId: string;
        newValues: Record<string, any>;
        source?: string;
    }>): Promise<Map<string, MaterialChange[]>>;
    /**
     * Get change history for a prop
     */
    getChangeHistory(propId: string, since?: number, changeTypes?: MaterialChangeType[]): MaterialChange[];
    /**
     * Get aggregated change statistics
     */
    getChangeStatistics(timeWindow?: number): {
        totalChanges: number;
        changesByType: Record<MaterialChangeType, number>;
        changesBySeverity: Record<string, number>;
        avgImpact: number;
        propsAffected: number;
    };
    /**
     * Manually trigger change detection for a factor
     */
    forceChangeDetection(propId: string, factor: string, newValue: any, source?: string): Promise<MaterialChange | null>;
    /**
     * Clean up old prop states
     */
    cleanup(olderThan?: number): number;
    private detectMaterialChange;
    private getChangeTypeFromFactor;
    private extractSportFromPropId;
    private findThreshold;
    private calculateChangeMagnitude;
    private calculateChangeConfidence;
    private determineSeverity;
    private calculateImpact;
    private findCorrelatedChanges;
    private getDefaultWatchedFactors;
    private addChangesToQueue;
    private startProcessing;
    private processBatch;
    private startStateCleanup;
    /**
     * Get current status for monitoring
     */
    getStatus(): {
        trackedProps: number;
        queuedChanges: number;
        totalChangesDetected: number;
        avgChangesPerHour: number;
    };
    /**
     * Export configuration for debugging
     */
    exportConfig(): {
        thresholds: ChangeThreshold[];
        processingInterval: number;
        maxQueueSize: number;
    };
    /**
     * Shutdown cleanup
     */
    shutdown(): void;
}
export {};
//# sourceMappingURL=MaterialChangeDetector.d.ts.map