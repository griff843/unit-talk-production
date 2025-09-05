// Initialize OpenTelemetry FIRST (before any other imports)
import { initializeTelemetry, shutdownTelemetry } from './tracing/telemetry';
const telemetrySDK = initializeTelemetry();

import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import healthRouter from './routes/health';
import { smartFormRouter } from './routes/smart-form';
import opsRouter from './routes/ops';
import picksRouter from './routes/picks';
import featuresRouter from './routes/features';
import { ErrorHandler } from './utils/errorHandling';
import { getEnv } from './utils/getEnv';
import { createLogger } from './utils/logger';
import { EnhancedSecurityMiddleware } from './security/EnhancedSecurityMiddleware';
import { rateLimitMiddleware, generalLimiter, authLimiter } from './security/index';
import { errorSanitizer } from './security/errorSanitizer';
import { initializeGracefulShutdown } from './utils/gracefulShutdown';

// Observability imports
import { startMetricsServer } from './services/metricsServer';
import { metricsMiddleware, errorMetricsMiddleware } from './middleware/metricsMiddleware';
import { loggingMiddleware, securityLoggingMiddleware } from './middleware/loggingMiddleware';

const logger = createLogger('API-Server');

const app = express();
const PORT = process.env.API_PORT || 3000;

// Initialize Enhanced Security Middleware
const securityMiddleware = new EnhancedSecurityMiddleware({
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,         // Max requests per window
    maxRequestsPerUser: 100,   // Max requests per user per window
    skipSuccessfulRequests: false
  },
  suspiciousActivity: {
    maxFailedAttempts: 5,
    lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
    monitoringWindowMs: 60 * 60 * 1000  // 1 hour
  },
  requestFingerprinting: {
    enabled: true,
    trackHeaders: ['accept', 'accept-language', 'accept-encoding'],
    trackUserAgent: true
  }
}, logger);

// Observability Middleware (MUST BE EARLY)
app.use(metricsMiddleware());
app.use(loggingMiddleware());
app.use(securityLoggingMiddleware());

// Security Middleware (MUST BE FIRST AFTER OBSERVABILITY)
app.use(securityMiddleware.middleware());

// CORS Middleware
app.use(cors({
  origin: [
    'http://localhost:3001', // Smart form dev server
    'http://localhost:3002',
    'http://localhost:3003',
    process.env.SMART_FORM_URL || 'http://localhost:3001'
  ],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Routes with specific rate limiting
app.use('/api/smart-form', rateLimitMiddleware(authLimiter), smartFormRouter); // Stricter limits for form submissions
app.use('/api/health', healthRouter); // No rate limiting for health checks
app.use('/api/picks', rateLimitMiddleware(generalLimiter), picksRouter);
app.use('/api/features', rateLimitMiddleware(generalLimiter), featuresRouter);
app.use('/ops', rateLimitMiddleware(authLimiter), opsRouter); // Stricter limits for operations

// Provider health endpoint
app.get('/health/provider', async (req, res) => {
  try {
    const { getProviderHealth } = await import('./agents/FeedAgent/activities');
    const providerHealth = getProviderHealth();

    // Get data freshness from database
    const { supabaseClient } = await import('./services/supabaseClient');
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
  } catch (error) {
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
    const { SecretDriftGuard } = await import('./agents/FeedAgent/secretDriftGuard');
    const secretGuard = new (SecretDriftGuard as any)();
    const result = await secretGuard.reloadSecrets(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
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

  res.json({
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