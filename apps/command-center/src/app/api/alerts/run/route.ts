/**
 * Manual Alert Trigger API Endpoint - Phase 3
 *
 * POST /api/alerts/run
 * Manually triggers SLO evaluation and alert emission.
 * Useful for testing and manual checks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { evaluateAndGenerateAlerts } from '@/lib/slo/evaluator';
import { emitAlerts } from '@/lib/alerts/emitter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[API /api/alerts/run] Manual SLO evaluation triggered...');

    const { status, alerts } = await evaluateAndGenerateAlerts();

    console.log(
      `[API /api/alerts/run] Evaluation complete - ${alerts.length} alerts generated`
    );

    // Emit alerts
    if (alerts.length > 0) {
      await emitAlerts(alerts);
      console.log(`[API /api/alerts/run] ${alerts.length} alerts emitted`);
    } else {
      console.log('[API /api/alerts/run] No alerts to emit - all SLOs passing');
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        slo_status: status,
        alerts_generated: alerts.length,
        alerts: alerts.map(a => ({
          fingerprint: a.fingerprint,
          slo_name: a.slo_name,
          severity: a.severity,
          title: a.title,
          message: a.message,
        })),
        timestamp: new Date().toISOString(),
        execution_time_ms: responseTime,
      },
      {
        status: 200,
        headers: {
          'X-Response-Time': `${responseTime}ms`,
        },
      }
    );
  } catch (error) {
    console.error('[API /api/alerts/run] Error during manual alert run:', error);

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run alert evaluation',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        execution_time_ms: responseTime,
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
