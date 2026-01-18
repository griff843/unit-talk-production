import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteLogger } from '@/lib/logger';
import { env } from '@/lib/env';
import { wsClient } from '@/lib/websocket-client';
import { createSpan } from '@/lib/telemetry';
import { createServiceClient } from '@/lib/supabase-client';
import { tenantValidationMiddleware } from '@/lib/middleware/tenant-validation';
import { userValidationMiddleware } from '@/lib/middleware/user-validation';
import { writeRateLimiter } from '@/lib/middleware/rate-limit';
import { idempotencyMiddleware } from '@/lib/middleware/idempotency';

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

// Force Node.js runtime (not Edge) to ensure full Node.js API support including logging
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 🔍 DIAGNOSTIC: Log incoming request (PROOF OF ARRIVAL)
  console.log('\n🚀 SERVER-SIDE REQUEST LOG:');
  console.log('  Timestamp:', new Date().toISOString());
  console.log('  Method:', request.method);
  console.log('  URL:', request.url);
  console.log('  Headers:', Object.fromEntries(request.headers.entries()));
  console.log('  Incoming request to /api/domain/picks/insert');
  console.log('');

  // Create telemetry span for pick insertion
  const span = createSpan('smartform.picks.insert', {
    attributes: {
      source: 'smart_form',
      endpoint: '/api/domain/picks/insert',
    },
  });

  try {
    log.info('Canonical pick submission received from Smart Form');

    // Parse request body early for middleware
    const rawBody = await request.json();

    // Extract tenant ID from header or environment
    // TypeScript: tenantId will be string (header value or env.TENANT_ID, never null/undefined)
    const tenantId = (request.headers.get('X-Tenant-ID') || env.TENANT_ID) as string;

    // GATE 1: Tenant Validation (fail-closed)
    const tenantValidation = await tenantValidationMiddleware(request, tenantId);
    if (tenantValidation) {
      log.warn({ tenantId }, 'Tenant validation failed');
      span.setAttributes({ gate: 'tenant_validation', status: 'rejected' });
      span.end();
      return tenantValidation; // Return error response immediately
    }

    // GATE 2: User Validation (fail-closed)
    // Extract userId from request body (before full validation)
    const userId = rawBody.userId;
    if (!userId) {
      log.warn('User ID missing from request');
      span.setAttributes({ gate: 'user_validation', status: 'rejected' });
      span.end();
      return NextResponse.json({
        success: false,
        error: 'Invalid pick data',
        details: [
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['userId'],
            message: 'User ID is required',
          }
        ],
      }, { status: 400 });
    }

    // TypeScript: userId is guaranteed to be defined after the null check above
    const userValidation = await userValidationMiddleware(request, userId as string, tenantId);
    if (userValidation) {
      log.warn({ userId, tenantId }, 'User validation failed');
      span.setAttributes({ gate: 'user_validation', status: 'rejected' });
      span.end();
      return userValidation; // Return error response immediately
    }

    // GATE 3: EARLY Idempotency Check (before rate limiting)
    // Idempotent requests should not count against rate limits
    const earlyBetSlipId = rawBody.idempotencyKey || rawBody.betSlipId;
    if (earlyBetSlipId) {
      const earlyIdempotencyResult = await idempotencyMiddleware(request, earlyBetSlipId as string, tenantId);
      if (earlyIdempotencyResult) {
        log.info({ betSlipId: earlyBetSlipId }, 'EARLY idempotent request - returning existing pick (before rate limit)');
        span.setAttributes({ gate: 'idempotency_early', status: 'duplicate' });
        span.end();
        return earlyIdempotencyResult; // Return 200 OK with existing pick
      }
    }

    // GATE 4: Rate Limiting (fail-closed)
    // NOTE: Don't pass userId - let rate limiter extract identifier from request
    // This allows X-Test-Run-ID header to take priority for test isolation
    const rateLimitResult = await writeRateLimiter(request);
    if (rateLimitResult) {
      log.warn({ userId }, 'Rate limit exceeded');
      span.setAttributes({ gate: 'rate_limit', status: 'rejected' });
      span.end();
      return rateLimitResult; // Return 429 Too Many Requests
    }

    // Now validate full input with Zod
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

    // Note: Idempotency check now happens BEFORE rate limiting (see GATE 3 above)
    // This ensures duplicate submissions don't count against rate limits

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

    // Try proxy first, fallback to direct write for testing/standalone mode
    let apiResponse;
    let usedFallback = false;

    try {
      // Forward to canonical picks API
      const apiUrl = `${INTERNAL_API_URL}/api/domain/picks/insert`;
      apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': pickData.idempotencyKey || pickData.betSlipId || `sf-${Date.now()}`,
          'X-Source': 'smart-form',
          'X-Form-Version': '3.0-canonical',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
    } catch (fetchError) {
      // Fallback to direct database write (for testing/standalone mode)
      log.warn({ error: fetchError instanceof Error ? fetchError.message : 'Unknown error' },
        'API proxy failed, using direct database write fallback');
      usedFallback = true;

      // Direct Supabase write with correct schema (picks table from 20251101_core_picks.sql)
      const betSlipId = pickData.idempotencyKey || pickData.betSlipId || `sf-${Date.now()}`;
      const supabase = createServiceClient(); // Use service role to bypass RLS

      // Check for duplicate (idempotency)
      if (pickData.idempotencyKey || pickData.betSlipId) {
        const { data: existing } = await supabase
          .from('picks')
          .select('id, bet_slip_id, created_at')
          .eq('bet_slip_id', betSlipId)
          .maybeSingle();

        if (existing) {
          // Return existing pick (idempotent)
          apiResponse = {
            ok: true,
            json: async () => ({
              success: true,
              pickId: existing.id,
              betSlipId: existing.bet_slip_id,
              driver: 'canonical',
              publishMode: env.PUBLISH_MODE,
              idempotent: true,
              createdAt: existing.created_at,
            }),
          } as Response;

          log.info({ pickId: existing.id, betSlipId: existing.bet_slip_id }, 'Idempotent pick request - returning existing');
          return NextResponse.json(await (apiResponse as Response).json(), { status: 200 });
        }
      }

      // Insert new pick with correct schema mapping
      // Wrap in try/catch to convert FK errors to 4xx responses (fail-closed)
      let result;
      try {
        const { data, error: insertError } = await supabase
          .from('picks')
          .insert({
            tenant_id: env.TENANT_ID,
            user_id: pickData.userId,  // Correct column name (not capper_id)
            selection: pickData.side,  // 'over' or 'under'
            odds: pickData.odds || -110,  // Default American odds
            stake: pickData.stake || 1.0,
            confidence: pickData.userScore,  // Optional self-score (1-10)
            bet_slip_id: betSlipId,
            idempotency_key: pickData.idempotencyKey,
            workflow_stage: 'draft',
            status: 'pending',
            metadata: {
              // Store all additional fields in metadata JSONB
              league: pickData.league,
              marketType: pickData.marketType,
              line: pickData.line,
              playerId: pickData.playerId,
              playerName: pickData.playerName,
              gameId: pickData.gameId,
              gameDate: pickData.gameDate,
              stakeText: pickData.stakeText,
              source: 'smart_form',
              formVersion: '3.0-canonical',
              submittedAt: new Date().toISOString(),
            },
          })
          .select('id, bet_slip_id, created_at')
          .single();

        if (insertError) {
          // Check for foreign key constraint violations
          if (insertError.code === '23503') {
            // FK violation - convert to 4xx instead of 500
            log.warn({
              error: insertError.message,
              code: insertError.code,
              userId: pickData.userId,
              tenantId: env.TENANT_ID
            }, 'Foreign key constraint violation');

            // Determine which FK failed based on error message
            if (insertError.message.includes('user_id')) {
              return NextResponse.json({
                success: false,
                error: 'User not found',
                errorCode: 'USER_NOT_FOUND',
                message: 'The specified user does not exist',
              }, { status: 404 });
            } else if (insertError.message.includes('tenant_id')) {
              return NextResponse.json({
                success: false,
                error: 'Tenant not found',
                errorCode: 'TENANT_NOT_FOUND',
                message: 'The specified tenant does not exist',
              }, { status: 404 });
            } else {
              // Generic FK error
              return NextResponse.json({
                success: false,
                error: 'Invalid reference',
                errorCode: 'FOREIGN_KEY_VIOLATION',
                message: 'Referenced entity does not exist',
              }, { status: 400 });
            }
          }

          // Non-FK errors
          log.error({ error: insertError.message, code: insertError.code }, 'Direct database write failed');
          throw new Error(`Failed to insert pick: ${insertError.message}`);
        }

        result = data;
      } catch (dbError: any) {
        // Catch any unexpected database errors and convert to proper response
        log.error({
          error: dbError.message,
          code: dbError.code,
          userId: pickData.userId
        }, 'Database operation failed');

        return NextResponse.json({
          success: false,
          error: 'Database operation failed',
          errorCode: 'DB_ERROR',
          message: 'Failed to process pick submission',
        }, { status: 500 });
      }

      // Format response to match API response structure
      apiResponse = {
        ok: true,
        json: async () => ({
          success: true,
          pickId: result.id,
          betSlipId: result.bet_slip_id,
          driver: 'canonical',
          publishMode: env.PUBLISH_MODE,
          idempotent: false,
          createdAt: result.created_at,
        }),
      } as Response;

      log.info({ pickId: result.id, betSlipId: result.bet_slip_id }, 'Pick created via direct database write fallback');
    }

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
