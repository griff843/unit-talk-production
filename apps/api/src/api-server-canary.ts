// CANARY API Server - Manual environment loading
// Bypasses loadRootEnv build issues for operational testing

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment files in precedence order: .env.shared → .env → .env.canary
const repoRoot = resolve(__dirname, '../../..');

config({ path: resolve(repoRoot, '.env.shared') });
config({ path: resolve(repoRoot, '.env'), override: true });
config({ path: resolve(repoRoot, '.env.canary'), override: true });

console.log('✅ Environment loaded for CANARY mode');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL?.substring(0, 30)}...`);
console.log(`   CANARY_CHANNEL: ${process.env.DISCORD_CANARY_CHANNEL_ID}`);

// 🚨 CRITICAL SAFETY: Environment validation MUST be first
// This prevents accidental connection to production infrastructure from local/dev/test
// @ts-ignore - Import from outside rootDir (experimental canary server)
import { validateEnvironmentOrExit, getEnvironmentConfig } from '../../../packages/shared-utils/src/env-validator';

// Validate environment on startup - will exit if unsafe
validateEnvironmentOrExit(getEnvironmentConfig());

import cors from 'express';
import express from 'express';

import healthRouter from './routes/health';
import { smartFormRouter } from './routes/smart-form';
import opsRouter from './routes/ops';
import opsPicksRouter from './routes/ops-picks'; // Operator pick management
import canaryTestRouter from './routes/canary-test'; // CANARY test endpoint
import picksRouter from './routes/picks';
import domainPicksRouter from './routes/domain/picks';
import { picksInsertRouter } from './routes/domain/picks-insert';
import createFeedbackRoutes from './routes/feedback';
import { supabaseClient } from './services/supabaseClient';
import { FeedbackLoopService } from './services/feedback/FeedbackLoopService';
// TODO: Fix TypeScript errors in these imports before uncommenting
// import { partnerRouter } from './routes/partners';
import { ErrorHandler } from './utils/errorHandling';
import { getEnv } from './utils/getEnv';
import { createLogger } from './utils/logger';
// import { getPicksMetrics } from './monitoring/picks-metrics';
// import { getPartnerMetrics } from './monitoring/partner-metrics';
// import { webhookDelivery } from './services/WebhookDeliveryService';

const logger = createLogger('API-Server');

const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
// @ts-ignore - cors configuration (experimental canary server)
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
app.use('/api/picks', picksRouter);
app.use('/api/domain/picks', domainPicksRouter); // Phase 11B: Core Domain Integration
app.use('/api/domain/picks', picksInsertRouter); // Phase 11B: Canonical picks insert API
app.use('/api/feedback', createFeedbackRoutes(logger, supabaseClient, FeedbackLoopService.getInstance())); // Phase 21: Feedback ingestion
// TODO: Fix TypeScript errors before uncommenting
// app.use('/v1/partners', partnerRouter); // Phase 14: Partner API
app.use('/ops', opsRouter);
app.use('/api/ops/picks', opsPicksRouter); // Operator pick promotion and management
app.use('/canary-test', canaryTestRouter); // CANARY test endpoint (bypass schema complexity)

// Metrics endpoint for Prometheus
app.get('/metrics', async (_req, res) => {
  try {
    // Placeholder for now - actual metrics implementation would go here
    res.setHeader('Content-Type', 'text/plain');
    res.send('# No metrics yet\n');
  } catch (err) {
    logger.error('Failed to collect metrics', { error: err });
    res.status(500).send('Error collecting metrics');
  }
});

// Error handling middleware (must be last)
// @ts-ignore - ErrorHandler type compatibility (experimental canary server)
app.use(ErrorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Unit Talk API Server (CANARY Mode) listening on port ${PORT}`, {
    environment: process.env.NODE_ENV,
    port: PORT,
    canaryChannel: process.env.DISCORD_CANARY_CHANNEL_ID
  });
});
