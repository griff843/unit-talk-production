/**
 * Risk Status Proxy Route
 * Sprint: SPRINT-RISK-DASHBOARD-MONITORING
 *
 * GET /api/risk/status
 * Proxies to API service GET /api/risk/status.
 * Returns live aggregated risk state: exposure, drift, correlation, drawdown.
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
    const res = await fetch(`${API_URL}/api/risk/status`, {
      headers: {
        Authorization: ADMIN_TOKEN.startsWith('Bearer ') ? ADMIN_TOKEN : `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      // Short timeout — this is a dashboard live-data call
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { success: false, error: `API responded ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error('[RiskStatusProxy] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'PROXY_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
