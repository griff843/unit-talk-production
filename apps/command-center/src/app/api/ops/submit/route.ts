'use server';

import { NextRequest, NextResponse } from 'next/server';

import { getOperatorIdentity } from '@/lib/auth';

/**
 * OPS SUBMIT API PROXY
 * Sprint: SPRINT-OPS-SUBMIT-V2-071B
 *
 * Proxies submit requests to API service.
 * Command Center remains READ-ONLY - no direct DB writes here.
 *
 * POST /api/ops/submit
 */

// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function getApiBaseUrl(): string {
  return process.env.API_SERVICE_URL || 'http://localhost:3000';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get operator from request headers or use default
    const { userId: operator } = getOperatorIdentity(request);

    // Proxy to API service
    const apiResponse = await fetch(`${getApiBaseUrl()}/ops/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-command-center',
        'X-E2E-Test': 'true', // Bypass auth for internal calls
      },
      body: JSON.stringify({
        ...body,
        operator,
      }),
    });

    const result = await apiResponse.json();

    // Return the API response as-is
    return NextResponse.json(result, { status: apiResponse.status });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to proxy submit request to API',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ops/submit
 * Returns usage documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/ops/submit',
    description: 'Submit a pick/ticket via Ops Submit RPC',
    usage: {
      method: 'POST',
      required_fields: {
        capper_id: 'UUID - Capper to attribute the pick to',
        sport: 'string - Sport (NFL, NBA, etc.)',
        picks: 'array - At least one pick with selection and odds',
      },
      optional_fields: {
        capper_username: 'string - Capper username',
        ticket_type: 'straight | parlay (default: straight)',
        manual_matchup_home: 'string - Home team',
        manual_matchup_away: 'string - Away team',
        manual_game_date: 'string - Game date (YYYY-MM-DD)',
        parlay_odds: 'number - Parlay odds (for parlays)',
        total_units: 'number - Total units wagered',
        notes: 'string - Optional notes',
        idempotency_key: 'string - Custom idempotency key',
      },
      pick_fields: {
        selection: 'string (required) - e.g., "KC -3.5"',
        odds: 'number (required) - e.g., -110',
        line: 'number - e.g., -3.5',
        stat_type: 'string - spread|total|moneyline|player_prop|etc.',
        side: 'string - over|under|home|away|favorite|underdog',
        confidence: 'number - 0-100',
        units: 'number - e.g., 1.0',
      },
    },
  });
}
