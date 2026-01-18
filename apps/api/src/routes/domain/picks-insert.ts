import express from 'express';
import { z } from 'zod';
import { auditLogger } from '../../services/picks/AuditLogger';
import { pickPublisher } from '../../services/picks/PickPublisher';
import { PicksDriverFactory } from '../../services/picks/PicksDriverFactory';
import { forcePostgrestReload, isDatabaseConnectionConfigured } from '../../lib/pgrest-reload';
import type { PickSubmissionInput } from '../../services/picks/types';
import { logger } from '../../shared/logger';

const router = express.Router();

/**
 * Per-process flag to track if schema reload has been sent on first request
 * This ensures PostgREST schema is fresh after service boot
 */
let firstRequestSchemaReloaded = false;

/**
 * Default tenant ID for Unit Talk platform
 */
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Dry-run validation schema
 * Matches Smart Form implementation for consistency
 */
const DryRunPickSchema = z.object({
  userId: z.string().uuid({ message: 'Invalid user ID' }),
  league: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'WNBA'], {
    errorMap: () => ({ message: 'Invalid league' }),
  }),
  marketType: z.string().min(1, 'Market type is required'),
  line: z.number({ required_error: 'Line is required' }),
  side: z
    .string()
    .transform((s) => s.toLowerCase())
    .refine((v) => v === 'over' || v === 'under', {
      message: 'Side must be "over" or "under"',
    }),
  // Optional fields
  playerName: z.string().optional(),
  odds: z.number().optional(),
  bookmaker: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/domain/picks/dry-run
 *
 * Dry-run endpoint for synthetic monitoring
 * Validates pick submission without database writes
 * Target response time: <50ms
 */
router.post('/dry-run', async (req, res) => {
  const startTime = Date.now();
  const correlationId = `dry-run-${Date.now()}`;
  const requestLogger = logger.child({ correlationId, endpoint: '/api/domain/picks/dry-run' });

  try {
    // Validate input
    const validation = DryRunPickSchema.safeParse(req.body);

    if (!validation.success) {
      const validationTime = Date.now() - startTime;

      requestLogger.warn({
        errors: validation.error.errors,
        durationMs: validationTime,
      }, 'Dry-run validation failed');

      return res.status(400).json({
        success: false,
        error: 'Invalid pick data',
        details: validation.error.errors,
        dryRun: true,
        processingTimeMs: validationTime,
      });
    }

    const pickData = validation.data;

    // Validate userId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(pickData.userId)) {
      throw new Error('Invalid UUID format for userId');
    }

    // Validate odds if provided
    if (pickData.odds !== undefined) {
      if (pickData.odds === 0 || Math.abs(pickData.odds) < 100) {
        throw new Error('Invalid odds value');
      }
    }

    const totalTime = Date.now() - startTime;

    requestLogger.info({
      league: pickData.league,
      marketType: pickData.marketType,
      side: pickData.side,
      line: pickData.line,
      durationMs: totalTime,
    }, 'Dry-run validation successful');

    // Return 204 No Content
    return res.status(204).end();

  } catch (error) {
    const totalTime = Date.now() - startTime;

    requestLogger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: totalTime,
    }, 'Dry-run endpoint error');

    return res.status(500).json({
      success: false,
      error: 'Dry-run validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      dryRun: true,
      processingTimeMs: totalTime,
    });
  }
});

/**
 * POST /api/domain/picks/insert
 *
 * Insert a new pick via Smart Form with full idempotency support
 *
 * Request Headers:
 * - Idempotency-Key: Optional header for request-level idempotency
 *
 * Request Body:
 * {
 *   tenantId?: string,
 *   userId: string,
 *   league: string,
 *   playerId?: string,
 *   playerName?: string,
 *   gameId?: string,
 *   gameDate?: string (ISO),
 *   marketType: string,
 *   line: number,
 *   side: 'over' | 'under',
 *   odds?: number,
 *   stakeText?: string,
 *   stake?: number,
 *   userScore?: number (1-10)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   pickId: string,
 *   idempotent: boolean,
 *   driver: 'unified' | 'canonical',
 *   publishMode: 'direct' | 'outbox'
 * }
 */
router.post('/insert', async (req, res) => {
  const correlationId = `pick-insert-${Date.now()}`;
  const requestLogger = logger.child({ correlationId, endpoint: '/api/domain/picks/insert' });

  try {
    // On first request after boot, proactively reload PostgREST schema cache
    // This prevents stale schema errors on the first insert after deployment
    if (!firstRequestSchemaReloaded && isDatabaseConnectionConfigured()) {
      requestLogger.info('First request after boot - reloading PostgREST schema cache');
      try {
        await forcePostgrestReload();
        firstRequestSchemaReloaded = true;
        requestLogger.info('PostgREST schema cache reloaded successfully on first request');
      } catch (reloadError) {
        // Log error but continue - the retry logic in CanonicalPicksDriver will handle it
        requestLogger.warn('Failed to reload schema on first request (will retry if needed)', {
          error: reloadError instanceof Error ? reloadError.message : String(reloadError),
        });
        firstRequestSchemaReloaded = true; // Mark as attempted to avoid retry loop
      }
    }

    // Extract idempotency key from header or body
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    // Validate required fields
    const { userId, league, marketType, line, side } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userId',
      });
    }

    if (!league) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: league',
      });
    }

    if (!marketType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: marketType',
      });
    }

    if (line === undefined || line === null) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: line',
      });
    }

    if (!side) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: side',
      });
    }

    // Build pick submission input
    const input: PickSubmissionInput = {
      tenantId: req.body.tenantId || DEFAULT_TENANT_ID,
      userId,
      league,
      playerId: req.body.playerId,
      playerName: req.body.playerName,
      gameId: req.body.gameId,
      gameDate: req.body.gameDate,
      marketType,
      line: parseFloat(line),
      side,
      odds: req.body.odds ? parseInt(req.body.odds) : undefined,
      stakeText: req.body.stakeText,
      stake: req.body.stake ? parseFloat(req.body.stake) : undefined,
      userScore: req.body.userScore ? parseInt(req.body.userScore) : undefined,
      idempotencyKey: idempotencyKey || req.body.idempotencyKey,
      betSlipId: req.body.betSlipId,
      metadata: {
        source: 'smart_form_api',
        correlationId,
        ...req.body.metadata,
      },
    };

    requestLogger.info('Processing pick insertion', {
      userId: input.userId,
      league: input.league,
      marketType: input.marketType,
      idempotencyKey: input.idempotencyKey,
    });

    // Get driver and insert pick
    const driver = await PicksDriverFactory.getDriver();
    const pick = await driver.insertPick(input);

    // Determine if this was an idempotent response
    const isIdempotent = !!input.idempotencyKey;

    requestLogger.info('Pick inserted successfully', {
      pickId: pick.id,
      idempotent: isIdempotent,
      driver: PicksDriverFactory.getCurrentDriverType(),
    });

    // Log pick submission to audit log
    await auditLogger.logPickSubmitted(pick.id, pick.tenantId, pick.userId, {
      marketType: input.marketType,
      line: input.line,
      side: input.side,
      odds: input.odds,
      idempotencyKey: input.idempotencyKey,
    });

    // Publish pick if auto-publish is enabled (optional)
    if (req.body.autoPublish !== false) {
      try {
        await pickPublisher.publish(pick, {
          channel: 'DISCORD',
          threadId: req.body.threadId,
          scheduledFor: req.body.scheduledFor ? new Date(req.body.scheduledFor) : undefined,
        });

        requestLogger.info('Pick queued for publishing', {
          pickId: pick.id,
          publishMode: pickPublisher.getPublishMode(),
        });
      } catch (publishError) {
        // Log publish error but don't fail the request
        requestLogger.error('Failed to queue pick for publishing', {
          pickId: pick.id,
          error: publishError instanceof Error ? publishError.message : String(publishError),
        });
      }
    }

    // Return success response
    return res.status(201).json({
      success: true,
      pickId: pick.id,
      pick: {
        id: pick.id,
        tenantId: pick.tenantId,
        userId: pick.userId,
        selection: pick.selection,
        odds: pick.odds,
        stake: pick.stake,
        status: pick.status,
        createdAt: pick.createdAt,
      },
      idempotent: isIdempotent,
      driver: PicksDriverFactory.getCurrentDriverType(),
      publishMode: pickPublisher.getPublishMode(),
      correlationId,
    });
  } catch (error) {
    requestLogger.error('Pick insertion failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error during pick insertion',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
    });
  }
});

/**
 * GET /api/domain/picks/status
 *
 * Get system status including driver type and availability
 */
router.get('/status', async (_req, res) => {
  try {
    const currentDriver = PicksDriverFactory.getCurrentDriverType();
    const canonicalAvailable = await PicksDriverFactory.isCanonicalAvailable();
    const unifiedAvailable = await PicksDriverFactory.isUnifiedAvailable();

    return res.json({
      success: true,
      currentDriver,
      driverAvailability: {
        canonical: canonicalAvailable,
        unified: unifiedAvailable,
      },
      publishMode: pickPublisher.getPublishMode(),
      configuredDriver: process.env.PICK_DRIVER || 'canonical',
      configuredPublishMode: process.env.PUBLISH_MODE || 'outbox',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as picksInsertRouter };
