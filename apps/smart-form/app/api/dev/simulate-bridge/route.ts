import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { simulateBridgeProcessing } from '@/bridge/publish';
import { createRouteLogger, logValidationError } from '@/lib/logger';

const log = createRouteLogger('POST /api/dev/simulate-bridge', 'POST');

// Only allow in development
const isDev = process.env.NODE_ENV === 'development';

const SimulateBridgeSchema = z.object({
  bet_slip_id: z.string().uuid('Invalid bet slip ID format'),
});

export async function POST(request: NextRequest) {
  if (!isDev) {
    return NextResponse.json({
      error: 'Not available in production',
    }, { status: 404 });
  }

  try {
    const body = await request.json();
    
    const validation = SimulateBridgeSchema.safeParse(body);
    if (!validation.success) {
      logValidationError(log, validation.error.errors, body);
      
      return NextResponse.json({
        error: 'Invalid request data',
        details: validation.error.errors,
      }, { status: 400 });
    }

    const { bet_slip_id } = validation.data;

    log.info({
      bet_slip_id,
    }, 'Simulating bridge processing');

    const result = await simulateBridgeProcessing(bet_slip_id);

    if (result.success) {
      return NextResponse.json({
        success: true,
        bet_slip_id,
        message: result.message,
        simulated_at: new Date().toISOString(),
      }, { status: 200 });
    } else {
      return NextResponse.json({
        success: false,
        bet_slip_id,
        error: result.message,
      }, { status: 500 });
    }

  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Error in bridge simulation');

    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to simulate bridge processing',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!isDev) {
    return NextResponse.json({
      error: 'Not available in production',
    }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const betSlipId = searchParams.get('id');

  if (!betSlipId) {
    return NextResponse.json({
      error: 'Missing bet_slip_id parameter',
      usage: 'GET /api/dev/simulate-bridge?id=<bet_slip_id>',
    }, { status: 400 });
  }

  const validation = z.string().uuid().safeParse(betSlipId);
  if (!validation.success) {
    return NextResponse.json({
      error: 'Invalid bet slip ID format',
    }, { status: 400 });
  }

  const result = await simulateBridgeProcessing(validation.data);

  return NextResponse.json({
    success: result.success,
    bet_slip_id: validation.data,
    message: result.message,
    simulated_at: new Date().toISOString(),
  }, {
    status: result.success ? 200 : 500,
  });
}