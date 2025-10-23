import type { RecapType } from '../types/picks';
export interface RecapActivities {
    triggerDailyRecap(date?: string): Promise<void>;
    triggerWeeklyRecap(): Promise<void>;
    triggerMonthlyRecap(): Promise<void>;
    checkMicroRecapTriggers(): Promise<void>;
}
export interface RecapState {
    lastDailyRecap?: string;
    lastWeeklyRecap?: string;
    lastMonthlyRecap?: string;
    lastMicroRecap?: string;
    microRecapCooldownUntil?: string;
    manualTriggers: {
        daily: number;
        weekly: number;
        monthly: number;
    };
}
export declare const triggerDailyRecapSignal: import("@temporalio/workflow").SignalDefinition<[], "triggerDailyRecap">;
export declare const triggerWeeklyRecapSignal: import("@temporalio/workflow").SignalDefinition<[], "triggerWeeklyRecap">;
export declare const triggerMonthlyRecapSignal: import("@temporalio/workflow").SignalDefinition<[], "triggerMonthlyRecap">;
/**
 * Daily recap workflow - runs at 9 AM every day
 * Cron: At 9:00 AM every day
 */
export declare function dailyRecapWorkflow(): Promise<void>;
/**
 * Weekly recap workflow - runs at 10 AM every Monday
 * Cron: At 10:00 AM every Monday
 */
export declare function weeklyRecapWorkflow(): Promise<void>;
/**
 * Monthly recap workflow - runs at 11 AM on the 1st of each month
 * Cron: At 11:00 AM on the 1st day of the month
 */
export declare function monthlyRecapWorkflow(): Promise<void>;
/**
 * Micro recap workflow - checks for micro recap triggers every 5 minutes
 */
export declare function microRecapWorkflow(): Promise<void>;
/**
 * Combined recap workflow that handles all recap types
 * This is the main entry point for the RecapAgent's Temporal workflows
 */
export declare function combinedRecapWorkflow(): Promise<void>;
/**
 * Manual trigger workflow for on-demand recaps
 * @param type - Type of recap to trigger (daily, weekly, monthly)
 * @param date - Optional date for daily recap
 */
export declare function triggerRecapWorkflow(type: RecapType, date?: string): Promise<void>;
//# sourceMappingURL=recap-workflows.d.ts.map