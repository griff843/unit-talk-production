/**
 * Discord Routing Status Proxy
 *
 * SPRINT-END-TO-END-TICKET-LIFECYCLE-TRUTH-093
 *
 * Proxies requests from the browser to the API server's /ops/discord-routing-status endpoint.
 * Required because browser-side code cannot directly access the API server.
 *
 * Returns the same response structure as the API endpoint, enabling Smart Form
 * to show routing health warnings and block submission if routing is unhealthy.
 */

import { NextResponse } from 'next/server';

// Default response for unhealthy state (fail-closed)
const UNHEALTHY_RESPONSE = {
  success: false,
  routing: {
    channel_from_db: false,
    channel_from_env: false,
    channel_id_resolved: false,
    webhook_configured: false,
  },
  worker: {
    configured: false,
    healthy: false,
    health_status: 'unhealthy' as const,
    worker_id: null,
    last_heartbeat_at: null,
    heartbeat_age_seconds: null,
    recent_error: { message: null, timestamp: null },
  },
  queue: { pending_count: 0, processing_count: 0, posted_count: 0, failed_count: 0 },
  activity: { last_post_at: null, items_processed_total: 0 },
  overall_health: 'unhealthy' as const,
  timestamp: new Date().toISOString(),
};

export async function GET() {
  const apiBaseUrl =
    process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${apiBaseUrl}/ops/discord-routing-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Short timeout to avoid blocking UI
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error('[discord-routing-status] API returned error:', response.status);
      return NextResponse.json(
        { ...UNHEALTHY_RESPONSE, error: `API error: ${response.status}` },
        { status: 503 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(
      '[discord-routing-status] Proxy error:',
      error instanceof Error ? error.message : error
    );

    // Return unhealthy status on any error (fail-closed)
    return NextResponse.json(
      {
        ...UNHEALTHY_RESPONSE,
        error: error instanceof Error ? error.message : 'Unknown error',
        worker: {
          ...UNHEALTHY_RESPONSE.worker,
          recent_error: {
            message: error instanceof Error ? error.message : 'Proxy connection failed',
            timestamp: new Date().toISOString(),
          },
        },
      },
      { status: 503 }
    );
  }
}
