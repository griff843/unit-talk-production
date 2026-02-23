/* eslint-disable complexity, no-console, no-unused-vars */
// Pre-existing ESLint complexity issues - documented for SPRINT-058A
import 'dotenv/config';
import cors from 'cors';
import express, { Express } from 'express';

import { validateDbMode } from './config/dbMode';
import healthRouter from './routes/health';
import opsRouter from './routes/ops';
import opsDiscordRoutingRouter from './routes/ops-discord-routing';
import opsStatusRouter from './routes/ops-status';
import picksRouter from './routes/picks';
import { smartFormRouter } from './routes/smart-form';
import versionRouter from './routes/version';
import { agentHealthHeartbeat } from './services/agentHealthHeartbeat';
import { ErrorHandler } from './utils/errorHandling';
import { getEnv } from './utils/getEnv';
import { createLogger } from './utils/logger';

const logger = createLogger('API-Server');

const app: Express = express();

// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function getApiPort(): number {
  return parseInt(process.env.API_PORT || '3000', 10);
}
function getSmartFormUrl(): string {
  return process.env.SMART_FORM_URL || 'http://localhost:3001';
}

// Middleware
app.use(
  cors({
    origin: [
      'http://localhost:3001', // Smart form dev server
      'http://localhost:3002',
      'http://localhost:3003',
      getSmartFormUrl(),
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const correlationId = `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add correlation ID to request
  (req as any).correlationId = correlationId;

  logger.info('API Request received', {
    correlationId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    origin: req.headers.origin,
  });

  // Response logging
  const originalSend = res.send;
  res.send = function (data) {
    const processingTime = Date.now() - startTime;
    logger.info('API Response sent', {
      correlationId,
      statusCode: res.statusCode,
      processingTimeMs: processingTime,
      responseSize: typeof data === 'string' ? data.length : JSON.stringify(data).length,
    });
    return originalSend.call(this, data);
  };

  next();
});

// Routes
app.use('/api/smart-form', smartFormRouter);
app.use('/api/health', healthRouter);
app.use('/api/picks', picksRouter);
// SPRINT-094A: Status endpoint first (no auth required for monitoring)
app.use('/ops', opsStatusRouter);
// SPRINT-093: Discord routing status
app.use('/ops', opsDiscordRoutingRouter);
// Admin ops routes (auth required)
app.use('/ops', opsRouter);
app.use('/version', versionRouter);
app.use('/api/version', versionRouter);

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
      status:
        minutesSinceLastIngestion === null
          ? 'critical'
          : minutesSinceLastIngestion < 15
            ? 'fresh'
            : minutesSinceLastIngestion < 60
              ? 'stale'
              : 'critical',
      lastIngestion,
      minutesSinceLastIngestion,
      statusText:
        minutesSinceLastIngestion === null
          ? 'No data ingested'
          : minutesSinceLastIngestion < 15
            ? `Fresh data (${minutesSinceLastIngestion}m ago)`
            : minutesSinceLastIngestion < 60
              ? `Stale data (${minutesSinceLastIngestion}m ago)`
              : `Critical - No data for ${minutesSinceLastIngestion}m`,
    };

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      success: true,
      dataFreshness,
      ...providerHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Provider health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
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
      message: error instanceof Error ? error.message : 'Unknown error',
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
    timestamp: new Date().toISOString(),
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
      'GET /api/version',
      'GET /version',
      'POST /api/smart-form/process',
      'GET /api/smart-form/health',
      'GET /api/picks/recent',
      'GET /api/picks/stats',
      'GET /health/provider',
      'POST /admin/reload-secrets',
      'POST /admin/invalidate-cache',
      'POST /ops/ingest-now',
      'GET /ops/status/:runId',
      'GET /ops/health',
      'POST /ops/settle',
      'GET /ops/unsettled',
      'POST /ops/recap',
    ],
  });
});

// Global error handler
app.use(
  async (error: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const correlationId = (req as any).correlationId || 'unknown';

    logger.error('API Error occurred', {
      correlationId,
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path,
      body: req.body,
    });

    // Use centralized error handler
    const handler = new ErrorHandler('api-server');
    await handler.handleError(error as Error, {
      correlationId,
      method: req.method,
      path: req.path,
    });

    res.status(error.status || 500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
);

// 404 handler
app.use('*', (req, res) => {
  const correlationId = (req as any).correlationId || 'unknown';

  logger.warn('API 404 - Route not found', {
    correlationId,
    method: req.method,
    path: req.originalUrl,
    userAgent: req.headers['user-agent'],
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
    ],
  });
});

async function startServer() {
  try {
    // SPRINT-DB-MODE-TRUTH-LOCK-095A: Validate DB mode first (fail-closed)
    const dbModeResolution = validateDbMode();
    logger.info('DB mode validated', {
      mode: dbModeResolution.mode,
      host: dbModeResolution.host,
      isLocal: dbModeResolution.isLocal,
    });

    // Validate environment variables
    getEnv();
    logger.info('Environment variables validated successfully');

    // Start server
    const server = app.listen(getApiPort(), async () => {
      logger.info(`🚀 Unit Talk Platform API Server started successfully`, {
        port: getApiPort(),
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
        nodeVersion: process.version,
        endpoints: [
          `http://localhost:${getApiPort()}`,
          `http://localhost:${getApiPort()}/api/health`,
          `http://localhost:${getApiPort()}/api/smart-form/process`,
        ],
      });

      // Start API server heartbeat
      await agentHealthHeartbeat.startHeartbeat({ agentName: 'api-server' });
      logger.info('API server heartbeat started');
    });

    // Graceful shutdown handling
    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down API server gracefully...`);
      agentHealthHeartbeat.stopAll();
      server.close(err => {
        if (err) {
          logger.error('Error during server shutdown', { error: err.message });
          process.exit(1);
        }
        logger.info('API server shut down gracefully');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    return server;
  } catch (error) {
    logger.error('Failed to start API server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

export { app, startServer };
