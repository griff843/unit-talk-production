/**
 * SLO Status API Endpoint - Phase 3
 *
 * GET /api/slo/status
 * Returns current SLO evaluation status for all monitored SLOs.
 *
 * NO MOCK DATA - returns real metrics from local postgres and supabase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { evaluateAllSLOs } from '@/lib/slo/evaluator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[API /api/slo/status] Evaluating all SLOs...');

    const sloStatus = await evaluateAllSLOs();

    const responseTime = Date.now() - startTime;

    console.log(
      `[API /api/slo/status] Evaluation complete in ${responseTime}ms - Overall status: ${sloStatus.overall_status}`
    );

    return NextResponse.json(sloStatus, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime}ms`,
        'X-Data-Sources': JSON.stringify(sloStatus.data_sources),
      },
    });
  } catch (error) {
    console.error('[API /api/slo/status] Error evaluating SLOs:', error);

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to evaluate SLOs',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          'X-Response-Time': `${responseTime}ms`,
          'X-Error': 'true',
        },
      }
    );
  }
}
