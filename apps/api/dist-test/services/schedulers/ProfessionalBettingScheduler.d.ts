/**
 * Professional Betting Scheduler
 * Manages automated execution of CLV monitoring, feedback loops, and system optimization
 * This is what keeps the system sharp and adaptive to changing markets
 *
 * @module ProfessionalBettingScheduler
 */
export declare class ProfessionalBettingScheduler {
    private static instance;
    private logger;
    private intervals;
    private isRunning;
    private constructor();
    static getInstance(): ProfessionalBettingScheduler;
    /**
     * Start all professional betting automation
     */
    start(): void;
    /**
     * Stop all automation
     */
    stop(): void;
    /**
     * Schedule a recurring task
     */
    private scheduleTask;
    /**
     * Schedule a daily task at specific hour
     */
    private scheduleDailyTask;
    /**
     * Schedule a weekly task
     */
    private scheduleWeeklyTask;
    /**
     * CLV Monitoring - Hourly
     */
    private runCLVMonitoring;
    /**
     * Feedback Loop - Every 6 hours
     */
    private runFeedbackLoop;
    /**
     * Deep Optimization - Daily at 4 AM
     */
    private runDeepOptimization;
    /**
     * Performance Report - Weekly
     */
    private generatePerformanceReport;
    /**
     * Health Check - Every 30 minutes
     */
    private runHealthCheck;
    /**
     * Manual trigger for any task
     */
    triggerTask(taskName: string): Promise<void>;
    /**
     * Get scheduler status
     */
    getStatus(): {
        isRunning: boolean;
        scheduledTasks: string[];
        lastRunTimes: Record<string, Date>;
    };
}
export declare const professionalBettingScheduler: ProfessionalBettingScheduler;
//# sourceMappingURL=ProfessionalBettingScheduler.d.ts.map