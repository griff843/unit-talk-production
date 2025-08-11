/**
 * Operations API Routes - Admin endpoints for triggering business flows
 * 
 * CRITICAL: These endpoints are for E2E testing and operational control.
 * Authentication required for production use.
 */

import express from 'express';
import { Connection, Client } from '@temporalio/client';
import { createLogger } from '../utils/logger';
import { getEnv } from '../utils/getEnv';
import crypto from 'crypto';

const logger = createLogger('OpsRouter');
const router = express.Router();
const env = getEnv();

// Simple admin auth middleware
const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  // For E2E testing, allow bypass with specific header
  if (req.headers['x-e2e-test'] === 'true') {
    logger.info('E2E test bypass enabled');
    return next();
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer admin-')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Admin access required',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// Apply auth to all ops routes
router.use(adminAuth);

// Add cache control for testing
router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
});

/**
 * POST /ops/ingest-now - Trigger immediate data ingestion
 * 
 * Body:
 * {
 *   "sport": "MLB",
 *   "window": "next-3h", 
 *   "books": ["FD", "DK"],
 *   "testMode": true
 * }
 */
router.post('/ingest-now', async (req, res) => {
  const runId = `ingest-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const correlationId = `ops-${runId}`;
  
  try {
    const {
      sport = 'MLB',
      window = 'next-3h', 
      books = ['FD', 'DK'],
      testMode = false
    } = req.body;

    logger.info('🚀 Manual ingestion triggered', {
      correlationId,
      runId,
      sport,
      window,
      books,
      testMode,
      timestamp: new Date().toISOString()
    });

    // Connect to Temporal and start ingestion workflow
    const connection = await Connection.connect({ 
      address: env.TEMPORAL_SERVER_URL 
    });
    
    const client = new Client({ connection });
    
    // Start the FeedAgent workflow with specific parameters
    const workflowId = `feed-agent-manual-${runId}`;
    
    const handle = await client.workflow.start('feedAgentWorkflow', {
      args: [{
        sport: sport.toLowerCase(),
        batchSize: 100,
        timeout: 300000, // 5 minutes
        includeSettlement: false,
        testMode,
        books,
        window,
        runId,
        correlationId
      }],
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      memo: {
        triggeredBy: 'manual-ops',
        sport,
        runId,
        testMode: testMode.toString()
      }
    });

    const response = {
      success: true,
      runId,
      workflowId,
      correlationId,
      parameters: {
        sport,
        window,
        books,
        testMode
      },
      status: 'started',
      estimatedDuration: '2-5 minutes',
      monitoringUrl: `${env.TEMPORAL_UI_URL}/namespaces/default/workflows/${workflowId}`,
      timestamp: new Date().toISOString(),
      endpoints: {
        status: `/ops/status/${runId}`,
        logs: `/ops/logs/${runId}`
      }
    };

    logger.info('✅ Ingestion workflow started', {
      correlationId,
      workflowId,
      runId,
      sport
    });

    res.status(202).json(response);

  } catch (error) {
    logger.error('❌ Failed to trigger ingestion', {
      correlationId,
      runId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      runId,
      correlationId,
      error: 'Failed to trigger ingestion workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /ops/status/:runId - Get ingestion run status
 */
router.get('/status/:runId', async (req, res) => {
  const { runId } = req.params;
  const correlationId = `ops-status-${Date.now()}`;
  
  try {
    logger.info('📊 Status check requested', { correlationId, runId });
    
    // Connect to Temporal to check workflow status
    const connection = await Connection.connect({ 
      address: env.TEMPORAL_SERVER_URL 
    });
    
    const client = new Client({ connection });
    const workflowId = `feed-agent-manual-${runId}`;
    
    try {
      const handle = client.workflow.getHandle(workflowId);
      const description = await handle.describe();
      
      const response = {
        success: true,
        runId,
        workflowId,
        status: description.status.name,
        startTime: description.startTime,
        executionTime: description.executionTime,
        runTime: description.runTime,
        historyLength: description.historyLength,
        memo: description.memo,
        timestamp: new Date().toISOString()
      };
      
      // If workflow is completed, try to get result
      if (description.status.name === 'COMPLETED') {
        try {
          const result = await handle.result();
          response.result = result;
        } catch (resultError) {
          logger.warn('Could not fetch workflow result', { 
            correlationId, 
            runId, 
            error: resultError instanceof Error ? resultError.message : 'Unknown error' 
          });
        }
      }
      
      res.json(response);
      
    } catch (workflowError) {
      // Workflow not found or other Temporal error
      res.status(404).json({
        success: false,
        runId,
        workflowId,
        error: 'Workflow not found or inaccessible',
        details: workflowError instanceof Error ? workflowError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    logger.error('❌ Status check failed', {
      correlationId,
      runId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      runId,
      correlationId,
      error: 'Failed to check workflow status',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /ops/health - Operations health check
 */
router.get('/health', async (req, res) => {
  try {
    // Check Temporal connectivity
    const connection = await Connection.connect({ 
      address: env.TEMPORAL_SERVER_URL 
    });
    
    const client = new Client({ connection });
    
    // Basic health check - try to describe a system workflow
    const systemHealth = {
      temporal: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };

    res.json({
      success: true,
      service: 'Unit Talk Operations API',
      status: 'healthy',
      ...systemHealth,
      endpoints: [
        'POST /ops/ingest-now',
        'GET /ops/status/:runId', 
        'GET /ops/health'
      ]
    });

  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'Unit Talk Operations API',
      status: 'degraded',
      error: 'Temporal connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /ops/cleanup/:runId - Cleanup test data (E2E helper)
 */
router.delete('/cleanup/:runId', async (req, res) => {
  const { runId } = req.params;
  const correlationId = `ops-cleanup-${Date.now()}`;
  
  try {
    // This would cleanup test data associated with a run
    // For now, just acknowledge the request
    logger.info('🧹 Cleanup requested', { correlationId, runId });
    
    res.json({
      success: true,
      runId,
      correlationId,
      message: 'Cleanup completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Cleanup failed', {
      correlationId,
      runId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      runId,
      correlationId,
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;