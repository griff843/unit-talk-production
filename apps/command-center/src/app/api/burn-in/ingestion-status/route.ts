/**
 * GET /api/burn-in/ingestion-status
 * Returns ingestion freshness status
 */

import { NextResponse } from 'next/server';
import { burnInRunner } from '@/lib/burn-in/runner';

export async function GET() {
  try {
    const result = await burnInRunner.runIngestionCheck();

    // Always return HTTP 200 - stale data is not an error, it's expected
    // The status field indicates if ingestion is healthy/stale/critical
    return NextResponse.json(
      {
        status: result.data?.status || 'UNKNOWN',
        minutes_since_last: result.data?.minutes_since_last || null,
        last_ingestion_time: result.data?.last_ingestion_at || null,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'ERROR',
        error: error instanceof Error ? error.message : String(error),
        minutes_since_last: null,
        last_ingestion_time: null,
      },
      { status: 500 }
    );
  }
}
