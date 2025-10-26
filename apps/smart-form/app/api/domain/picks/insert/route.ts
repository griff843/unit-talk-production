import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteLogger } from '@/lib/logger';
import { env } from '@/lib/env';
import { wsClient } from '@/lib/websocket-client';
import { createSpan } from '@/lib/telemetry';

const log = createRouteLogger('POST /api/domain/picks/insert', 'POST');

/**
 * Canonical Picks Integration
 *
 * This endpoint provides Smart Form integration with the canonical picks system.
 * It proxies requests to the main API service's canonical picks endpoint while
 * providing Smart Form-specific request/response transformation.
 *
 * Flow:
 * 1. Smart Form submits pick via this endpoint
 * 2. Request validated and transformed to canonical format
 * 3. Forwarded to API service at http://api:3000/api/domain/picks/insert
 * 4. Response transformed and returned to Smart Form
 * 5. Audit log entry created
 * 6. Outbox entry for Discord publishing (if enabled)
 */

// Validation schema for canonical pick submission
const CanonicalPickSchema = z.object({
  // Required fields
  userId: z.string().uuid('Invalid user ID'),
  league: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'WNBA'], {
    errorMap: () => ({ message: 'Invalid league' }),
  }),
  marketType: z.string().min(1, 'Market type is required'),
  line: z.number({ required_error: 'Line is required' }),
  side: z.enum(['over', 'under'], {
    errorMap: () => ({ message: 'Side must be over or under' }),
  }),

  // Optional but recommended fields
  playerId: z.string().uuid().optional(),
  playerName: z.string().optional(),
  gameId: z.string().uuid().optional(),
  gameDate: z.string().datetime().optional(),
  odds: z.number().int().optional(),
  stakeText: z.string().optional(),
  stake: z.number().positive().optional(),
  userScore: z.number().int().min(1).max(10).optional(),

  // Smart Form metadata
  betSlipId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  threadId: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  autoPublish: z.boolean().default(true),

  // Idempotency
  idempotencyKey: z.string().optional(),
});

/**
 * Internal API URL for service-to-service communication
 * In Docker network: http://api:3000
 * For local dev outside Docker: http://localhost:3010
 */
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://api:3000';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Create telemetry span for pick insertion
  const span = createSpan('smartform.picks.insert', {
    attributes: {
      source: 'smart_form',
      endpoint: '/api/domain/picks/insert',
    },
  });

  try {
    log.info('Canonical pick submission received from Smart Form');

    // Parse request body
    const rawBody = await request.json();

    // Validate input
    const validation = CanonicalPickSchema.safeParse(rawBody);
    if (!validation.success) {
      log.warn({ errors: validation.error.errors }, 'Validation failed');

      span.setAttributes({
        validation: 'failed',
        errorCount: validation.error.errors.length,
      });
      span.end();

      return NextResponse.json({
        success: false,
        error: 'Invalid pick data',
        details: validation.error.errors,
      }, { status: 400 });
    }

    const pickData = validation.data;

    // Add pick details to span
    span.setAttributes({
      userId: pickData.userId,
      league: pickData.league,
      marketType: pickData.marketType,
      idempotencyKey: pickData.idempotencyKey || pickData.betSlipId || 'none',
      pickId: pickData.betSlipId || 'pending',
    });

    // Add tenant ID from environment
    const requestBody = {
      ...pickData,
      tenantId: env.TENANT_ID,
      metadata: {
        source: 'smart_form',
        formVersion: '3.0-canonical',
        submittedAt: new Date().toISOString(),
        ...pickData,
      },
    };

    log.info({
      userId: pickData.userId,
      league: pickData.league,
      marketType: pickData.marketType,
      betSlipId: pickData.betSlipId,
    }, 'Forwarding to canonical API');

    // Forward to canonical picks API
    const apiUrl = `${INTERNAL_API_URL}/api/domain/picks/insert`;
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': pickData.idempotencyKey || pickData.betSlipId || `sf-${Date.now()}`,
        'X-Source': 'smart-form',
        'X-Form-Version': '3.0-canonical',
      },
      body: JSON.stringify(requestBody),
    });

    // Handle API response
    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({
        error: 'Unknown error from canonical API',
      }));

      log.error({
        status: apiResponse.status,
        error: errorData,
      }, 'Canonical API returned error');

      return NextResponse.json({
        success: false,
        error: errorData.error || 'Failed to submit pick',
        message: errorData.message || 'An error occurred while processing your pick',
      }, { status: apiResponse.status });
    }

    const apiData = await apiResponse.json();

    const duration = Date.now() - startTime;

    log.info({
      pickId: apiData.pickId,
      driver: apiData.driver,
      publishMode: apiData.publishMode,
      duration,
    }, 'Pick submitted successfully via canonical API');

    // Update span with success details
    span.setAttributes({
      pickId: apiData.pickId,
      driver: apiData.driver,
      publishMode: apiData.publishMode,
      idempotent: apiData.idempotent || false,
      success: true,
    });

    // Emit WebSocket event for Command Center real-time sync
    // This is non-blocking - Smart Form continues if WS unavailable
    try {
      wsClient.emitPickSubmitted({
        pickId: apiData.pickId,
        userId: pickData.userId,
        league: pickData.league,
        metadata: {
          marketType: pickData.marketType,
          playerName: pickData.playerName,
          betSlipId: pickData.betSlipId,
          driver: apiData.driver,
        },
      });
    } catch (wsError) {
      // Non-blocking: log warning but continue
      log.warn({
        error: wsError instanceof Error ? wsError.message : 'Unknown error',
        pickId: apiData.pickId,
      }, 'Failed to emit WebSocket event (non-blocking)');
    }

    // End span successfully
    span.end();

    // Return success response with Smart Form enhancements
    return NextResponse.json({
      success: true,
      pickId: apiData.pickId,
      pick: apiData.pick,

      // Smart Form specific fields
      betSlipId: pickData.betSlipId,
      displayMessage: getDisplayMessage(apiData),

      // System information
      driver: apiData.driver,
      publishMode: apiData.publishMode,
      idempotent: apiData.idempotent,

      // Performance metrics
      processingTime: duration,

      // Audit trail
      auditLogged: true,
      outboxQueued: apiData.publishMode === 'outbox',
    }, { status: 201 });

  } catch (error) {
    const duration = Date.now() - startTime;

    // Record exception in span
    span.recordException(error as Error);
    span.end();

    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration,
    }, 'Unexpected error in canonical pick submission');

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while submitting your pick',
    }, { status: 500 });
  }
}

/**
 * GET /api/domain/picks/insert/status
 *
 * Health check endpoint to verify canonical integration status
 */
export async function GET() {
  try {
    const apiUrl = `${INTERNAL_API_URL}/api/domain/picks/status`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API health check failed: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      smartFormIntegration: 'active',
      canonicalApi: data,
      environment: {
        pickDriver: env.PICK_DRIVER,
        publishMode: env.PUBLISH_MODE,
        tenantId: env.TENANT_ID,
        cdnBase: env.CDN_BASE,
      },
    });
  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to check canonical API status');

    return NextResponse.json({
      success: false,
      error: 'Failed to connect to canonical API',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}

/**
 * Helper function to generate user-friendly display messages
 */
function getDisplayMessage(apiData: any): string {
  const { publishMode, idempotent } = apiData;

  if (idempotent) {
    return 'Pick already submitted (idempotent)';
  }

  if (publishMode === 'outbox') {
    return 'Pick submitted and queued for publishing';
  }

  return 'Pick submitted successfully';
}
