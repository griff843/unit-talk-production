/**
 * CC Proxy: POST /api/picks/batch-action → API /ops/picks/batch-action
 *
 * SPRINT-082-LAYER3-PHASE11-CC-BATCH-PICK-OPERATIONS
 * Layer/Phase: Layer 3 / Phase 11 — Workflow Optimization
 *
 * Forwards bulk pick action requests from the Command Center UI to the API
 * operator control plane. Auth requires a valid operator identity (JWT).
 *
 * Body: { pickIds: string[], action: 'promote' | 'reject' | 'requeue', reason?: string }
 * Returns: { success, data: { succeeded: string[], failed: { id, error }[] }, timestamp }
 *
 * CC MUST NOT write to any business table — this is a proxy to the API only.
 */

import { type NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const API_URL =
  process.env.INTERNAL_API_URL || process.env.API_SERVICE_URL || 'http://localhost:3010';
const ADMIN_TOKEN = process.env.INTERNAL_API_TOKEN || 'Bearer admin-internal';

export async function POST(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const authHeader = ADMIN_TOKEN.startsWith('Bearer ') ? ADMIN_TOKEN : `Bearer ${ADMIN_TOKEN}`;
    const res = await fetch(`${API_URL}/ops/picks/batch-action`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'PROXY_ERROR',
        message: err instanceof Error ? err.message : 'Upstream unavailable',
      },
      { status: 503 }
    );
  }
}
