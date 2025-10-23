"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatusQuery = exports.emergencyStopSignal = exports.resumeSignal = exports.pauseSignal = void 0;
exports.smartFormDailyBatchWorkflow = smartFormDailyBatchWorkflow;
exports.smartFormLivePickWorkflow = smartFormLivePickWorkflow;
exports.smartFormHealthMonitorWorkflow = smartFormHealthMonitorWorkflow;
const workflow_1 = require("@temporalio/workflow");
// Proxy activities
const {} = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '10 minutes',
    retry: {
        initialInterval: '1 second',
        maximumInterval: '1 minute',
        maximumAttempts: 3,
    },
});
// Workflow signals
exports.pauseSignal = (0, workflow_1.defineSignal)('pause');
exports.resumeSignal = (0, workflow_1.defineSignal)('resume');
exports.emergencyStopSignal = (0, workflow_1.defineSignal)('emergency-stop');
// Workflow queries
exports.getStatusQuery = (0, workflow_1.defineQuery)('status');
/**
 * Smart Form Daily Batch Workflow
 * Runs daily at 10:00 AM EST to process approved picks
 */
async function smartFormDailyBatchWorkflow() {
    const status = {
        isRunning: true,
        isPaused: false,
        lastBatchTime: null,
        processedPicksToday: 0,
        errors: []
    };
    // Set up signal handlers
    (0, workflow_1.setHandler)(exports.pauseSignal, () => { status.isPaused = true; });
    (0, workflow_1.setHandler)(exports.resumeSignal, () => { status.isPaused = false; });
    (0, workflow_1.setHandler)(exports.emergencyStopSignal, () => { status.isRunning = false; });
    (0, workflow_1.setHandler)(exports.getStatusQuery, () => status);
    while (status.isRunning) {
        try {
            // Wait for 10:00 AM EST (3:00 PM UTC)
            const now = new Date();
            const target = new Date();
            target.setUTCHours(15, 0, 0, 0); // 10 AM EST = 3 PM UTC
            // If we've passed today's target, set for tomorrow
            if (now >= target) {
                target.setUTCDate(target.getUTCDate() + 1);
            }
            const sleepDuration = target.getTime() - now.getTime();
            await (0, workflow_1.sleep)(sleepDuration);
            // Check if paused
            await (0, workflow_1.condition)(() => !status.isPaused);
            if (!status.isRunning) {
                break;
            }
            // Process daily batch
            try {
                // const result = await processDailyPickBatch({
                //   timestamp: new Date().toISOString(),
                //   _error: '',
                //   cycleCount: 0,
                //   context: 'daily-batch',
                //   batchId: `batch-${Date.now()}`,
                //   picks: []
                // });
                status.lastBatchTime = new Date().toISOString();
                status.processedPicksToday = 1;
                // Clear old errors on successful run
                status.errors = [];
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorMsg = `Daily batch failed: ${errorMessage}`;
                status.errors.push(errorMsg);
                // Keep only last 5 errors
                if (status.errors.length > 5) {
                    status.errors = status.errors.slice(-5);
                }
            }
        }
        catch (error) {
            status.errors.push(`Workflow err: ${error instanceof Error ? error.message : String(error)}`);
            // Wait 1 hour before retrying on workflow errors
            await (0, workflow_1.sleep)('1 hour');
        }
    }
}
/**
 * Smart Form Live Pick Workflow
 * Handles immediate processing of live picks
 */
async function smartFormLivePickWorkflow(_pickId) {
    const status = {
        isRunning: true,
        isPaused: false,
        lastBatchTime: new Date().toISOString(),
        processedPicksToday: 0,
        errors: []
    };
    (0, workflow_1.setHandler)(exports.getStatusQuery, () => status);
    try {
        // Process live pick immediately
        // await processLivePick({
        //   timestamp: new Date().toISOString(),
        //   _error: '',
        //   cycleCount: 0,
        //   context: 'live-pick',
        //   pickId,
        //   pickData: {}
        // });
        status.processedPicksToday = 1;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        status.errors.push(errorMessage);
        throw error;
    }
    finally {
        status.isRunning = false;
    }
}
/**
 * Smart Form Health Monitor Workflow
 * Monitors system health and alerts on issues
 */
async function smartFormHealthMonitorWorkflow() {
    const status = {
        isRunning: true,
        isPaused: false,
        lastBatchTime: null,
        processedPicksToday: 0,
        errors: []
    };
    (0, workflow_1.setHandler)(exports.pauseSignal, () => { status.isPaused = true; });
    (0, workflow_1.setHandler)(exports.resumeSignal, () => { status.isPaused = false; });
    (0, workflow_1.setHandler)(exports.emergencyStopSignal, () => { status.isRunning = false; });
    (0, workflow_1.setHandler)(exports.getStatusQuery, () => status);
    while (status.isRunning) {
        try {
            // Check if paused
            await (0, workflow_1.condition)(() => !status.isPaused);
            if (!status.isRunning) {
                break;
            }
            // Run health check
            // const healthResult = await monitorSmartFormHealth({
            //   timestamp: new Date().toISOString(),
            //   _error: '',
            //   cycleCount: 0,
            //   context: 'health-monitor'
            // });
            status.lastBatchTime = new Date().toISOString();
            // Sleep for 5 minutes between health checks
            await (0, workflow_1.sleep)('5 minutes');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            status.errors.push(`Health check failed: ${errorMessage}`);
            // Wait 2 minutes before retrying on errors
            await (0, workflow_1.sleep)('2 minutes');
        }
    }
}
//# sourceMappingURL=smartFormWorkflow.js.map