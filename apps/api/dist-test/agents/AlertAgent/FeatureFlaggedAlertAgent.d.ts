/**
 * Feature-Flagged Alert Agent
 *
 * Orchestrates between Event-Driven and Polling Alert modes
 * with comprehensive A/B testing, performance monitoring, and automatic rollback
 */
import { BaseAgent } from '../BaseAgent';
import { SupabaseClient } from '@supabase/supabase-js';
export interface PollingAlertProcessor {
    initialize(): Promise<void>;
    processAlerts(batchSize?: number): Promise<AlertProcessingResult>;
    getMetrics(): PollingMetrics;
    cleanup(): Promise<void>;
}
export interface AlertProcessingResult {
    alertsProcessed: number;
    alertsGenerated: number;
    averageLatency: number;
    errorCount: number;
    processingTimeMs: number;
    alerts: AlertOpportunity[];
}
export interface PollingMetrics {
    totalAlertsProcessed: number;
    averageLatencyMs: number;
    errorRate: number;
    throughputPerSecond: number;
    lastPollingTime: string;
}
export interface AlertOpportunity {
    type: 'steam' | 'line_movement' | 'injury' | 'sharp_money' | 'arbitrage';
    priority: 'urgent' | 'high' | 'medium' | 'low';
    confidence: number;
    player_name: string;
    stat_type: string;
    trigger_data: Record<string, any>;
    expires_at: string;
}
export interface AlertComparisonResult {
    alertId: string;
    userId?: string;
    flagEnabled: boolean;
    variant: 'control' | 'treatment';
    abTestGroup?: string;
    pollingResult?: AlertProcessingResult;
    pollingLatency?: number;
    eventDrivenResult?: AlertProcessingResult;
    eventDrivenLatency?: number;
    latencyDelta: number;
    accuracyComparison?: number;
    selectedResult: AlertProcessingResult;
    selectionReason: string;
    timestamp: string;
    environment: string;
}
export declare class FeatureFlaggedAlertAgent extends BaseAgent {
    private logger;
    private eventDrivenProcessor?;
    private pollingProcessor?;
    private featureFlagService;
    private abTestingEngine;
    private performanceMetrics;
    private isProcessing;
    private pollingInterval?;
    constructor(supabase: SupabaseClient);
    /**
     * Process alerts using feature-flagged approach
     */
    processAlerts(context?: {
        userId?: string;
        sessionId?: string;
        batchSize?: number;
        metadata?: Record<string, any>;
    }): Promise<AlertComparisonResult>;
    /**
     * Run polling mode alert processing
     */
    private runPollingMode;
    /**
     * Run event-driven mode alert processing
     */
    private runEventDrivenMode;
    /**
     * Determine which system to use based on A/B test assignment
     */
    private determineSelectionStrategy;
    /**
     * Calculate accuracy comparison between systems
     */
    private calculateAccuracyComparison;
    /**
     * Track A/B testing events for both systems
     */
    private trackABTestingEvents;
    /**
     * Update internal performance metrics
     */
    private updatePerformanceMetrics;
    /**
     * Store comparison result for analysis
     */
    private storeComparisonResult;
    /**
     * Initialize processors based on feature flags
     */
    private initializeProcessors;
    /**
     * Initialize polling processor
     */
    private initializePollingProcessor;
    /**
     * Initialize event-driven processor
     */
    private initializeEventDrivenProcessor;
    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring;
    /**
     * Emit performance metrics for monitoring
     */
    private emitPerformanceMetrics;
    /**
     * Reset performance metrics
     */
    private resetPerformanceMetrics;
    /**
     * Start continuous alert processing
     */
    startContinuousProcessing(intervalMs?: number): Promise<void>;
    /**
     * Stop continuous alert processing
     */
    stopContinuousProcessing(): Promise<void>;
    /**
     * Get agent health status
     */
    getHealthStatus(): {
        healthy: boolean;
        metrics: typeof this.performanceMetrics;
        eventDrivenProcessorReady: boolean;
        pollingProcessorReady: boolean;
        continuousProcessing: boolean;
    };
    /**
     * Get A/B test analysis for the alert system
     */
    getABTestAnalysis(): Promise<any>;
    /**
     * Generate comprehensive alert system report
     */
    generateSystemReport(): Promise<any>;
    /**
     * Cleanup and shutdown
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=FeatureFlaggedAlertAgent.d.ts.map