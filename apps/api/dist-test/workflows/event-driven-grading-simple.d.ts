/**
 * Production-Ready Event-Driven Grading Workflow
 *
 * Enhanced Temporal workflow with idempotent processing, professional grading integration,
 * and comprehensive error handling for the Unit Talk betting intelligence platform.
 *
 * Features:
 * - Idempotent processing using unique keys (bet_slip_id)
 * - Integration with ProfessionalPropProcessor for grading
 * - Replay support for operational reliability
 * - Alert generation for high-tier picks
 * - Comprehensive monitoring and metrics
 * - Circuit breaker protection for external services
 */
export interface EventDrivenGradingWorkflowParams {
    ticketId: string;
    betSlipId: string;
    eventData: {
        bet_slip_id: string;
        capper_id: string;
        selection_count: number;
        sport?: string;
        ticket_type?: string;
        is_live?: boolean;
        selections?: Array<{
            player_name: string;
            stat_type: string;
            line: number;
            selection: 'over' | 'under';
            odds: number;
            book: string;
        }>;
        source?: 'bridge_outbox' | 'events';
        processed_from_outbox?: boolean;
        original_unique_key?: string;
    };
    idempotencyKey: string;
    replayContext?: {
        isReplay: boolean;
        originalEventId?: string;
        replayReason?: string;
        replayedAt: string;
        replayed_by?: string;
    };
    priority?: 'low' | 'normal' | 'high' | 'critical';
    processingOptions?: {
        skipIfProcessed?: boolean;
        forceReprocessing?: boolean;
        enableProfessionalFeatures?: boolean;
        generateAlerts?: boolean;
    };
}
export interface GradingWorkflowResult {
    workflowId: string;
    ticketId: string;
    betSlipId: string;
    idempotencyKey: string;
    processingStatus: 'completed' | 'failed' | 'skipped' | 'partially_completed';
    gradingResult: {
        tier: 'S-tier' | 'A-tier' | 'B-tier' | 'C-tier' | 'D-tier';
        confidence: number;
        edgeScore: number;
        processedAt: string;
        professionalScore?: number;
        featureContributions?: {
            steamDetection: number;
            closingLinePrediction: number;
            optimalTiming: number;
            lineShoppingEdge: number;
            publicSharpSplit: number;
            marketTimingAdvantage: number;
            injuryTimingEdge: number;
            crossMarketDiscrepancy: number;
        };
    };
    legsProcessed: Array<{
        legId: string;
        player_name: string;
        stat_type: string;
        line: number;
        selection: 'over' | 'under';
        gradingResult: {
            tier: string;
            confidence: number;
            edgeScore: number;
            professionalScore?: number;
        };
        processingTime: number;
        status: 'completed' | 'failed' | 'skipped';
        error?: string;
    }>;
    alertsGenerated: Array<{
        type: 'high_tier' | 'injury_opportunity' | 'line_movement' | 'hedge_opportunity' | 'middle_opportunity';
        confidence: number;
        priority: 'critical' | 'high' | 'normal' | 'low';
        metadata: any;
        generated_at: string;
    }>;
    processingMetrics: {
        totalProcessingTime: number;
        stepsCompleted: number;
        errors: number;
        retriesAttempted: number;
        idempotencyChecks: number;
        professionalFeaturesUsed: number;
    };
    replayInfo?: {
        isReplay: boolean;
        originalWorkflowId?: string;
        replayReason?: string;
        replayedBy?: string;
    };
}
/**
 * Production Event-Driven Grading Workflow with Idempotent Processing
 *
 * This workflow processes betting tickets through professional grading with:
 * - Idempotent processing using bet_slip_id as unique key
 * - Individual leg processing with circuit breaker protection
 * - Professional grading integration with 8 advanced features
 * - Comprehensive alert generation and monitoring
 * - Replay support for operational resilience
 */
export declare function eventDrivenGradingWorkflow(params: EventDrivenGradingWorkflowParams): Promise<GradingWorkflowResult>;
/**
 * Replay-specific grading workflow
 */
export declare function replayGradingWorkflow(ticketIds: string[], replayOptions: {
    dryRun?: boolean;
    batchSize?: number;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    reason: string;
}): Promise<{
    processedCount: number;
    errors: Array<{
        ticketId: string;
        error: string;
    }>;
    results: GradingWorkflowResult[];
}>;
/**
 * Alert re-emission workflow
 */
export declare function reemitAlertsWorkflow(alertIds: string[], _reemissionOptions: {
    channels?: string[];
    priority?: 'low' | 'normal' | 'high' | 'critical';
    reason: string;
}): Promise<{
    processedCount: number;
    errors: Array<{
        alertId: string;
        error: string;
    }>;
}>;
/**
 * Workflow status and control functions
 */
export interface WorkflowControlResult {
    success: boolean;
    message: string;
    affectedWorkflows: number;
}
export declare function pauseWorkflows(workflowIds: string[]): Promise<WorkflowControlResult>;
export declare function resumeWorkflows(workflowIds: string[]): Promise<WorkflowControlResult>;
export declare function cancelWorkflows(workflowIds: string[]): Promise<WorkflowControlResult>;
//# sourceMappingURL=event-driven-grading-simple.d.ts.map