"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.startServer = startServer;
// Initialize OpenTelemetry FIRST (before any other imports)
const telemetry_1 = require("./tracing/telemetry");
const telemetrySDK = (0, telemetry_1.initializeTelemetry)();
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const health_1 = __importDefault(require("./routes/health"));
const smart_form_1 = require("./routes/smart-form");
const ops_1 = __importDefault(require("./routes/ops"));
const picks_1 = __importDefault(require("./routes/picks"));
const features_1 = __importDefault(require("./routes/features"));
const operator_dashboard_1 = __importDefault(require("./routes/operator-dashboard"));
const settlement_1 = __importDefault(require("./routes/settlement"));
const getEnv_1 = require("./utils/getEnv");
const logger_1 = require("./utils/logger");
const EnhancedSecurityMiddleware_1 = require("./security/EnhancedSecurityMiddleware");
const index_1 = require("./security/index");
const errorSanitizer_1 = require("./security/errorSanitizer");
const gracefulShutdown_1 = require("./utils/gracefulShutdown");
// Observability imports
const metricsServer_1 = require("./services/metricsServer");
const metricsMiddleware_1 = require("./middleware/metricsMiddleware");
const loggingMiddleware_1 = require("./middleware/loggingMiddleware");
const logger = (0, logger_1.createLogger)('API-Server');
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.API_PORT || 3000;
// Initialize Enhanced Security Middleware
const securityMiddleware = new EnhancedSecurityMiddleware_1.EnhancedSecurityMiddleware({
    rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000, // Max requests per window
        maxRequestsPerUser: 100, // Max requests per user per window
        skipSuccessfulRequests: false
    },
    suspiciousActivity: {
        maxFailedAttempts: 5,
        lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
        monitoringWindowMs: 60 * 60 * 1000 // 1 hour
    },
    requestFingerprinting: {
        enabled: true,
        trackHeaders: ['accept', 'accept-language', 'accept-encoding'],
        trackUserAgent: true
    }
}, logger);
// Observability Middleware (MUST BE EARLY)
app.use((0, metricsMiddleware_1.metricsMiddleware)());
app.use((0, loggingMiddleware_1.loggingMiddleware)());
app.use((0, loggingMiddleware_1.securityLoggingMiddleware)());
// Security Middleware (MUST BE FIRST AFTER OBSERVABILITY)
app.use(securityMiddleware.middleware());
// CORS Middleware
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:3001', // Smart form dev server
        'http://localhost:3002',
        'http://localhost:3003',
        process.env.SMART_FORM_URL || 'http://localhost:3001'
    ],
    credentials: true
}));
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Routes with specific rate limiting
app.use('/api/smart-form', (0, index_1.rateLimitMiddleware)(index_1.authLimiter), smart_form_1.smartFormRouter); // Stricter limits for form submissions
app.use('/api/health', health_1.default); // No rate limiting for health checks
app.use('/api/picks', (0, index_1.rateLimitMiddleware)(index_1.generalLimiter), picks_1.default);
app.use('/api/features', (0, index_1.rateLimitMiddleware)(index_1.generalLimiter), features_1.default);
app.use('/ops', (0, index_1.rateLimitMiddleware)(index_1.authLimiter), ops_1.default); // Stricter limits for operations
app.use('/api/operator-dashboard', (0, index_1.rateLimitMiddleware)(index_1.authLimiter), operator_dashboard_1.default); // Stricter limits for operator functions
app.use('/api/settlement', (0, index_1.rateLimitMiddleware)(index_1.authLimiter), settlement_1.default); // Settlement operations require authentication
// Provider health endpoint
app.get('/health/provider', async (req, res) => {
    try {
        const { getProviderHealth } = await Promise.resolve().then(() => __importStar(require('./agents/FeedAgent/activities')));
        const providerHealth = getProviderHealth();
        // Get data freshness from database
        const { supabaseClient } = await Promise.resolve().then(() => __importStar(require('./services/supabaseClient')));
        const { data: latestProp } = await supabaseClient
            .from('raw_props')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1);
        const lastIngestion = latestProp?.[0]?.created_at || null;
        const minutesSinceLastIngestion = lastIngestion
            ? Math.floor((Date.now() - new Date(lastIngestion).getTime()) / 60000)
            : null;
        const dataFreshness = {
            status: minutesSinceLastIngestion === null ? 'critical' :
                minutesSinceLastIngestion < 15 ? 'fresh' :
                    minutesSinceLastIngestion < 60 ? 'stale' : 'critical',
            lastIngestion,
            minutesSinceLastIngestion,
            statusText: minutesSinceLastIngestion === null ? 'No data ingested' :
                minutesSinceLastIngestion < 15 ? `Fresh data (${minutesSinceLastIngestion}m ago)` :
                    minutesSinceLastIngestion < 60 ? `Stale data (${minutesSinceLastIngestion}m ago)` :
                        `Critical - No data for ${minutesSinceLastIngestion}m`
        };
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.json({
            success: true,
            dataFreshness,
            ...providerHealth,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Provider health check failed:', error);
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Admin endpoints
app.post('/admin/reload-secrets', async (req, res) => {
    // Simple auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer admin-')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const { SecretDriftGuard } = await Promise.resolve().then(() => __importStar(require('./agents/FeedAgent/secretDriftGuard')));
        const secretGuard = new SecretDriftGuard();
        const result = await secretGuard.reloadSecrets(req.body);
        return res.json(result);
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to reload secrets',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.post('/admin/invalidate-cache', async (req, res) => {
    // Simple auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer admin-')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json({
        success: true,
        message: 'Cache invalidation is not implemented yet',
        clearedNamespaces: ['raw_props', 'unified_picks'],
        timestamp: new Date().toISOString()
    });
});
// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        service: 'Unit Talk Platform API',
        version: '1.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        endpoints: [
            'GET /api/health',
            'POST /api/smart-form/process',
            'GET /api/smart-form/health',
            'GET /api/picks/recent',
            'GET /api/picks/stats',
            'GET /api/features/query',
            'GET /health/provider',
            'POST /admin/reload-secrets',
            'POST /admin/invalidate-cache',
            'POST /ops/ingest-now',
            'GET /ops/status/:runId',
            'GET /ops/health'
        ]
    });
});
// Error metrics middleware (BEFORE error handler)
app.use((0, metricsMiddleware_1.errorMetricsMiddleware)());
// Global error handler with security sanitization
app.use(errorSanitizer_1.errorSanitizer.middleware());
// 404 handler
app.use('*', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    logger.warn('API 404 - Route not found', {
        correlationId,
        method: req.method,
        path: req.originalUrl,
        userAgent: req.headers['user-agent']
    });
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        correlationId,
        availableEndpoints: [
            'GET /',
            'GET /api/health',
            'POST /api/smart-form/process',
            'GET /api/smart-form/health'
        ]
    });
});
async function startServer() {
    try {
        // Validate environment variables
        // Optionally start Prometheus metrics server
        if (process.env.PROMETHEUS_ENABLED === 'true') {
            const metricsPort = Number(process.env.PROMETHEUS_PORT || 9464);
            try {
                (0, metricsServer_1.startMetricsServer)(metricsPort);
                logger.info('📈 Prometheus metrics server started', { port: metricsPort, path: '/metrics' });
            }
            catch (e) {
                logger.warn('⚠️ Failed to start metrics server', { error: e instanceof Error ? e.message : String(e) });
            }
        }
        (0, getEnv_1.getEnv)();
        logger.info('Environment variables validated successfully');
        // Start server
        const server = app.listen(PORT, () => {
            logger.info(`🚀 Unit Talk Platform API Server started successfully`, {
                port: PORT,
                environment: process.env.NODE_ENV || 'development',
                pid: process.pid,
                nodeVersion: process.version,
                endpoints: [
                    `http://localhost:${PORT}`,
                    `http://localhost:${PORT}/api/health`,
                    `http://localhost:${PORT}/api/smart-form/process`
                ]
            });
        });
        // Initialize graceful shutdown manager
        const shutdownManager = (0, gracefulShutdown_1.initializeGracefulShutdown)({
            gracePeriodMs: 30000,
            forceExitTimeoutMs: 45000,
            enableHealthCheckDuringShutdown: true
        });
        // Register shutdown handlers
        shutdownManager.registerHandlers([
            {
                name: 'http-server',
                priority: 1,
                timeout: 10000,
                handler: async () => {
                    return new Promise((resolve, reject) => {
                        logger.info('🛑 Closing HTTP server...');
                        server.close((err) => {
                            if (err) {
                                logger.error('❌ Error closing HTTP server', err);
                                reject(err);
                            }
                            else {
                                logger.info('✅ HTTP server closed successfully');
                                resolve();
                            }
                        });
                    });
                }
            },
            {
                name: 'security-middleware-cleanup',
                priority: 2,
                timeout: 5000,
                handler: async () => {
                    logger.info('🧹 Cleaning up security middleware...');
                    // Cleanup security middleware resources if needed
                }
            },
            {
                name: 'telemetry-shutdown',
                priority: 9,
                timeout: 5000,
                handler: async () => {
                    logger.info('🔍 Shutting down telemetry...');
                    await (0, telemetry_1.shutdownTelemetry)(telemetrySDK);
                }
            },
            {
                name: 'final-logging',
                priority: 10,
                timeout: 2000,
                handler: async () => {
                    logger.info('📝 Final log flush and cleanup...');
                    // Ensure all logs are flushed
                }
            }
        ]);
        return server;
    }
    catch (error) {
        logger.error('Failed to start API server', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        process.exit(1);
    }
}
// Start server if this file is run directly
if (require.main === module) {
    startServer();
}
