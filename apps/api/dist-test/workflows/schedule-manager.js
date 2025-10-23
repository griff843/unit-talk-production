"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyndicateScheduleManager = void 0;
exports.getSyndicateScheduleManager = getSyndicateScheduleManager;
exports.initializeSyndicateScheduling = initializeSyndicateScheduling;
exports.emergencyPauseAll = emergencyPauseAll;
exports.emergencyResumeAll = emergencyResumeAll;
exports.getSystemHealthStatus = getSystemHealthStatus;
const client_1 = require("@temporalio/client");
const getEnv_1 = require("../utils/getEnv");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.makeLogger)('SyndicateScheduler');
const env = (0, getEnv_1.getEnv)();
/**
 * SYNDICATE SCHEDULE MANAGER
 * Manages all Temporal schedules for 2-minute syndicate operations
 */
class SyndicateScheduleManager {
    constructor() {
        this.schedules = new Map();
        this.client = new client_1.Client({
            connection: client_1.Connection.lazy({
                address: env.TEMPORAL_SERVER_URL
            })
        });
    }
    /**
     * Initialize all syndicate schedules
     */
    async initializeSchedules() {
        logger.info('🚀 Initializing syndicate schedules...');
        try {
            // 1. MAIN SYNDICATE SCHEDULER - RUNS CONTINUOUSLY
            await this.createSchedule({
                scheduleId: 'syndicate-main-scheduler',
                workflowType: 'syndicateSchedulerWorkflow',
                args: [{
                        leagues: ['MLB', 'WNBA', 'MLS', 'EPL', 'NBA', 'NFL', 'NHL'],
                        liveGameMode: true,
                        intervalMinutes: 2,
                        enableUSPs: ['steam', 'line_movement', 'hedge', 'middle', 'stale_line', 'injury', 'suspicious'],
                        apiQuotaLimit: 900
                    }],
                spec: {
                    intervals: [{ every: '2m' }] // Start immediately, run every 2 minutes
                },
                policies: {
                    overlap: 'SKIP', // Skip if previous cycle still running
                    catchupWindow: '1m',
                    pauseOnFailure: false
                }
            });
            // 2. LIVE GAME DETECTOR - RUNS EVERY 30 MINUTES
            await this.createSchedule({
                scheduleId: 'live-game-detector',
                workflowType: 'liveGameDetectorWorkflow',
                args: [{}],
                spec: {
                    intervals: [{ every: '30m' }]
                },
                policies: {
                    overlap: 'CANCEL_OTHER',
                    pauseOnFailure: false
                }
            });
            // 3. API QUOTA MONITOR - RUNS EVERY 5 MINUTES
            await this.createSchedule({
                scheduleId: 'api-quota-monitor',
                workflowType: 'apiQuotaMonitorWorkflow',
                args: [{ providers: ['optimal', 'sgo', 'oddsapi'] }],
                spec: {
                    intervals: [{ every: '5m' }]
                },
                policies: {
                    overlap: 'SKIP',
                    pauseOnFailure: false
                }
            });
            // 4. SYSTEM HEALTH MONITOR - RUNS EVERY MINUTE
            await this.createSchedule({
                scheduleId: 'system-health-monitor',
                workflowType: 'systemHealthMonitorWorkflow',
                args: [{}],
                spec: {
                    intervals: [{ every: '1m' }]
                },
                policies: {
                    overlap: 'SKIP',
                    pauseOnFailure: false
                }
            });
            // 5. DAILY CLEANUP - RUNS AT 3 AM DAILY
            await this.createSchedule({
                scheduleId: 'daily-cleanup',
                workflowType: 'dailyCleanupWorkflow',
                args: [{}],
                spec: {
                    calendars: [{
                            comment: 'Daily cleanup at 3 AM',
                            hour: 3,
                            minute: 0
                        }]
                },
                policies: {
                    overlap: 'CANCEL_OTHER',
                    pauseOnFailure: true
                }
            });
            // 6. WEEKLY PERFORMANCE REPORT - RUNS SUNDAY AT 6 AM
            await this.createSchedule({
                scheduleId: 'weekly-performance-report',
                workflowType: 'weeklyPerformanceReportWorkflow',
                args: [{}],
                spec: {
                    calendars: [{
                            comment: 'Weekly performance report on Sunday at 6 AM',
                            dayOfWeek: 'SUNDAY',
                            hour: 6,
                            minute: 0
                        }]
                },
                policies: {
                    overlap: 'CANCEL_OTHER',
                    pauseOnFailure: true
                }
            });
            // 7. LEAGUE-SPECIFIC SCHEDULES FOR PEAK HOURS
            const leagueSchedules = [
                { league: 'MLB', peakHours: '12-23', season: 'APR-OCT' },
                { league: 'WNBA', peakHours: '17-22', season: 'MAY-OCT' },
                { league: 'MLS', peakHours: '14-22', season: 'FEB-NOV' },
                { league: 'EPL', peakHours: '7-17', season: 'AUG-MAY' },
                { league: 'NBA', peakHours: '17-23', season: 'OCT-JUN' },
                { league: 'NFL', peakHours: '13-23', season: 'SEP-FEB' },
                { league: 'NHL', peakHours: '17-23', season: 'OCT-JUN' }
            ];
            for (const leagueConfig of leagueSchedules) {
                await this.createSchedule({
                    scheduleId: `${leagueConfig.league.toLowerCase()}-peak-monitor`,
                    workflowType: 'leaguePeakMonitorWorkflow',
                    args: [{
                            league: leagueConfig.league,
                            peakHours: leagueConfig.peakHours,
                            season: leagueConfig.season
                        }],
                    spec: {
                        intervals: [{ every: '1m' }] // Check every minute during season
                    },
                    policies: {
                        overlap: 'SKIP',
                        pauseOnFailure: false
                    }
                });
            }
            logger.info('✅ All syndicate schedules initialized successfully');
        }
        catch (error) {
            logger.error('❌ Failed to initialize syndicate schedules:', error);
            throw error;
        }
    }
    /**
     * Create or update a Temporal schedule
     */
    async createSchedule(config) {
        try {
            // Check if schedule already exists
            let schedule;
            try {
                schedule = this.client.schedule.getHandle(config.scheduleId);
                await schedule.describe(); // Test if it exists
                // Update existing schedule
                await schedule.update((prev) => ({
                    ...prev,
                    action: {
                        type: 'startWorkflow',
                        workflowType: config.workflowType,
                        args: config.args,
                        taskQueue: env.TEMPORAL_TASK_QUEUE
                    },
                    spec: config.spec,
                    policies: config.policies
                }));
                logger.info(`📅 Updated schedule: ${config.scheduleId}`);
            }
            catch (error) {
                // Schedule doesn't exist, create new one
                schedule = await this.client.schedule.create({
                    scheduleId: config.scheduleId,
                    action: {
                        type: 'startWorkflow',
                        workflowType: config.workflowType,
                        args: config.args,
                        taskQueue: env.TEMPORAL_TASK_QUEUE,
                        workflowExecutionTimeout: '10m',
                        workflowTaskTimeout: '1m'
                    },
                    spec: config.spec,
                    policies: config.policies
                });
                logger.info(`📅 Created schedule: ${config.scheduleId}`);
            }
            this.schedules.set(config.scheduleId, schedule);
        }
        catch (error) {
            logger.error(`❌ Failed to create/update schedule ${config.scheduleId}:`, error);
            throw error;
        }
    }
    /**
     * Pause a schedule (for maintenance or emergencies)
     */
    async pauseSchedule(scheduleId, reason) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }
        await schedule.pause(reason);
        logger.info(`⏸️ Paused schedule: ${scheduleId} - Reason: ${reason}`);
    }
    /**
     * Resume a paused schedule
     */
    async resumeSchedule(scheduleId, reason) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }
        await schedule.unpause(reason);
        logger.info(`▶️ Resumed schedule: ${scheduleId} - Reason: ${reason}`);
    }
    /**
     * Get schedule status and metrics
     */
    async getScheduleStatus(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }
        const description = await schedule.describe();
        return {
            scheduleId,
            state: description.scheduleId,
            spec: description.spec,
            info: description.info,
            recentActions: description.info.recentActions?.slice(0, 10) || []
        };
    }
    /**
     * Emergency stop all schedules
     */
    async emergencyStopAll(reason) {
        logger.warn(`🚨 EMERGENCY STOP ALL SCHEDULES - Reason: ${reason}`);
        const pausePromises = Array.from(this.schedules.keys()).map(scheduleId => this.pauseSchedule(scheduleId, `EMERGENCY: ${reason}`));
        await Promise.allSettled(pausePromises);
        logger.warn('🚨 All schedules paused due to emergency');
    }
    /**
     * Resume all schedules after emergency
     */
    async resumeAllAfterEmergency(reason) {
        logger.info(`🔄 Resuming all schedules after emergency - Reason: ${reason}`);
        const resumePromises = Array.from(this.schedules.keys()).map(scheduleId => this.resumeSchedule(scheduleId, `RECOVERY: ${reason}`));
        await Promise.allSettled(resumePromises);
        logger.info('✅ All schedules resumed after emergency');
    }
    /**
     * Get comprehensive system status
     */
    async getSystemStatus() {
        const statuses = await Promise.all(Array.from(this.schedules.keys()).map(scheduleId => this.getScheduleStatus(scheduleId).catch(error => ({
            scheduleId,
            error: error.message
        }))));
        const healthy = statuses.filter(s => !s.error && s.state?.paused === false).length;
        const paused = statuses.filter(s => !s.error && s.state?.paused === true).length;
        const errored = statuses.filter(s => s.error).length;
        return {
            totalSchedules: this.schedules.size,
            healthy,
            paused,
            errored,
            schedules: statuses,
            timestamp: new Date()
        };
    }
}
exports.SyndicateScheduleManager = SyndicateScheduleManager;
// Singleton instance
let scheduleManager = null;
function getSyndicateScheduleManager() {
    if (!scheduleManager) {
        scheduleManager = new SyndicateScheduleManager();
    }
    return scheduleManager;
}
/**
 * Initialize syndicate scheduling system
 */
async function initializeSyndicateScheduling() {
    const manager = getSyndicateScheduleManager();
    await manager.initializeSchedules();
}
/**
 * Emergency controls for operators
 */
async function emergencyPauseAll(reason) {
    const manager = getSyndicateScheduleManager();
    await manager.emergencyStopAll(reason);
}
async function emergencyResumeAll(reason) {
    const manager = getSyndicateScheduleManager();
    await manager.resumeAllAfterEmergency(reason);
}
async function getSystemHealthStatus() {
    const manager = getSyndicateScheduleManager();
    return await manager.getSystemStatus();
}
//# sourceMappingURL=schedule-manager.js.map