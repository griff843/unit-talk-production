/**
 * Risk Dashboard API Route
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * GET /api/risk/dashboard
 * Returns combined risk data: latest exposure snapshot, drift snapshot,
 * recent risk events, and current config.
 *
 * Queries risk tables directly via Supabase (read-only, matches CCC pattern).
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const eventsLimit = Math.min(parseInt(searchParams.get('events_limit') ?? '', 10) || 20, 100);

    const supabase = createClient();

    // Fetch all data in parallel
    const [latestEventResult, recentEventsResult, configResult, driftSnapshotResult] =
      await Promise.all([
        // Latest risk event with exposure + drift snapshots
        supabase
          .from('risk_events')
          .select('exposure_snapshot, drift_snapshot, config_snapshot, created_at')
          .not('exposure_snapshot', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1),

        // Recent risk events timeline
        supabase
          .from('risk_events')
          .select('id, event_type, severity, pick_id, decision, reason_codes, trace_id, created_at')
          .order('created_at', { ascending: false })
          .limit(eventsLimit),

        // Current config
        supabase
          .from('risk_engine_config')
          .select('config_key, config_value, description, updated_at'),

        // Latest drift snapshot from dedicated table
        supabase
          .from('drift_snapshots')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

    // Extract exposure + drift from latest risk event
    const latestEvent = latestEventResult.data?.[0] ?? null;
    const exposure = latestEvent?.exposure_snapshot ?? null;
    const driftFromEvent = latestEvent?.drift_snapshot ?? null;

    // Prefer drift_snapshots table if available, fall back to risk_events snapshot
    const driftSnapshot = driftSnapshotResult.data?.[0] ?? null;
    const drift = driftSnapshot
      ? {
          global_brier: driftSnapshot.brier_score,
          calibration_gap: driftSnapshot.calibration_gap,
          win_rate_actual: driftSnapshot.win_rate_actual,
          win_rate_predicted: driftSnapshot.win_rate_predicted,
          sample_size: driftSnapshot.sample_size,
          blocked: driftSnapshot.is_blocked,
          computed_at: driftSnapshot.computed_at,
        }
      : driftFromEvent;

    // Transform config rows to object
    const config: Record<string, { value: number; description: string | null }> = {};
    for (const row of configResult.data ?? []) {
      config[row.config_key] = {
        value: Number(row.config_value),
        description: row.description,
      };
    }

    // Count events by type for summary
    const events = recentEventsResult.data ?? [];
    const eventCounts: Record<string, number> = {};
    for (const ev of events) {
      eventCounts[ev.event_type] = (eventCounts[ev.event_type] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        exposure,
        drift,
        config,
        events,
        eventCounts,
        lastUpdated: latestEvent?.created_at ?? null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[RiskDashboard] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
