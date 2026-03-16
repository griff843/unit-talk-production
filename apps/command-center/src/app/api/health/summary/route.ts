/**
 * Platform Health Summary Proxy
 * Sprint: SPRINT-058-LAYER3-PHASE10-CC-HEALTH-DASHBOARD
 *
 * GET /api/health/summary
 * Proxies to API service GET /api/health/summary.
 * Returns platform health: HEALTHY | DEGRADED | CRITICAL + SLO breach counts.
 *
 * API side has no auth on this endpoint (monitoring dashboard use case),
 * but we still require operator identity in CC to prevent public exposure.
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const API_URL =
  process.env.INTERNAL_API_URL || process.env.API_SERVICE_URL || 'http://localhost:3010';

export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_URL}/api/health/summary`, {
      signal: AbortSignal.timeout(8000),
    });

    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    // Upstream unavailable — return a stable CRITICAL payload so the UI can
    // render an error state rather than throwing.
    return NextResponse.json(
      {
        platform_status: 'CRITICAL' as const,
        computed_at: new Date().toISOString(),
        subsystems: [],
        slo_breaches: 0,
        slo_warns: 0,
        alert_count: 0,
        high_alert_count: 0,
        autopilot_mode: 'UNKNOWN',
        error: err instanceof Error ? err.message : 'Upstream unavailable',
      },
      { status: 503 }
    );
  }
}
