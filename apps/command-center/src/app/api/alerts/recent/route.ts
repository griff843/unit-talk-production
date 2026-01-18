/**
 * Recent Alerts API Endpoint - Phase 3
 *
 * GET /api/alerts/recent
 * Returns recent alert events from alert_events table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecentAlerts } from '@/lib/alerts/providers/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    console.log(`[API /api/alerts/recent] Fetching ${limit} recent alerts...`);

    const alerts = await getRecentAlerts(limit);

    const responseTime = Date.now() - startTime;

    console.log(
      `[API /api/alerts/recent] Retrieved ${alerts.length} alerts in ${responseTime}ms`
    );

    return NextResponse.json(
      {
        alerts,
        count: alerts.length,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Response-Time': `${responseTime}ms`,
        },
      }
    );
  } catch (error) {
    console.error('[API /api/alerts/recent] Error fetching alerts:', error);

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to fetch recent alerts',
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
