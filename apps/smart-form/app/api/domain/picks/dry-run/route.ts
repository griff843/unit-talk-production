import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('POST /api/domain/picks/dry-run', 'POST');

/**
 * Dry-Run Endpoint for Synthetic Monitoring
 *
 * This endpoint validates pick submission without database writes.
 * Used by operational synthetic monitoring to verify system health.
 *
 * Features:
 * - Full request validation
 * - No database operations
 * - Server-Timing headers for performance monitoring
 * - 204 No Content response on success
 * - Target response time: <50ms local
 */

const DryRunPickSchema = z.object({
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

  // Optional fields
  playerId: z.string().uuid().optional(),
  playerName: z.string().optional(),
  gameId: z.string().uuid().optional(),
  gameDate: z.string().datetime().optional(),
  odds: z.number().int().optional(),
  stakeText: z.string().optional(),
  stake: z.number().positive().optional(),
  userScore: z.number().int().min(1).max(10).optional(),
  betSlipId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  autoPublish: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  const timings: Record<string, number> = {};

  try {
    // Parse request - timing 1
    const parseStart = performance.now();
    const rawBody = await request.json();
    timings['parse'] = performance.now() - parseStart;

    log.info('Dry-run validation request received', {
      league: rawBody.league,
      marketType: rawBody.marketType,
    });

    // Validate input - timing 2
    const validateStart = performance.now();
    const validation = DryRunPickSchema.safeParse(rawBody);
    timings['validate'] = performance.now() - validateStart;

    if (!validation.success) {
      const validationTime = performance.now() - startTime;

      log.warn({
        errors: validation.error.errors,
        durationMs: validationTime,
      }, 'Dry-run validation failed');

      return NextResponse.json({
        success: false,
        error: 'Invalid pick data',
        details: validation.error.errors,
        dryRun: true,
        timings: {
          total: validationTime,
          ...timings,
        },
      }, {
        status: 400,
        headers: {
          'Server-Timing': buildServerTimingHeader({ total: validationTime, ...timings }),
        },
      });
    }

    const pickData = validation.data;

    // Simulate minimal processing - timing 3
    const processStart = performance.now();

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

    timings['process'] = performance.now() - processStart;

    const totalTime = performance.now() - startTime;
    timings['total'] = totalTime;

    log.info({
      league: pickData.league,
      marketType: pickData.marketType,
      betSlipId: pickData.betSlipId,
      durationMs: totalTime,
      timings,
    }, 'Dry-run validation successful');

    // Return 204 No Content with timing headers
    const response = new NextResponse(null, {
      status: 204,
      headers: {
        'Server-Timing': buildServerTimingHeader(timings),
        'X-Dry-Run': 'true',
        'X-Processing-Time': `${totalTime.toFixed(2)}ms`,
      },
    });

    return response;

  } catch (error) {
    const totalTime = performance.now() - startTime;
    timings['total'] = totalTime;

    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: totalTime,
    }, 'Dry-run endpoint error');

    return NextResponse.json({
      success: false,
      error: 'Dry-run validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      dryRun: true,
      timings,
    }, {
      status: 500,
      headers: {
        'Server-Timing': buildServerTimingHeader(timings),
      },
    });
  }
}

/**
 * Build Server-Timing header from timing measurements
 * Format: "parse;dur=1.2, validate;dur=0.8, process;dur=0.5, total;dur=2.5"
 */
function buildServerTimingHeader(timings: Record<string, number>): string {
  return Object.entries(timings)
    .map(([name, duration]) => `${name};dur=${duration.toFixed(2)}`)
    .join(', ');
}

/**
 * GET /api/domain/picks/dry-run/status
 *
 * Health check for dry-run endpoint
 */
export async function GET() {
  const startTime = performance.now();

  try {
    const responseTime = performance.now() - startTime;

    return NextResponse.json({
      success: true,
      endpoint: 'dry-run',
      purpose: 'Synthetic monitoring and validation testing',
      features: [
        'Full request validation',
        'Zero database operations',
        'Performance timing metrics',
        'Sub-50ms target response time',
      ],
      responseTime: `${responseTime.toFixed(2)}ms`,
    });
  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Dry-run status check failed');

    return NextResponse.json({
      success: false,
      error: 'Dry-run status check failed',
    }, { status: 500 });
  }
}
