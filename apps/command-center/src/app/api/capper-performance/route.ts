/**
 * CC Proxy: GET /api/capper-performance → API /api/cappers
 *
 * SPRINT-075-LAYER3-PHASE10-CC-CAPPER-DASHBOARD
 * Layer/Phase: Layer 3 / Phase 10 — Command Center UX
 *
 * Proxies capper performance stats (win rate, ROI, streak) from the API
 * service to the Command Center frontend. Replaces an earlier implementation
 * that read Supabase directly without auth (forbidden for read-only CC service).
 *
 * Auth: requireOperatorIdentity (JWT) — no unauthenticated access.
 * CC MUST NOT write to any business table — read-only proxy only.
 *
 * Supported query params forwarded upstream:
 *   ?window=<days>      rolling window (default 10)
 *   ?capper_id=<uuid>   filter to one capper
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
    const { searchParams } = request.nextUrl;
    const upstream = new URL(`${API_URL}/api/cappers`);

    for (const param of ['window', 'capper_id']) {
      const val = searchParams.get(param);
      if (val !== null) {
        upstream.searchParams.set(param, val);
      }
    }

    const authHeader = ADMIN_TOKEN.startsWith('Bearer ') ? ADMIN_TOKEN : `Bearer ${ADMIN_TOKEN}`;
    const res = await fetch(upstream.toString(), {
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
        data: { cappers: [] },
      },
      { status: 503 }
    );
  }
}
