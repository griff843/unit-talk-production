"use strict";
/**
 * Picks API Routes - For E2E testing and Command Center integration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../services/supabaseClient");
const logger_1 = require("../utils/logger");
const index_1 = require("../security/index");
const logger = (0, logger_1.createLogger)('PicksRouter');
const router = express_1.default.Router();
// Authentication middleware for all picks routes
const picksAuth = (req, res, next) => {
    // Allow E2E testing bypass
    if (req.headers['x-e2e-test'] === 'true' && process.env.NODE_ENV !== 'production') {
        logger.info('E2E test bypass enabled for picks route');
        return next();
    }
    // Require authentication in production
    return (0, index_1.authenticateToken)(req, res, next);
};
// Add cache control for E2E testing
router.use((req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
});
/**
 * GET /api/picks/recent - Get recent picks for E2E testing
 * PROTECTED: Requires authentication
 */
router.get('/recent', picksAuth, async (req, res) => {
    const correlationId = `picks-recent-${Date.now()}`;
    try {
        if (!supabaseClient_1.isSupabaseConfigured) {
            return res.status(200).json({ success: true, data: [], metadata: { reason: 'supabase not configured' } });
        }
        const { sport, limit = 10, hours = 24 } = req.query;
        logger.info('Fetching recent picks', {
            correlationId,
            sport,
            limit: Number(limit),
            hours: Number(hours)
        });
        const hoursAgo = new Date(Date.now() - Number(hours) * 60 * 60 * 1000).toISOString();
        let query = supabaseClient_1.supabaseClient
            .from('unified_picks')
            .select(`
        id,
        user_id,
        selection,
        odds,
        confidence,
        workflow_stage,
        created_at,
        sport,
        users!unified_picks_user_id_fkey (username, discord_id, tier, capper_tier)
      `)
            .gte('created_at', hoursAgo)
            .order('created_at', { ascending: false })
            .limit(Number(limit));
        // Filter by sport if specified
        if (sport && typeof sport === 'string') {
            query = query.eq('sport', sport.toLowerCase());
        }
        const { data: picks, error } = await query;
        if (error) {
            throw error;
        }
        const response = {
            success: true,
            data: picks || [],
            metadata: {
                count: picks?.length || 0,
                sport: sport || 'all',
                hours: Number(hours),
                timestamp: new Date().toISOString(),
                correlationId
            }
        };
        logger.info('Recent picks fetched successfully', {
            correlationId,
            count: picks?.length || 0,
            sport: sport || 'all'
        });
        return res.json(response);
    }
    catch (error) {
        logger.error('Failed to fetch recent picks', {
            correlationId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch recent picks',
            details: error instanceof Error ? error.message : 'Unknown error',
            correlationId,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/picks/stats - Get pick statistics for dashboard
 * PROTECTED: Requires authentication
 */
router.get('/stats', picksAuth, async (req, res) => {
    const correlationId = `picks-stats-${Date.now()}`;
    try {
        const { sport, hours = 24 } = req.query;
        logger.info('Fetching pick statistics', {
            correlationId,
            sport,
            hours: Number(hours)
        });
        const hoursAgo = new Date(Date.now() - Number(hours) * 60 * 60 * 1000).toISOString();
        // Get pick counts by status
        let query = supabaseClient_1.supabaseClient
            .from('unified_picks')
            .select('workflow_stage, created_at, sport')
            .gte('created_at', hoursAgo);
        if (sport && typeof sport === 'string') {
            query = query.eq('sport', sport.toLowerCase());
        }
        const { data: picks, error } = await query;
        if (error) {
            throw error;
        }
        // Calculate statistics
        const total = picks?.length || 0;
        const byStage = picks?.reduce((acc, pick) => {
            acc[pick.workflow_stage] = (acc[pick.workflow_stage] || 0) + 1;
            return acc;
        }, {}) || {};
        const stats = {
            total,
            approved: byStage['approved'] || 0,
            pending: byStage['pending_review'] || 0,
            rejected: byStage['rejected'] || 0,
            draft: byStage['draft'] || 0,
            published: byStage['published'] || 0
        };
        const response = {
            success: true,
            data: stats,
            metadata: {
                sport: sport || 'all',
                hours: Number(hours),
                timestamp: new Date().toISOString(),
                correlationId
            }
        };
        logger.info('Pick statistics calculated', {
            correlationId,
            stats,
            sport: sport || 'all'
        });
        return res.json(response);
    }
    catch (error) {
        logger.error('Failed to fetch pick statistics', {
            correlationId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch pick statistics',
            details: error instanceof Error ? error.message : 'Unknown error',
            correlationId,
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
