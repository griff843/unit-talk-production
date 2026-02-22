/**
 * Dashboard Health Endpoint
 *
 * SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: Truthful health endpoint
 *
 * Returns 200 JSON for Docker healthcheck:
 * { status: "ok", service: "dashboard", ts: ISO timestamp }
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'dashboard',
      ts: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
