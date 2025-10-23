export declare const pauseSignal: import("@temporalio/workflow").SignalDefinition<[string], string>;
export declare const resumeSignal: import("@temporalio/workflow").SignalDefinition<[string], string>;
export declare const emergencyStopSignal: import("@temporalio/workflow").SignalDefinition<[string], string>;
/**
 * MAIN SYNDICATE SCHEDULER WORKFLOW
 * Orchestrates all ingestion, processing, and alerting on 2-minute intervals
 */
export declare function syndicateSchedulerWorkflow(): Promise<void>;
/**
 * LEAGUE-SPECIFIC INGESTION WORKFLOW
 * Handles ingestion for a single league with fallback support
 */
export declare function leagueIngestionWorkflow(params: {
    league: string;
    isLiveMode: boolean;
    cycleCount: number;
}): Promise<void>;
/**
 * USP PROCESSING WORKFLOW
 * Detects all Unique Selling Propositions in parallel
 */
export declare function uspProcessingWorkflow(params: {
    leagues: string[];
    isLiveMode: boolean;
    cycleCount: number;
}): Promise<void>;
/**
 * GRADING AND SCORING WORKFLOW
 * Fast grading and scoring for syndicate speed
 */
export declare function gradingAndScoringWorkflow(params: {
    leagues: string[];
    isLiveMode: boolean;
    cycleCount: number;
}): Promise<void>;
/**
 * DISCORD ALERT WORKFLOW
 * <30 second Discord delivery for syndicate performance
 */
export declare function discordAlertWorkflow(params: {
    cycleCount: number;
    isLiveMode: boolean;
}): Promise<void>;
//# sourceMappingURL=syndicate-scheduler.d.ts.map