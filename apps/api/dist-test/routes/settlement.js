"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@temporalio/client");
const SettlementAgent_1 = require("../workflows/agents/SettlementAgent");
const SettlementAgent_2 = require("../workflows/agents/SettlementAgent");
const logger_1 = require("../utils/logger");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../utils/supabase");
const router = (0, express_1.Router)();
const logger = (0, logger_1.createLogger)('SettlementAPI');
// Initialize Temporal client
let temporalClient;
async function getTemporalClient() {
    if (!temporalClient) {
        const connection = await client_1.Connection.connect({
            address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
        });
        temporalClient = new client_1.Client({
            connection,
            namespace: process.env.TEMPORAL_NAMESPACE || 'default'
        });
    }
    return temporalClient;
}
// Initialize local agent for status queries
const agent = new SettlementAgent_2.SettlementAgent();
/**
 * POST /api/settlement/backfill
 * Start a backfill job for unsettled picks
 */
router.post('/backfill', auth_1.requireAuth, async (req, res) => {
    try {
        const { league, dateFrom, dateTo, batchSize = 100, dryRun = false, rateLimit = 4 } = req.body;
        logger.info('Starting settlement backfill', {
            league,
            dateFrom,
            dateTo,
            batchSize,
            dryRun
        });
        // Validate inputs
        if (dateFrom && !isValidDate(dateFrom)) {
            return res.status(400).json({
                error: 'Invalid dateFrom format. Use YYYY-MM-DD'
            });
        }
        if (dateTo && !isValidDate(dateTo)) {
            return res.status(400).json({
                error: 'Invalid dateTo format. Use YYYY-MM-DD'
            });
        }
        // Check runtime config for freeze/shadow mode
        const runtimeConfig = await getRuntimeConfig();
        const freeze_mode = runtimeConfig?.freeze_mode || false;
        const shadow_mode = runtimeConfig?.shadow_mode || false;
        if (freeze_mode && !dryRun) {
            logger.warn('System is in freeze mode - forcing dry run');
        }
        // Start Temporal workflow
        const client = await getTemporalClient();
        const handle = await client.workflow.start(SettlementAgent_1.settlementBackfillWorkflow, {
            workflowId: `settlement-backfill-${Date.now()}`,
            taskQueue: 'settlement-queue',
            args: [{
                    league,
                    dateFrom,
                    dateTo,
                    batchSize,
                    dryRun: dryRun || freeze_mode,
                    rateLimit,
                    shadow_mode,
                    freeze_mode
                }]
        });
        res.json({
            jobId: handle.workflowId,
            status: 'started',
            options: {
                league,
                dateFrom,
                dateTo,
                batchSize,
                dryRun: dryRun || freeze_mode,
                shadow_mode,
                freeze_mode
            }
        });
    }
    catch (error) {
        logger.error('Failed to start backfill', { error });
        res.status(500).json({
            error: 'Failed to start settlement backfill',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
/**
 * POST /api/settlement/run
 * Settle specific picks by ID
 */
router.post('/run', auth_1.requireAuth, async (req, res) => {
    try {
        const { ids, dryRun = false, force = false } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                error: 'ids array is required and must not be empty'
            });
        }
        logger.info('Starting settlement for specific IDs', {
            count: ids.length,
            dryRun,
            force
        });
        // Check runtime config
        const runtimeConfig = await getRuntimeConfig();
        const freeze_mode = runtimeConfig?.freeze_mode || false;
        const shadow_mode = runtimeConfig?.shadow_mode || false;
        // Start Temporal workflow
        const client = await getTemporalClient();
        const handle = await client.workflow.start(SettlementAgent_1.settlementIdsWorkflow, {
            workflowId: `settlement-ids-${Date.now()}`,
            taskQueue: 'settlement-queue',
            args: [{
                    ids,
                    dryRun: dryRun || freeze_mode,
                    force,
                    shadow_mode,
                    freeze_mode
                }]
        });
        res.json({
            jobId: handle.workflowId,
            status: 'started',
            pickCount: ids.length
        });
    }
    catch (error) {
        logger.error('Failed to start ID settlement', { error });
        res.status(500).json({
            error: 'Failed to start settlement',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
/**
 * GET /api/settlement/status
 * Get status of a settlement job
 */
router.get('/status', auth_1.requireAuth, async (req, res) => {
    try {
        const { jobId } = req.query;
        if (!jobId || typeof jobId !== 'string') {
            return res.status(400).json({
                error: 'jobId query parameter is required'
            });
        }
        // Try to get status from local agent first
        const localStatus = agent.getJobStatus(jobId);
        if (localStatus) {
            return res.json(localStatus);
        }
        // Fallback to Temporal workflow status
        const client = await getTemporalClient();
        const handle = client.workflow.getHandle(jobId);
        const description = await handle.describe();
        res.json({
            jobId,
            status: description.status.name,
            startTime: description.startTime,
            closeTime: description.closeTime,
            // Note: Actual progress would need to be stored in a shared database
            progress: {
                scanned: 0,
                settled: 0,
                skipped: 0,
                errors: 0,
                failed: []
            }
        });
    }
    catch (error) {
        logger.error('Failed to get job status', { error });
        res.status(500).json({
            error: 'Failed to get job status',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
/**
 * GET /api/settlement/stats
 * Get settlement statistics
 */
router.get('/stats', auth_1.requireAuth, async (req, res) => {
    try {
        const { dateFrom, dateTo } = req.query;
        // Initialize agent and get stats
        await agent.initialize();
        const store = agent.store; // Access private store
        const stats = await store.getSettlementStats(dateFrom, dateTo);
        res.json(stats);
    }
    catch (error) {
        logger.error('Failed to get settlement stats', { error });
        res.status(500).json({
            error: 'Failed to get settlement statistics',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
/**
 * GET /api/settlement/unsettled
 * Get list of unsettled picks
 */
router.get('/unsettled', auth_1.requireAuth, async (req, res) => {
    try {
        const { league, dateFrom, dateTo, limit = 100 } = req.query;
        await agent.initialize();
        const store = agent.store;
        const picks = await store.getUnsettledPicks({
            league: league,
            dateFrom: dateFrom,
            dateTo: dateTo,
            limit: Number(limit)
        });
        res.json({
            count: picks.length,
            picks
        });
    }
    catch (error) {
        logger.error('Failed to get unsettled picks', { error });
        res.status(500).json({
            error: 'Failed to get unsettled picks',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
/**
 * POST /api/settlement/void
 * Void specific picks
 */
router.post('/void', auth_1.requireAuth, async (req, res) => {
    try {
        const { ids, reason } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                error: 'ids array is required and must not be empty'
            });
        }
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({
                error: 'reason is required'
            });
        }
        logger.info('Voiding picks', { count: ids.length, reason });
        await agent.initialize();
        const store = agent.store;
        const success = await store.voidPicks(ids, reason);
        if (success) {
            res.json({
                success: true,
                voided: ids.length,
                reason
            });
        }
        else {
            res.status(500).json({
                error: 'Failed to void picks'
            });
        }
    }
    catch (error) {
        logger.error('Failed to void picks', { error });
        res.status(500).json({
            error: 'Failed to void picks',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
// Helper functions
function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString))
        return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
}
async function getRuntimeConfig() {
    // This would fetch from your runtime_config table
    // For now, return default config
    return {
        freeze_mode: false,
        shadow_mode: false
    };
}
// New endpoints for Command Center integration
const LEAGUES = ['MLB', 'NFL', 'NBA', 'NCAAF', 'NCAAB', 'WNBA'];
/**
 * GET /api/settlement/summary
 * Returns unsettled counts globally and by league
 */
router.get('/summary', auth_1.requireAuth, async (_req, res) => {
    try {
        const supabase = (0, supabase_1.createSupabaseClient)();
        // Total unsettled
        const { count: totalUnsettled, error: totalErr } = await supabase
            .from('unified_picks')
            .select('*', { count: 'exact', head: true })
            .is('settled_at', null);
        if (totalErr) {
            throw totalErr;
        }
        // Per-league unsettled counts
        const byLeague = {};
        await Promise.all(LEAGUES.map(async (lg) => {
            const { count, error } = await supabase
                .from('unified_picks')
                .select('*', { count: 'exact', head: true })
                .is('settled_at', null)
                .eq('sport', lg);
            if (error) {
                logger.warn('Failed to fetch per-league unsettled count', { league: lg, error });
                byLeague[lg] = 0;
            }
            else {
                byLeague[lg] = count || 0;
            }
        }));
        res.json({ totalUnsettled: totalUnsettled || 0, byLeague });
    }
    catch (error) {
        logger.error('Failed to get settlement summary', { error });
        res.status(500).json({ error: 'Failed to get settlement summary' });
    }
});
/**
 * GET /api/settlement/jobs
 * Returns last 5 settlement jobs
 */
router.get('/jobs', auth_1.requireAuth, async (_req, res) => {
    try {
        const supabase = (0, supabase_1.createSupabaseClient)();
        const { data, error } = await supabase
            .from('settlement_jobs')
            .select('job_id, job_type, status, started_at, completed_at, options, progress, error_message')
            .order('started_at', { ascending: false })
            .limit(5);
        if (error) {
            throw error;
        }
        res.json({ jobs: data || [] });
    }
    catch (error) {
        logger.error('Failed to get settlement jobs', { error });
        res.status(500).json({ error: 'Failed to get settlement jobs' });
    }
});
/**
 * POST /api/settlement/start
 * Triggers a backfill job
 */
router.post('/start', auth_1.requireAuth, async (req, res) => {
    try {
        const { league, dateFrom, dateTo, dryRun = false, force = false, batch = 100, rate = 4, } = req.body || {};
        if (dateFrom && !isValidDate(dateFrom)) {
            return res.status(400).json({ error: 'Invalid dateFrom format. Use YYYY-MM-DD' });
        }
        if (dateTo && !isValidDate(dateTo)) {
            return res.status(400).json({ error: 'Invalid dateTo format. Use YYYY-MM-DD' });
        }
        const runtimeConfig = await getRuntimeConfig();
        const freeze_mode = runtimeConfig?.freeze_mode || false;
        const shadow_mode = runtimeConfig?.shadow_mode || false;
        const client = await getTemporalClient();
        const handle = await client.workflow.start(SettlementAgent_1.settlementBackfillWorkflow, {
            workflowId: `settlement-backfill-${Date.now()}`,
            taskQueue: 'settlement-queue',
            args: [
                {
                    league,
                    dateFrom,
                    dateTo,
                    batchSize: batch,
                    dryRun: dryRun || freeze_mode,
                    rateLimit: rate,
                    force,
                    shadow_mode,
                    freeze_mode,
                },
            ],
        });
        // Insert job tracking row
        try {
            const supabase = (0, supabase_1.createSupabaseClient)();
            await supabase.from('settlement_jobs').upsert({
                job_id: handle.workflowId,
                job_type: 'backfill',
                status: 'running',
                options: {
                    league,
                    dateFrom,
                    dateTo,
                    dryRun: dryRun || freeze_mode,
                    force,
                    batch,
                    rate,
                },
                started_at: new Date().toISOString(),
            }, { onConflict: 'job_id' });
        }
        catch (dbErr) {
            logger.warn('Failed to insert settlement_jobs row', { error: dbErr });
        }
        res.json({
            jobId: handle.workflowId,
            status: 'started',
        });
    }
    catch (error) {
        logger.error('Failed to start settlement job', { error });
        res.status(500).json({ error: 'Failed to start settlement job' });
    }
});
/**
 * POST /api/settlement/cancel
 * Cancel a running job
 */
router.post('/cancel', auth_1.requireAuth, async (req, res) => {
    try {
        const { jobId } = req.body || {};
        if (!jobId || typeof jobId !== 'string') {
            return res.status(400).json({ error: 'jobId is required' });
        }
        const client = await getTemporalClient();
        const handle = client.workflow.getHandle(jobId);
        try {
            await handle.terminate('Cancelled via API');
        }
        catch (e) {
            logger.warn('Terminate failed, attempting cancel', { error: e });
            try {
                await handle.cancel();
            }
            catch { }
        }
        // Update job status
        try {
            const supabase = (0, supabase_1.createSupabaseClient)();
            await supabase
                .from('settlement_jobs')
                .update({ status: 'cancelled', completed_at: new Date().toISOString() })
                .eq('job_id', jobId);
        }
        catch (dbErr) {
            logger.warn('Failed to update settlement_jobs on cancel', { error: dbErr });
        }
        res.json({ jobId, status: 'cancelled' });
    }
    catch (error) {
        logger.error('Failed to cancel settlement job', { error });
        res.status(500).json({ error: 'Failed to cancel settlement job' });
    }
});
exports.default = router;
