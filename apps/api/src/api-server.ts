// Initialize OpenTelemetry FIRST (before any other imports)
import { initializeTelemetry, shutdownTelemetry } from './tracing/telemetry';
const telemetrySDK = initializeTelemetry();

import 'dotenv/config';
import cors from 'cors';
import express from 'express';

// CRITICAL: Import and validate legacy feature flags BEFORE any agent imports
import {
  validateProductionFlags,
  logSystemConfiguration,
  getFeatureFlag
} from './config/legacyFeatureFlags';

// Validate no legacy modules are enabled (fails fast if STRICT_MODE is on)
try {
  validateProductionFlags();
  logSystemConfiguration();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

import healthRouter from './routes/health';
// import { smartFormRouter } from './routes/smart-form'; // Temporarily disabled for E2E (old ScoringAgent dependency)
import opsRouter from './routes/ops';
import picksRouter from './routes/picks';
import featuresRouter from './routes/features';
import operatorDashboardRouter from './routes/operator-dashboard';

import settlementRouter from './routes/settlement';
import whopWebhookRouter from './routes/webhooks/whop';
import approvalWorkflowRouter from './routes/approval-workflow';

// New enhanced API routes
import ingestionRouter from './routes/ingestion';
import creditUsageRouter from './routes/credit-usage';
import alertsRouter from './routes/alerts';
import cacheRouter from './routes/cache';
// import unifiedPicksRouter from './routes/unified-picks'; // Temporarily disabled for E2E (missing @unit-talk/shared-utils)
import featureFlagsRouter from './routes/feature-flags';
import shadowModeRouter from './routes/shadow-mode';

import { ErrorHandler } from './utils/errorHandling';
import { getEnv } from './utils/getEnv';
import { createLogger } from './utils/logger';
// import { EnhancedSecurityMiddleware } from './security/EnhancedSecurityMiddleware'; // Temporarily disabled for E2E (missing @unit-talk/shared-utils)
import { rateLimitMiddleware, generalLimiter, authLimiter } from './security/index';
import { errorSanitizer } from './security/errorSanitizer';
import { initializeGracefulShutdown } from './utils/gracefulShutdown';

// Observability imports
import { startMetricsServer } from './services/metricsServer';
import { metricsMiddleware, errorMetricsMiddleware } from './middleware/metricsMiddleware';
import { loggingMiddleware, securityLoggingMiddleware } from './middleware/loggingMiddleware';

const logger = createLogger('API-Server');

// Feature gates for optional routes/middleware with missing dependencies
const ENABLE_SMART_FORM = process.env.ENABLE_SMART_FORM === '1';
const ENABLE_SECURITY_MW = process.env.ENABLE_SECURITY_MW === '1';
const ENABLE_UNIFIED_PICKS_ROUTE = process.env.ENABLE_UNIFIED_PICKS_ROUTE === '1';

const app = express();
const PORT = process.env.API_PORT || 3000;

// Initialize Enhanced Security Middleware
// Temporarily disabled for E2E (missing @unit-talk/shared-utils dependency)
// const securityMiddleware = new EnhancedSecurityMiddleware({
//   rateLimiting: {
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     maxRequests: 1000,         // Max requests per window
//     maxRequestsPerUser: 100,   // Max requests per user per window
//     skipSuccessfulRequests: false
//   },
//   suspiciousActivity: {
//     maxFailedAttempts: 5,
//     lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
//     monitoringWindowMs: 60 * 60 * 1000  // 1 hour
//   },
//   requestFingerprinting: {
//     enabled: true,
//     trackHeaders: ['accept', 'accept-language', 'accept-encoding'],
//     trackUserAgent: true
//   }
// }, logger);

// Health routes FIRST - no rate limiting or auth
app.use('/health', healthRouter);
app.use('/api/health', healthRouter);

// Observability Middleware (MUST BE EARLY)
app.use(metricsMiddleware());
app.use(loggingMiddleware());
app.use(securityLoggingMiddleware());

// Security Middleware (MUST BE FIRST AFTER OBSERVABILITY)
if (ENABLE_SECURITY_MW) {
  // app.use(securityMiddleware.middleware()); // Disabled: missing @unit-talk/shared-utils
}

// CORS Middleware
app.use(cors({
  origin: [
    'http://localhost:3001', // Smart form dev server
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004', // Command Center (standardized)
    process.env.SMART_FORM_URL || 'http://localhost:3001'
  ],
  credentials: true
}));

// Body parsing middleware
// Capture rawBody for HMAC verification use-cases (e.g., Whop webhooks)
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    (req as any).rawBody = Buffer.from(buf);
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Routes with specific rate limiting
if (ENABLE_SMART_FORM) {
  // app.use('/api/smart-form', rateLimitMiddleware(authLimiter), smartFormRouter); // Disabled: missing @unit-talk/database
}
app.use('/api/picks', rateLimitMiddleware(generalLimiter), picksRouter);
app.use('/api/features', rateLimitMiddleware(generalLimiter), featuresRouter);
app.use('/ops', rateLimitMiddleware(authLimiter), opsRouter); // Stricter limits for operations
app.use('/api/operator-dashboard', rateLimitMiddleware(authLimiter), operatorDashboardRouter); // Stricter limits for operator functions
app.use('/api/settlement', rateLimitMiddleware(authLimiter), settlementRouter); // Settlement operations require authentication
app.use('/api/approval', rateLimitMiddleware(authLimiter), approvalWorkflowRouter); // Manual approval workflow

// Enhanced API routes with enterprise-grade validation and monitoring
app.use('/api/ingestion', rateLimitMiddleware(authLimiter), ingestionRouter); // Ingestion configuration and monitoring
app.use('/api/ops/credit-usage', rateLimitMiddleware(authLimiter), creditUsageRouter); // Credit usage monitoring
app.use('/api/alerts', rateLimitMiddleware(authLimiter), alertsRouter); // Alert replay and debugging
app.use('/api/cache', rateLimitMiddleware(authLimiter), cacheRouter); // Cache metrics and management
if (ENABLE_UNIFIED_PICKS_ROUTE) {
  // app.use('/api/unified-picks', rateLimitMiddleware(generalLimiter), unifiedPicksRouter); // Disabled: missing @unit-talk/shared-utils
}
app.use('/api/feature-flags', rateLimitMiddleware(authLimiter), featureFlagsRouter); // Feature flag management
app.use('/api/shadow-mode', rateLimitMiddleware(authLimiter), shadowModeRouter); // Shadow mode configuration

// Webhooks (Whop) - behind general limiter, signature verified inside route
app.use('/api/webhooks/whop', rateLimitMiddleware(generalLimiter), whopWebhookRouter);


// Provider health endpoint moved to health router to avoid conflicts

// Admin endpoints
app.post('/admin/reload-secrets', async (req, res) => {
  // Simple auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer admin-')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { SecretDriftGuard } = await import('./agents/FeedAgent/secretDriftGuard');
    const secretGuard = new (SecretDriftGuard as any)();
    const result = await secretGuard.reloadSecrets(req.body);
    return res.json(result);
  } catch (error) {
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
      'GET /ops/health',
      // Enhanced API endpoints
      'GET /api/ingestion/watchlist',
      'POST /api/ingestion/watchlist',
      'GET /api/settlement/runs',
      'POST /api/settlement/run',
      'GET /api/ops/credit-usage',
      'POST /api/alerts/replay',
      'GET /api/cache/metrics',
      'POST /api/cache/invalidate',
      'GET /api/unified-picks',
      'POST /api/unified-picks',
      'GET /api/feature-flags',
      'POST /api/feature-flags',
      'GET /api/shadow-mode/config',
      'POST /api/shadow-mode/config'
    ]
  });
});

// Error metrics middleware (BEFORE error handler)
app.use(errorMetricsMiddleware());

// Global error handler with security sanitization
app.use(errorSanitizer.middleware());

// 404 handler
app.use('*', (req, res) => {
  const correlationId = (req as any).correlationId || 'unknown';

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
      'GET /api/smart-form/health',
      'GET /api/unified-picks',
      'POST /api/unified-picks',
      'GET /api/cache/metrics',
      'GET /api/feature-flags'
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
        startMetricsServer(metricsPort);
        logger.info('📈 Prometheus metrics server started', { port: metricsPort, path: '/metrics' });
      } catch (e) {
        logger.warn('⚠️ Failed to start metrics server', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    getEnv();
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
    const shutdownManager = initializeGracefulShutdown({
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
          return new Promise<void>((resolve, reject) => {
            logger.info('🛑 Closing HTTP server...');
            server.close((err) => {
              if (err) {
                logger.error('❌ Error closing HTTP server', err);
                reject(err);
              } else {
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
          await shutdownTelemetry(telemetrySDK);
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

  } catch (error) {
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

export { app, startServer };