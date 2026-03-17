/**
 * Risk Decisions Proxy Route
 * Sprint: SPRINT-RISK-DASHBOARD-MONITORING
 *
 * GET /api/risk/decisions
 * Proxies to API service GET /api/risk/decisions.
 * Supports: limit, offset, sport, date_from, date_to, type, severity query params.
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
    // Forward all query params to the API
    const { searchParams } = new URL(request.url);
    const upstreamUrl = new URL(`${API_URL}/api/risk/decisions`);
    searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));

    const res = await fetch(upstreamUrl.toString(), {
      headers: {
        Authorization: ADMIN_TOKEN.startsWith('Bearer ') ? ADMIN_TOKEN : `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
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
    console.error('[RiskDecisionsProxy] Error:', err);
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
