/**
 * GET /api/burn-in/baseline
 * Returns database baseline counts for verification
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL_DEV!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY_DEV!;

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get count of autopilot_decisions
    const { count: autopilotCount, error: autopilotError } = await supabase
      .from('autopilot_decisions')
      .select('*', { count: 'exact', head: true });

    if (autopilotError) throw autopilotError;

    // Get count of alert_events
    const { count: alertCount, error: alertError } = await supabase
      .from('alert_events')
      .select('*', { count: 'exact', head: true });

    if (alertError) throw alertError;

    // Get count of pick_publish
    const { count: pickPublishCount, error: pickPublishError } = await supabase
      .from('pick_publish')
      .select('*', { count: 'exact', head: true });

    if (pickPublishError) throw pickPublishError;

    // Get count of recently updated picks (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: picksUpdatedRecent, error: picksError } = await supabase
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', fiveMinutesAgo);

    if (picksError) throw picksError;

    const baseline = {
      timestamp: new Date().toISOString(),
      autopilot_decisions: autopilotCount || 0,
      alert_events: alertCount || 0,
      pick_publish: pickPublishCount || 0,
      picks_updated_recent: picksUpdatedRecent || 0,
    };

    return NextResponse.json(baseline, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to query database baseline',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
