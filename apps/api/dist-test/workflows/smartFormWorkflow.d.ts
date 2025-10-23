export declare const pauseSignal: import("@temporalio/workflow").SignalDefinition<[], "pause">;
export declare const resumeSignal: import("@temporalio/workflow").SignalDefinition<[], "resume">;
export declare const emergencyStopSignal: import("@temporalio/workflow").SignalDefinition<[], "emergency-stop">;
export declare const getStatusQuery: import("@temporalio/workflow").QueryDefinition<WorkflowStatus, [], string>;
interface WorkflowStatus {
    isRunning: boolean;
    isPaused: boolean;
    lastBatchTime: string | null;
    processedPicksToday: number;
    errors: string[];
}
/**
 * Smart Form Daily Batch Workflow
 * Runs daily at 10:00 AM EST to process approved picks
 */
export declare function smartFormDailyBatchWorkflow(): Promise<void>;
/**
 * Smart Form Live Pick Workflow
 * Handles immediate processing of live picks
 */
export declare function smartFormLivePickWorkflow(_pickId: string): Promise<void>;
/**
 * Smart Form Health Monitor Workflow
 * Monitors system health and alerts on issues
 */
export declare function smartFormHealthMonitorWorkflow(): Promise<void>;
export {};
//# sourceMappingURL=smartFormWorkflow.d.ts.map