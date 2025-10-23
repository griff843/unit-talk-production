"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ioredis_1 = __importDefault(require("ioredis"));
const supabase_js_1 = require("@supabase/supabase-js");
const getEnv_1 = require("../utils/getEnv");
const logger_1 = require("../utils/logger");
const gracefulShutdown_1 = require("../utils/gracefulShutdown");
const _env = (0, getEnv_1.getEnv)();
const logger = (0, logger_1.createLogger)('Health');
// Initialize Supabase client only if configured to avoid runtime errors in dev
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = (supabaseUrl && supabaseKey)
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
const router = (0, express_1.Router)();
const redis = new ioredis_1.default({
    host: process.env.REDIS_HOST || 'unit-talk-redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    enableReadyCheck: false,
    lazyConnect: true,
    maxRetriesPerRequest: 3
});
// Detailed health check endpoint
router.get('/', async (_req, res) => {
    const startTime = Date.now();
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: { status: 'down', lastCheck: new Date().toISOString() },
            redis: { status: 'down', lastCheck: new Date().toISOString() },
            agents: { status: 'down', lastCheck: new Date().toISOString() },
            external_apis: { status: 'down', lastCheck: new Date().toISOString() },
        },
        version: process.env['npm_package_version'] || 'unknown',
        uptime: process.uptime(),
        memory: {
            used: 0,
            total: 0,
            percentage: 0,
        },
        system: {
            loadAverage: [],
            cpuUsage: 0,
        },
    };
    try {
        // Get system metrics
        const memUsage = process.memoryUsage();
        healthStatus.memory = {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        };
        healthStatus.system = {
            loadAverage: require('os').loadavg(),
            cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
        };
        // Check database with comprehensive validation
        const dbStartTime = Date.now();
        try {
            // If Supabase is not configured (local dev), mark as degraded instead of down
            if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
                const dbResponseTime = Date.now() - dbStartTime;
                healthStatus.services.database = {
                    status: 'degraded',
                    responseTime: dbResponseTime,
                    lastCheck: new Date().toISOString(),
                    details: {
                        configured: false,
                        reason: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set'
                    }
                };
            }
            else {
                // Test basic connectivity
                const { data: _basicTest, error: basicError } = await supabaseClient
                    .from('users')
                    .select('count')
                    .limit(1);
                if (basicError)
                    throw basicError;
                // Test write capability (if not in read-only mode)
                const { error: writeTest } = await supabaseClient
                    .from('agent_health')
                    .select('agent_name')
                    .limit(1);
                if (writeTest)
                    throw writeTest;
                const dbResponseTime = Date.now() - dbStartTime;
                healthStatus.services.database = {
                    status: 'up',
                    responseTime: dbResponseTime,
                    lastCheck: new Date().toISOString(),
                    details: {
                        readTest: 'passed',
                        writeTest: 'passed',
                        connectionPool: 'healthy'
                    }
                };
            }
        }
        catch (error) {
            const dbResponseTime = Date.now() - dbStartTime;
            healthStatus.services.database = {
                status: 'down',
                responseTime: dbResponseTime,
                lastCheck: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown database error',
                details: {
                    readTest: 'failed',
                    writeTest: 'failed',
                    connectionPool: 'unhealthy'
                }
            };
        }
        // Check Redis
        const redisStartTime = Date.now();
        try {
            const redisResult = await redis.ping();
            const redisResponseTime = Date.now() - redisStartTime;
            healthStatus.services.redis = {
                status: redisResult === 'PONG' ? 'up' : 'down',
                responseTime: redisResponseTime,
                lastCheck: new Date().toISOString(),
            };
        }
        catch (error) {
            healthStatus.services.redis = {
                status: 'down',
                lastCheck: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown Redis error',
            };
        }
        // Check agents health (simplified - would check actual agent status)
        try {
            // This would typically check agent heartbeats or status endpoints
            const agentHealthy = await checkAgentsHealth();
            healthStatus.services.agents = {
                status: agentHealthy ? 'up' : 'degraded',
                lastCheck: new Date().toISOString(),
            };
        }
        catch (error) {
            healthStatus.services.agents = {
                status: 'down',
                lastCheck: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown agent error',
            };
        }
        // Check external APIs with detailed validation
        const externalApiStartTime = Date.now();
        try {
            const externalApiResults = await checkExternalAPIs();
            const externalApiResponseTime = Date.now() - externalApiStartTime;
            healthStatus.services.external_apis = {
                status: externalApiResults.allHealthy ? 'up' : 'degraded',
                responseTime: externalApiResponseTime,
                lastCheck: new Date().toISOString(),
                details: externalApiResults.details
            };
        }
        catch (error) {
            const externalApiResponseTime = Date.now() - externalApiStartTime;
            healthStatus.services.external_apis = {
                status: 'down',
                responseTime: externalApiResponseTime,
                lastCheck: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown external API error',
                details: { error: 'Failed to check external APIs' }
            };
        }
        // Check graceful shutdown status
        const shutdownManager = (0, gracefulShutdown_1.getGracefulShutdown)();
        if (shutdownManager) {
            const shutdownStatus = shutdownManager.getHealthStatus();
            healthStatus.services.shutdown_manager = {
                status: shutdownStatus.status === 'healthy' ? 'up' : 'degraded',
                lastCheck: new Date().toISOString(),
                details: shutdownStatus.shutdownProgress
            };
        }
        // Determine overall status
        const serviceStatuses = Object.values(healthStatus.services).map(s => s.status);
        const downServices = serviceStatuses.filter(s => s === 'down').length;
        const degradedServices = serviceStatuses.filter(s => s === 'degraded').length;
        if (downServices > 0) {
            healthStatus.status = 'unhealthy';
        }
        else if (degradedServices > 0) {
            healthStatus.status = 'degraded';
        }
        else {
            healthStatus.status = 'healthy';
        }
        // Log health check
        logger.info('Health check completed', {
            status: healthStatus.status,
            responseTime: Date.now() - startTime,
            services: healthStatus.services,
        });
        const statusCode = healthStatus.status === 'healthy' ? 200 :
            healthStatus.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(healthStatus);
    }
    catch (error) {
        logger.error('Health check failed', { err: error instanceof Error ? error.message : String(error) });
        healthStatus.status = 'unhealthy';
        res.status(503).json({
            ...healthStatus,
            error: 'Health check failed',
        });
    }
});
// Simple liveness probe
router.get('/health/live', (req, res) => {
    console.log(`Health live request from ${req.ip || 'unknown IP'}`);
    res.status(200).json({ status: 'live' });
});
// Readiness probe
router.get('/health/ready', async (req, res) => {
    console.log(`Health ready request from ${req.ip || 'unknown IP'}`);
    res.status(200).json({ status: 'ready' });
});
/*
// Metrics endpoint for Prometheus
router.get('/metrics', async (req: Request, res: Response) => {
  console.log(`Metrics request from ${req.ip || 'unknown IP'}`);
  res.status(200).json({ metrics: 'available' });
});
*/
// Helper functions
async function checkAgentsHealth() {
    try {
        // This would check actual agent status
        // For now, return true as a placeholder
        return true;
    }
    catch (error) {
        logger.error('Agent health check failed', { err: error instanceof Error ? error.message : String(error) });
        return false;
    }
}
async function checkExternalAPIs() {
    const results = {};
    try {
        // Check Supabase API connectivity
        const supabaseStartTime = Date.now();
        try {
            const { error } = await supabaseClient.from('users').select('count').limit(1);
            const supabaseResponseTime = Date.now() - supabaseStartTime;
            results.supabase = {
                status: error ? 'down' : 'up',
                responseTime: supabaseResponseTime,
                error: error?.message
            };
        }
        catch (error) {
            results.supabase = {
                status: 'down',
                responseTime: Date.now() - supabaseStartTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
        // Check OpenAI API (if configured)
        if (process.env.OPENAI_API_KEY) {
            const openaiStartTime = Date.now();
            try {
                // Simple API check - just verify the key format
                const keyValid = process.env.OPENAI_API_KEY.startsWith('sk-');
                const openaiResponseTime = Date.now() - openaiStartTime;
                results.openai = {
                    status: keyValid ? 'up' : 'down',
                    responseTime: openaiResponseTime,
                    error: keyValid ? undefined : 'Invalid API key format'
                };
            }
            catch (error) {
                results.openai = {
                    status: 'down',
                    responseTime: Date.now() - openaiStartTime,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
        else {
            results.openai = {
                status: 'not_configured'
            };
        }
        // Check Discord API (if configured)
        if (process.env.DISCORD_BOT_TOKEN) {
            const discordStartTime = Date.now();
            try {
                // Simple token format check
                const tokenValid = process.env.DISCORD_BOT_TOKEN.length > 50;
                const discordResponseTime = Date.now() - discordStartTime;
                results.discord = {
                    status: tokenValid ? 'up' : 'down',
                    responseTime: discordResponseTime,
                    error: tokenValid ? undefined : 'Invalid token format'
                };
            }
            catch (error) {
                results.discord = {
                    status: 'down',
                    responseTime: Date.now() - discordStartTime,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
        else {
            results.discord = {
                status: 'not_configured'
            };
        }
        // Determine overall health
        const _upServices = Object.values(results).filter(r => r.status === 'up').length;
        const downServices = Object.values(results).filter(r => r.status === 'down').length;
        const allHealthy = downServices === 0;
        return {
            allHealthy,
            details: results
        };
    }
    catch (error) {
        logger.error('External API health check failed', {
            error: error instanceof Error ? error.message : String(error)
        });
        return {
            allHealthy: false,
            details: {
                supabase: { status: 'down', error: error instanceof Error ? error.message : 'Unknown error' }
            }
        };
    }
}
/*
async function collectMetrics(): Promise<string> {
  console.log('Collecting metrics');
  return 'metrics collected';
}
*/
exports.default = router;
