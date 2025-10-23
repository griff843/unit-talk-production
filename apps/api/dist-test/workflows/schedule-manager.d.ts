import { ScheduleOverlapPolicy, ScheduleSpec } from '@temporalio/client';
export interface ScheduleConfig {
    scheduleId: string;
    workflowType: string;
    args: any[];
    spec: ScheduleSpec;
    policies?: {
        overlap?: ScheduleOverlapPolicy;
        catchupWindow?: any;
        pauseOnFailure?: boolean;
    };
}
/**
 * SYNDICATE SCHEDULE MANAGER
 * Manages all Temporal schedules for 2-minute syndicate operations
 */
export declare class SyndicateScheduleManager {
    private client;
    private schedules;
    constructor();
    /**
     * Initialize all syndicate schedules
     */
    initializeSchedules(): Promise<void>;
    /**
     * Create or update a Temporal schedule
     */
    private createSchedule;
    /**
     * Pause a schedule (for maintenance or emergencies)
     */
    pauseSchedule(scheduleId: string, reason: string): Promise<void>;
    /**
     * Resume a paused schedule
     */
    resumeSchedule(scheduleId: string, reason: string): Promise<void>;
    /**
     * Get schedule status and metrics
     */
    getScheduleStatus(scheduleId: string): Promise<any>;
    /**
     * Emergency stop all schedules
     */
    emergencyStopAll(reason: string): Promise<void>;
    /**
     * Resume all schedules after emergency
     */
    resumeAllAfterEmergency(reason: string): Promise<void>;
    /**
     * Get comprehensive system status
     */
    getSystemStatus(): Promise<any>;
}
export declare function getSyndicateScheduleManager(): SyndicateScheduleManager;
/**
 * Initialize syndicate scheduling system
 */
export declare function initializeSyndicateScheduling(): Promise<void>;
/**
 * Emergency controls for operators
 */
export declare function emergencyPauseAll(reason: string): Promise<void>;
export declare function emergencyResumeAll(reason: string): Promise<void>;
export declare function getSystemHealthStatus(): Promise<any>;
//# sourceMappingURL=schedule-manager.d.ts.map