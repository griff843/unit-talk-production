/**
 * WorkflowRegistry Proxy
 * Sprint: SPRINT-060-LAYER3-PHASE11-CC-WORKFLOW-MANAGEMENT
 *
 * GET /api/ops/workflows
 * Proxies to API service GET /ops/workflows.
 * Returns the full WorkflowRegistry (18 entries, 6 categories).
 * Supports optional ?category= filter passthrough.
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

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  const upstreamUrl = category
    ? `${API_URL}/ops/workflows?category=${encodeURIComponent(category)}`
    : `${API_URL}/ops/workflows`;

  try {
    const authHeader = ADMIN_TOKEN.startsWith('Bearer ') ? ADMIN_TOKEN : `Bearer ${ADMIN_TOKEN}`;

    const res = await fetch(upstreamUrl, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        workflows: [],
        categories: [],
        counts: {},
        error: err instanceof Error ? err.message : 'Upstream unavailable',
      },
      { status: 503 }
    );
  }
}
