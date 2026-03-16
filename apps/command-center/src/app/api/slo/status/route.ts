/**
 * SLO Status Proxy
 * Sprint: SPRINT-058-LAYER3-PHASE10-CC-HEALTH-DASHBOARD
 *
 * GET /api/slo/status
 * Proxies to API service GET /api/slo/status.
 * Returns SLO attainment for the 7-day rolling window.
 *
 * API side requires operatorAuth (JWT); CC forwards the internal admin token.
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const API_URL =
  process.env.INTERNAL_API_URL || process.env.API_SERVICE_URL || 'http://localhost:3010';
const ADMIN_TOKEN = process.env.INTERNAL_API_TOKEN || 'Bearer admin-internal';

export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const authHeader = ADMIN_TOKEN.startsWith('Bearer ') ? ADMIN_TOKEN : `Bearer ${ADMIN_TOKEN}`;

    const res = await fetch(`${API_URL}/api/slo/status`, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    // Upstream unavailable — return empty SLO list so the UI can render
    // a stable "unavailable" state.
    return NextResponse.json(
      {
        success: false,
        error: 'PROXY_ERROR',
        message: err instanceof Error ? err.message : 'Upstream unavailable',
        data: { window_days: 7, computed_at: new Date().toISOString(), slos: [] },
      },
      { status: 503 }
    );
  }
}
