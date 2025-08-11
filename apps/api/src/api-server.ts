import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import healthRouter from './routes/health';
import { smartFormRouter } from './routes/smart-form';
import { ErrorHandler } from './utils/errorHandling';
import { getEnv } from './utils/getEnv';
import { createLogger } from './utils/logger';

const logger = createLogger('API-Server');

const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3001', // Smart form dev server
    'http://localhost:3002', 
    'http://localhost:3003',
    process.env.SMART_FORM_URL || 'http://localhost:3001'
  ],
  credentials: true
}));

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
    origin: req.headers.origin
  });

  // Response logging
  const originalSend = res.send;
  res.send = function(data) {
    const processingTime = Date.now() - startTime;
    logger.info('API Response sent', {
      correlationId,
      statusCode: res.statusCode,
      processingTimeMs: processingTime,
      responseSize: typeof data === 'string' ? data.length : JSON.stringify(data).length
    });
    return originalSend.call(this, data);
  };

  next();
});

// Routes
app.use('/api/smart-form', smartFormRouter);
app.use('/api/health', healthRouter);

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
      'GET /api/smart-form/health'
    ]
  });
});

// Global error handler
app.use(async (error: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const correlationId = (req as any).correlationId || 'unknown';
  
  logger.error('API Error occurred', {
    correlationId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    body: req.body
  });

  // Use centralized error handler
  const handler = new ErrorHandler('api-server');
  await handler.handleError(error as Error, {
    correlationId,
    method: req.method,
    path: req.path
  });

  res.status(error.status || 500).json({
    success: false,
    error: 'Internal server error',
    message: error.message || 'An unexpected error occurred',
    correlationId,
    timestamp: new Date().toISOString()
  });
});

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

    // Graceful shutdown handling
    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down API server gracefully...`);
      server.close((err) => {
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