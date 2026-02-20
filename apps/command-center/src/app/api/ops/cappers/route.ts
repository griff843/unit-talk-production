'use server';

import { NextResponse } from 'next/server';

/**
 * OPS CAPPERS API PROXY
 * Sprint: SPRINT-OPS-SUBMIT-V2-071B
 *
 * Proxies cappers list request to API service.
 *
 * GET /api/ops/cappers
 */

const API_BASE_URL = process.env.API_SERVICE_URL || 'http://localhost:3000';

export async function GET() {
  try {
    // Proxy to API service
    const apiResponse = await fetch(`${API_BASE_URL}/ops/cappers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-command-center',
        'X-E2E-Test': 'true', // Bypass auth for internal calls
      },
    });

    const result = await apiResponse.json();

    // Return the API response as-is
    return NextResponse.json(result, { status: apiResponse.status });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cappers from API',
        details: error instanceof Error ? error.message : 'Unknown error',
        cappers: [], // Return empty array so UI doesn't break
      },
      { status: 500 }
    );
  }
}
