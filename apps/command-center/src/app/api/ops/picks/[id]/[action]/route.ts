'use server';

import { NextRequest, NextResponse } from 'next/server';

/**
 * OPS PICKS ACTION PROXY
 * Sprint: SPRINT-023B-CC-WRITE-BAN-ENFORCEMENT
 * UTRP-R3: DEFECT-14/15 — use internal service token instead of garbage Bearer token
 *
 * Proxies pick action requests to API service.
 * Command Center remains READ-ONLY - all writes go through API.
 *
 * POST /api/ops/picks/:id/:action
 * Actions: approve, reject, override, reduce-units, demote, workflow, settle-result
 */

function getApiBaseUrl(): string {
  return process.env.API_SERVICE_URL || 'http://localhost:3010';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await params;
    const body = await request.json();

    const validActions = [
      'approve',
      'reject',
      'override',
      'reduce-units',
      'demote',
      'workflow',
      'settle-result',
    ];

    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}. Valid: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Proxy to API service using internal service token (UTRP-R3 DEFECT-14/15)
    // INTERNAL_SERVICE_TOKEN is a shared secret set via env var — never from client headers
    const serviceToken = process.env.INTERNAL_SERVICE_TOKEN || '';
    const apiResponse = await fetch(`${getApiBaseUrl()}/ops/picks/${id}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service-Token': serviceToken,
      },
      body: JSON.stringify(body),
    });

    const result = await apiResponse.json();
    return NextResponse.json(result, { status: apiResponse.status });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to proxy pick action to API',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
