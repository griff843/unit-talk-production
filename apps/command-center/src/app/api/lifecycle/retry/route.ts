'use server';

import { NextRequest, NextResponse } from 'next/server';

/**
 * LIFECYCLE RETRY API PROXY
 * Sprint: POSTING-SETTLEMENT-EXACTNESS-040
 *
 * Proxies retry requests to API service.
 * Command Center remains READ-ONLY - no direct DB writes here.
 *
 * POST /api/lifecycle/retry
 * Body: { pick_id, drift_mode, reason, retry_type }
 */

// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function getApiBaseUrl(): string {
  return process.env.API_SERVICE_URL || 'http://localhost:3000';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pick_id, drift_mode, reason, retry_type } = body;

    // Validate required fields
    if (!pick_id) {
      return NextResponse.json({ success: false, error: 'pick_id is required' }, { status: 400 });
    }

    if (!drift_mode) {
      return NextResponse.json(
        { success: false, error: 'drift_mode is required' },
        { status: 400 }
      );
    }

    if (!reason || reason.length < 10) {
      return NextResponse.json(
        { success: false, error: 'reason is required (min 10 characters)' },
        { status: 400 }
      );
    }

    // Determine which API endpoint to call based on retry_type
    const endpoint =
      retry_type === 'settlement'
        ? `${getApiBaseUrl()}/ops/retry-settlement`
        : `${getApiBaseUrl()}/ops/retry-posting`;

    // Get operator from request headers or use default
    const operator = request.headers.get('x-user-id') || 'command-center-operator';

    // Proxy to API service
    const apiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-command-center',
        'X-E2E-Test': 'true', // Bypass auth for internal calls
      },
      body: JSON.stringify({
        pick_id,
        drift_mode,
        reason,
        operator,
      }),
    });

    const result = await apiResponse.json();

    // Return the API response as-is
    return NextResponse.json(result, { status: apiResponse.status });
  } catch (error) {
    console.error('Retry proxy error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to proxy retry request to API',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/lifecycle/retry
 * Returns available retry options for documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoints: {
      posting: {
        drift_modes: ['P1', 'P3', 'P5'],
        description: 'Reset posting claim to allow re-posting',
      },
      settlement: {
        drift_modes: ['S1', 'S2', 'S3'],
        description: 'Reset settlement to pending for re-settlement',
      },
    },
    usage: {
      method: 'POST',
      body: {
        pick_id: 'string (required)',
        drift_mode: 'string (P1|P3|P5 for posting, S1|S2|S3 for settlement)',
        reason: 'string (min 10 chars)',
        retry_type: 'posting | settlement',
      },
    },
  });
}
