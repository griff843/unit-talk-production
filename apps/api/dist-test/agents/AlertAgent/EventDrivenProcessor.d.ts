import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
import { TicketStateManager } from './TicketStateManager';
interface EventProcessorConfig {
    maxLatencyMs: number;
    batchSize: number;
    processingTimeoutMs: number;
    maxConcurrentEvents: number;
    retryAttempts: number;
    circuitBreakerThreshold: number;
}
interface EventProcessingMetrics {
    totalEventsProcessed: number;
    averageLatencyMs: number;
    p99LatencyMs: number;
    alertsGenerated: number;
    hedgeOpportunitiesFound: number;
    circuitBreakerTrips: number;
    errorRate: number;
    throughputPerSecond: number;
}
export declare class EventDrivenProcessor {
    private supabase;
    private logger;
    private config;
    private ticketStateManager;
    private hedgeDetectionEngine;
    private metrics;
    private realtimeSubscription;
    private processingQueue;
    private activeProcessing;
    private deduplicationCache;
    private latencyBuffer;
    private lastThroughputCalculation;
    private eventsInLastSecond;
    private isHealthy;
    private consecutiveErrors;
    private lastHealthCheck;
    constructor(supabase: SupabaseClient, logger: Logger, ticketStateManager: TicketStateManager, config?: Partial<EventProcessorConfig>);
    /**
     * Initialize real-time subscriptions to prop_ticks_hot
     */
    initialize(): Promise<void>;
    /**
     * Setup real-time subscriptions to prop_ticks_hot table
     */
    private setupRealtimeSubscriptions;
    /**
     * Handle incoming prop tick events with <1 second processing
     */
    private handlePropTickEvent;
    /**
     * Process critical events immediately (steam, sharp money, large line movements)
     */
    private processCriticalEvent;
    /**
     * Core event processing logic
     */
    private processEvent;
    /**
     * Analyze steam move for alert opportunity
     */
    private analyzeSteamMove;
    /**
     * Analyze line movement for alert opportunity
     */
    private analyzeLineMovement;
    /**
     * Check for arbitrage opportunities across books
     */
    private checkArbitrageOpportunities;
    /**
     * Calculate arbitrage opportunity between two ticks
     */
    private calculateArbitrageOpportunity;
    /**
     * Identify tickets that need state updates based on prop tick
     */
    private identifyTicketStateUpdates;
    /**
     * Generate immediate alerts for critical events
     */
    private generateImmediateAlerts;
    /**
     * Process hedge opportunities
     */
    private processHedgeOpportunities;
    /**
     * Update ticket states based on event
     */
    private updateTicketStates;
    /**
     * Update ticket cashout value based on current market conditions
     */
    private updateTicketCashoutValue;
    /**
     * Calculate current cashout value for a ticket
     */
    private calculateCashoutValue;
    /**
     * Check if event is duplicate
     */
    private isDuplicateEvent;
    /**
     * Check if event is critical (needs immediate processing)
     */
    private isCriticalEvent;
    /**
     * Queue event for batch processing
     */
    private queueEvent;
    /**
     * Process batch of queued events
     */
    private processBatch;
    /**
     * Process alerts for batch of events
     */
    private processBatchAlerts;
    /**
     * Emit alert event to event system
     */
    private emitAlertEvent;
    /**
     * Update latency metrics
     */
    private updateLatencyMetrics;
    /**
     * Calculate steam confidence score
     */
    private calculateSteamConfidence;
    /**
     * Start fallback polling for missed events
     */
    private startFallbackPolling;
    /**
     * Poll for any missed events
     */
    private pollForMissedEvents;
    /**
     * Clean old deduplication cache entries
     */
    private cleanDeduplicationCache;
    /**
     * Handle processing errors
     */
    private handleProcessingError;
    /**
     * Start health monitoring
     */
    private startHealthMonitoring;
    /**
     * Check health and reset metrics periodically
     */
    private checkHealthAndResetMetrics;
    /**
     * Start metrics collection
     */
    private startMetricsCollection;
    /**
     * Emit metrics event for monitoring
     */
    private emitMetricsEvent;
    /**
     * Get current performance metrics
     */
    getMetrics(): EventProcessingMetrics;
    /**
     * Get health status
     */
    getHealthStatus(): {
        healthy: boolean;
        metrics: EventProcessingMetrics;
    };
    /**
     * Cleanup and shutdown
     */
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=EventDrivenProcessor.d.ts.map