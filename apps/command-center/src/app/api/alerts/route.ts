/**
 * CC Proxy: GET /api/alerts → API /ops/alerts
 *
 * SPRINT-061-LAYER3-PHASE10-CC-ALERT-DASHBOARD
 * Layer/Phase: Layer 3 / Phase 10 — Command Center UX
 *
 * Proxies active alert data from the API service (EnhancedAlertManager) to the
 * Command Center frontend. This replaces a stale pre-pattern implementation that
 * wrote directly to `api_alerts` (forbidden for this read-only service).
 *
 * Auth: requireOperatorIdentity (JWT) — no unauthenticated access.
 * CC MUST NOT write to any business table — read-only proxy only.
 */

import { type NextRequest, NextResponse } from 'next/server';

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
    const res = await fetch(`${API_URL}/ops/alerts`, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'PROXY_ERROR',
        message: err instanceof Error ? err.message : 'Upstream unavailable',
        data: { alerts: [] },
      },
      { status: 503 }
    );
  }
}
