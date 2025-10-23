import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
interface EventSubscriptionConfig {
    batchSize: number;
    processingTimeout: number;
    retryAttempts: number;
    cooldownSeconds: number;
}
export declare class EventSubscriptionManager {
    private supabase;
    private logger;
    private subscriptions;
    private config;
    private isInitialized;
    private processingQueue;
    constructor(supabase: SupabaseClient, logger: Logger, config?: Partial<EventSubscriptionConfig>);
    setupEventSubscriptions(): Promise<void>;
    private handleNewEvent;
    private handleAlertEvent;
    private processTicketSubmission;
    private processGradingCompletion;
    private processAlertReemission;
    private processAlertEvent;
    private analyzeTicketForAlerts;
    private analyzeForHedgeMiddle;
    private emitAlert;
    private emitHighTierAlert;
    private emitReemissionAlert;
    private triggerImmediateAlert;
    private addToProcessingQueue;
    private processBatch;
    private processBatchEvent;
    private calculateInjuryConfidence;
    private calculateLineMovement;
    private calculateSteamScore;
    private calculateHedgeOpportunity;
    private isGameTimeClose;
    private getAlertPriority;
    private isAlertInCooldown;
    private setCooldown;
    getSubscriptionStatus(): Promise<{
        active: number;
        total: number;
        channels: string[];
    }>;
    /**
     * Handle bridge outbox completion events for Smart Form integration
     */
    private handleBridgeOutboxCompletion;
    /**
     * Handle workflow execution completion events for Temporal integration
     */
    private handleWorkflowCompletion;
    /**
     * Process bridge outbox ticket submission from Smart Form
     */
    private processBridgeTicketSubmission;
    /**
     * Process bridge outbox ticket completion
     */
    private processBridgeTicketCompletion;
    /**
     * Process bridge outbox grading completion
     */
    private processBridgeGradingCompletion;
    /**
     * Process successful workflow execution
     */
    private processWorkflowSuccess;
    /**
     * Process failed workflow execution
     */
    private processWorkflowFailure;
    /**
     * Analyze workflow execution results for alert opportunities
     */
    private analyzeWorkflowForAlerts;
    /**
     * Record bridge outbox processing status for tracking
     */
    private recordBridgeOutboxProcessing;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=EventSubscriptionManager.d.ts.map