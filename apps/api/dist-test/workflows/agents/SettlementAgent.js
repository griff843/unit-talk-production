"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementAgent = void 0;
exports.settlementBackfillWorkflow = settlementBackfillWorkflow;
exports.settlementIdsWorkflow = settlementIdsWorkflow;
const workflow_1 = require("@temporalio/workflow");
// Configure activity proxy with proper timeouts
const { fetchUnsetlledPicks, fetchPickById, settlePick, rateLimitDelay } = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '5 minutes',
    heartbeatTimeout: '30 seconds',
    retryPolicy: {
        maximumAttempts: 3,
        initialInterval: '1 second',
        backoffCoefficient: 2.0,
        maximumInterval: '30 seconds',
    },
});
// Removed SettlementAgent class - replaced with activity-based workflows
// Temporal workflow exports
async function settlementBackfillWorkflow(options) {
    const workflowId = (0, workflow_1.workflowInfo)().workflowId;
    const jobId = `backfill-${Date.now()}`;
    workflow_1.log.info('Starting settlement backfill workflow', { jobId, options });
    const progress = {
        scanned: 0,
        settled: 0,
        skipped: 0,
        errors: 0,
        failed: []
    };
    try {
        // Check runtime config flags
        if (options.freeze_mode) {
            workflow_1.log.warn('Freeze mode enabled - no writes will be performed');
        }
        if (options.shadow_mode || options.dryRun) {
            workflow_1.log.info('Shadow/dry run mode - simulating without writes');
        }
        // Process in batches
        const batchSize = options.batchSize || 100;
        let hasMore = true;
        while (hasMore) {
            // Fetch batch of unsettled picks
            const picks = await fetchUnsetlledPicks({
                ...options,
                batchSize
            });
            if (!picks || picks.length === 0) {
                hasMore = false;
                break;
            }
            workflow_1.log.info('Processing batch of picks', { count: picks.length, progress });
            // Process each pick in the batch
            for (const pick of picks) {
                progress.scanned++;
                try {
                    const result = await settlePick(pick, options);
                    if (result.success) {
                        progress.settled++;
                        workflow_1.log.debug('Pick settled successfully', {
                            pickId: pick.id,
                            outcome: result.outcome,
                            actualStat: result.actualStat
                        });
                    }
                    else {
                        progress.skipped++;
                        workflow_1.log.warn('Pick settlement skipped', {
                            pickId: pick.id,
                            reason: result.error
                        });
                    }
                }
                catch (error) {
                    progress.errors++;
                    progress.failed.push(pick.id);
                    workflow_1.log.error('Failed to settle pick', {
                        pickId: pick.id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
                // Rate limiting
                if (options.rateLimit) {
                    await rateLimitDelay(options.rateLimit);
                }
            }
            // Continue if we got a full batch (indicating more data)
            hasMore = picks.length === batchSize;
        }
        workflow_1.log.info('Settlement backfill completed', { jobId, progress });
        return jobId;
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        workflow_1.log.error('Settlement backfill failed', { jobId, error: errorMsg, progress });
        throw error;
    }
}
async function settlementIdsWorkflow(options) {
    const workflowId = (0, workflow_1.workflowInfo)().workflowId;
    const jobId = `ids-${Date.now()}`;
    workflow_1.log.info('Starting settlement IDs workflow', { jobId, options });
    const progress = {
        scanned: 0,
        settled: 0,
        skipped: 0,
        errors: 0,
        failed: []
    };
    try {
        const { ids } = options;
        for (const id of ids) {
            progress.scanned++;
            // Fetch the specific pick
            const pick = await fetchPickById(id);
            if (!pick) {
                progress.errors++;
                progress.failed.push(id);
                workflow_1.log.error('Pick not found', { id });
                continue;
            }
            try {
                const result = await settlePick(pick, options);
                if (result.success) {
                    progress.settled++;
                    workflow_1.log.info('Pick settled successfully', {
                        pickId: pick.id,
                        outcome: result.outcome,
                        actualStat: result.actualStat
                    });
                }
                else {
                    progress.skipped++;
                    workflow_1.log.warn('Pick settlement skipped', {
                        pickId: pick.id,
                        reason: result.error
                    });
                }
            }
            catch (error) {
                progress.errors++;
                progress.failed.push(id);
                workflow_1.log.error('Failed to settle pick', {
                    pickId: id,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            // Rate limiting
            if (options.rateLimit) {
                await rateLimitDelay(options.rateLimit);
            }
        }
        workflow_1.log.info('Settlement IDs workflow completed', { jobId, progress });
        return jobId;
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        workflow_1.log.error('Settlement IDs workflow failed', { jobId, error: errorMsg, progress });
        throw error;
    }
}
// SettlementAgent class for API usage
class SettlementAgent {
    constructor() {
        this.store = new Map();
        // Initialize empty
    }
    async initialize() {
        // Initialize any required resources
    }
    getJobStatus(jobId) {
        return this.store.get(jobId);
    }
}
exports.SettlementAgent = SettlementAgent;
