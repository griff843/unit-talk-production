/**
 * Phase 11B: Core Domain Integration - Picks API
 * Date: 2025-11-01
 * 
 * Implements DOKS-compliant picks domain API with:
 * - Multi-tenant isolation
 * - Idempotent operations
 * - Event-driven architecture
 * - SLO instrumentation
 */

import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { validateRequest } from '../../middleware/validation';
import {
  picksSubmitted,
  picksPublished,
  picksFailed,
  picksLatency
} from '../../monitoring/picks-metrics';
import { PicksDriverFactory } from '../../services/picks/PicksDriverFactory';
import { getSchemaStatus } from '../../lib/schema-probe';
import { introspectUnifiedSchema } from '../../lib/unified-schema-shim';
import { rateLimitGeneral } from '../../middleware/general-rate-limit';
import { preflightHandler } from './picks-preflight';

const logger = createLogger('PicksAPI');
const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ===============================================================================
// VALIDATION SCHEMAS
// ===============================================================================

const createPickSchema = z.object({
  body: z.object({
    prop_id: z.string().uuid().optional(),
    selection: z.string().min(1),
    odds: z.number().int(),
    stake: z.number().positive().default(1.0),
    confidence: z.number().int().min(1).max(10).optional(),
    workflow_stage: z.enum(['draft', 'pending_review', 'approved']).default('draft'),
    metadata: z.record(z.unknown()).optional(),
    idempotency_key: z.string().optional()
  })
});

const scorePickSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    force_rescore: z.boolean().default(false)
  }).optional()
});

const publishPickSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    channels: z.array(z.enum(['discord', 'email', 'in_app'])).default(['discord'])
  }).optional()
});

// ===============================================================================
// MIDDLEWARE
// ===============================================================================

/**
 * Extract tenant context from request
 */
const extractTenantContext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract tenant from header or use default
    const tenantId = req.headers['x-tenant-id'] as string || '00000000-0000-0000-0000-000000000001';
    const userId = req.headers['x-user-id'] as string;
    
    // Set tenant context in Supabase
    await supabase.rpc('set_tenant_context', {
      p_tenant_id: tenantId,
      p_user_id: userId || null
    });
    
    // Attach to request
    (req as any).tenantId = tenantId;
    (req as any).userId = userId;
    (req as any).correlationId = req.headers['x-correlation-id'] || uuidv4();
    
    next();
  } catch (error) {
    logger.error('Failed to extract tenant context', { error });
    res.status(500).json({
      success: false,
      error: 'TENANT_CONTEXT_ERROR',
      message: 'Failed to establish tenant context',
      timestamp: new Date().toISOString()
    });
  }
};

router.use(extractTenantContext);

// ===============================================================================
// HELPER FUNCTIONS
// ===============================================================================

/**
 * Publish event to event backbone
 */
async function publishEvent(
  eventType: string,
  pickId: string,
  tenantId: string,
  correlationId: string,
  eventData: Record<string, any>
) {
  try {
    await supabase.from('pick_events').insert({
      tenant_id: tenantId,
      pick_id: pickId,
      event_type: eventType,
      event_data: {
        ...eventData,
        timestamp: new Date().toISOString()
      },
      correlation_id: correlationId,
      metadata: {
        source: 'picks_api',
        version: '1.0.0'
      }
    });
    
    logger.info(`Event published: ${eventType}`, { pickId, correlationId });
  } catch (error) {
    logger.error('Failed to publish event', { eventType, pickId, error });
    throw error;
  }
}

/**
 * Check for existing pick by idempotency key
 */
async function checkIdempotency(tenantId: string, idempotencyKey: string) {
  const { data, error } = await supabase
    .from('picks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('idempotency_key', idempotencyKey)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  return data;
}

// ===============================================================================
// API ENDPOINTS
// ===============================================================================

/**
 * GET /api/domain/picks/preflight
 * Schema visibility check with self-healing
 * Charter-mandated endpoint for PostgREST visibility verification
 */
router.get('/preflight', preflightHandler);

/**
 * GET /api/domain/picks/status
 * Get picks driver status and schema information
 *
 * Returns information about:
 * - Current active driver (unified vs canonical)
 * - Driver selection reason
 * - Schema availability
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const correlationId = (req as any).correlationId || uuidv4();

    logger.info('Fetching picks driver status', { correlationId });

    // Get driver status from factory
    const driverStatus = PicksDriverFactory.getDriverStatus();

    // Get detailed schema status
    const schemaStatus = await getSchemaStatus();

    // Get unified schema column map if using unified driver
    let columnMap: Record<string, string> | undefined;
    if (driverStatus.driver_effective === 'unified') {
      try {
        const unifiedSchema = await introspectUnifiedSchema(supabase);
        columnMap = Object.fromEntries(unifiedSchema.mappings);
      } catch (error) {
        logger.warn('Failed to introspect unified schema for status', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        driver: {
          effective: driverStatus.driver_effective,
          requested: driverStatus.driver_requested,
          reason: driverStatus.reason,
        },
        schema: {
          canonical: schemaStatus.canonical,
          unified: {
            ...schemaStatus.unified,
            columnMap,
          },
        },
        health: {
          status: driverStatus.driver_effective ? 'healthy' : 'initializing',
          message:
            driverStatus.reason === 'fallback_canonical_missing'
              ? 'Canonical tables missing; using unified driver as fallback'
              : 'Driver operating normally',
        },
      },
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch picks driver status', { error });

    res.status(500).json({
      success: false,
      error: 'STATUS_FETCH_ERROR',
      message: error instanceof Error ? error.message : 'Failed to fetch status',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/picks
 * Create a new pick with idempotency support
 */
router.post('/', rateLimitGeneral(), validateRequest(createPickSchema), async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { tenantId, userId, correlationId } = req as any;
  
  try {
    const pickData = req.body;
    const idempotencyKey = pickData.idempotency_key || uuidv4();
    
    logger.info('Creating pick', { tenantId, userId, correlationId, idempotencyKey });
    
    // Check idempotency
    const existingPick = await checkIdempotency(tenantId, idempotencyKey);
    if (existingPick) {
      logger.info('Returning existing pick (idempotent)', { pickId: existingPick.id, correlationId });
      
      return res.status(200).json({
        success: true,
        data: existingPick,
        idempotent: true,
        correlation_id: correlationId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Create pick using helper function
    const { data: pickId, error } = await supabase.rpc('create_pick_with_event', {
      p_tenant_id: tenantId,
      p_user_id: userId,
      p_pick_data: {
        ...pickData,
        idempotency_key: idempotencyKey
      },
      p_correlation_id: correlationId
    });
    
    if (error) throw error;
    
    // Fetch created pick
    const { data: pick, error: fetchError } = await supabase
      .from('picks')
      .select('*')
      .eq('id', pickId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Track metrics
    picksSubmitted.inc({ tenant_id: tenantId, workflow_stage: pick.workflow_stage });
    picksLatency.observe({ operation: 'create' }, (Date.now() - startTime) / 1000);
    
    logger.info('Pick created successfully', { pickId, correlationId });
    
    res.status(201).json({
      success: true,
      data: pick,
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    picksFailed.inc({ tenant_id: tenantId, operation: 'create', error_type: 'unknown' });
    
    logger.error('Failed to create pick', { 
      tenantId, 
      userId, 
      correlationId, 
      error,
      duration 
    });
    
    res.status(500).json({
      success: false,
      error: 'PICK_CREATE_ERROR',
      message: error instanceof Error ? error.message : 'Failed to create pick',
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/picks/:id
 * Retrieve a pick by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { tenantId, correlationId } = req as any;
  const { id } = req.params;
  
  try {
    logger.info('Fetching pick', { pickId: id, tenantId, correlationId });
    
    const { data: pick, error } = await supabase
      .from('picks')
      .select(`
        *,
        users!picks_user_id_fkey (id, username, tier),
        props!picks_prop_id_fkey (id, player_name, stat_type, line),
        scores!scores_pick_id_fkey (professional_score, devigged_edge, clv_pct)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'PICK_NOT_FOUND',
          message: 'Pick not found',
          correlation_id: correlationId,
          timestamp: new Date().toISOString()
        });
      }
      throw error;
    }
    
    picksLatency.observe({ operation: 'get' }, (Date.now() - startTime) / 1000);
    
    res.status(200).json({
      success: true,
      data: pick,
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to fetch pick', { pickId: id, tenantId, correlationId, error });
    
    res.status(500).json({
      success: false,
      error: 'PICK_FETCH_ERROR',
      message: error instanceof Error ? error.message : 'Failed to fetch pick',
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/picks/:id/score
 * Trigger professional grading for a pick
 */
router.post('/:id/score', rateLimitGeneral(), validateRequest(scorePickSchema), async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { tenantId, correlationId } = req as any;
  const { id } = req.params;
  const { force_rescore = false } = req.body || {};

  try {
    logger.info('Scoring pick', { pickId: id, tenantId, correlationId, force_rescore });

    // Fetch pick
    const { data: pick, error: fetchError } = await supabase
      .from('picks')
      .select('*, scores!scores_pick_id_fkey (id)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'PICK_NOT_FOUND',
          message: 'Pick not found',
          correlation_id: correlationId,
          timestamp: new Date().toISOString()
        });
      }
      throw fetchError;
    }

    // Check if already scored
    if (pick.scores && !force_rescore) {
      return res.status(200).json({
        success: true,
        data: {
          pick_id: id,
          status: 'already_scored',
          message: 'Pick already has a score. Use force_rescore=true to rescore.'
        },
        correlation_id: correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Update grading status
    await supabase
      .from('picks')
      .update({
        grading_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    // Publish scoring event (stub - actual grading agent will process)
    await publishEvent(
      'pick.scoring_requested',
      id,
      tenantId,
      correlationId,
      {
        pick_id: id,
        force_rescore,
        requested_at: new Date().toISOString()
      }
    );

    // Track metrics
    picksLatency.observe({ operation: 'score' }, (Date.now() - startTime) / 1000);

    logger.info('Scoring request submitted', { pickId: id, correlationId });

    res.status(202).json({
      success: true,
      data: {
        pick_id: id,
        status: 'processing',
        message: 'Scoring request submitted. Check grading_status for updates.'
      },
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    picksFailed.inc({ tenant_id: tenantId, operation: 'score', error_type: 'unknown' });

    logger.error('Failed to score pick', { pickId: id, tenantId, correlationId, error });

    res.status(500).json({
      success: false,
      error: 'PICK_SCORE_ERROR',
      message: error instanceof Error ? error.message : 'Failed to score pick',
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/picks/:id/publish
 * Publish a pick to configured channels
 */
router.post('/:id/publish', rateLimitGeneral(), validateRequest(publishPickSchema), async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { tenantId, correlationId } = req as any;
  const { id } = req.params;
  const { channels = ['discord'] } = req.body || {};

  try {
    logger.info('Publishing pick', { pickId: id, tenantId, correlationId, channels });

    // Fetch pick
    const { data: pick, error: fetchError } = await supabase
      .from('picks')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'PICK_NOT_FOUND',
          message: 'Pick not found',
          correlation_id: correlationId,
          timestamp: new Date().toISOString()
        });
      }
      throw fetchError;
    }

    // Validate pick is approved
    if (pick.workflow_stage !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'PICK_NOT_APPROVED',
        message: 'Pick must be approved before publishing',
        current_stage: pick.workflow_stage,
        correlation_id: correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Update pick status
    await supabase
      .from('picks')
      .update({
        workflow_stage: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    // Publish event (stub - actual Discord/email handlers will process)
    await publishEvent(
      'pick.published',
      id,
      tenantId,
      correlationId,
      {
        pick_id: id,
        channels,
        published_at: new Date().toISOString()
      }
    );

    // Track metrics
    picksPublished.inc({ tenant_id: tenantId, channels: channels.join(',') });
    picksLatency.observe({ operation: 'publish' }, (Date.now() - startTime) / 1000);

    logger.info('Pick published successfully', { pickId: id, correlationId, channels });

    res.status(200).json({
      success: true,
      data: {
        pick_id: id,
        status: 'published',
        channels,
        published_at: new Date().toISOString()
      },
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    picksFailed.inc({ tenant_id: tenantId, operation: 'publish', error_type: 'unknown' });

    logger.error('Failed to publish pick', { pickId: id, tenantId, correlationId, error });

    res.status(500).json({
      success: false,
      error: 'PICK_PUBLISH_ERROR',
      message: error instanceof Error ? error.message : 'Failed to publish pick',
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

