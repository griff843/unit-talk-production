import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseClient } from '@/lib/supabase';

interface TracePickData {
  id: string;
  trace_id: string;
  bet_slip_id?: string;
  sport: string;
  selection: string;
  odds: number;
  stake: number;
  status: string;
  form_source: string;
  created_at: string;
  users?: { username?: string };
}

interface PublishData {
  id: string;
  pick_id: string;
  status: string;
  attempts: number;
  discord_channel_id: string | null;
  discord_message_id: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * Determine the lifecycle stage of a trace
 */
function determineLifecycleStage(pick: TracePickData, publish: PublishData | null): string {
  if (!pick) return 'unknown';

  if (publish) {
    const statusMap: Record<string, string> = {
      sent: 'discord_published',
      processing: 'publishing',
      failed: 'publish_failed',
      pending: 'awaiting_publish',
    };
    if (statusMap[publish.status]) return statusMap[publish.status];
  }

  const pickStatusMap: Record<string, string> = {
    pending: 'pick_created',
    approved: 'pick_approved',
    settled: 'pick_settled',
  };
  return pickStatusMap[pick.status] || 'pick_created';
}

/**
 * Fetch picks with trace_id from unified_picks
 */
async function fetchPicks(supabase: ReturnType<typeof getSupabaseClient>, limit: number) {
  if (!supabase) return { picks: [], error: 'No client' };

  const { data, error } = await supabase
    .from('unified_picks')
    .select(
      `
      id, trace_id, sport, selection, odds, stake, status, form_source, created_at, updated_at,
      users!unified_picks_user_id_fkey (id, username, tier)
    `
    )
    .not('trace_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { picks: data || [], error: error?.message };
}

/**
 * Fetch publish records for given pick IDs
 */
async function fetchPublishRecords(
  supabase: ReturnType<typeof getSupabaseClient>,
  pickIds: string[],
  statusFilter?: string | null
) {
  if (!supabase || pickIds.length === 0) return [];

  let query = supabase
    .from('pick_publish')
    .select(
      'id, pick_id, status, attempts, discord_channel_id, discord_message_id, created_at, updated_at, metadata'
    )
    .in('pick_id', pickIds);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data } = await query;
  return data || [];
}

/**
 * Build trace records from picks and publish data
 */
function buildTraceRecords(picks: TracePickData[], publishData: PublishData[]) {
  const publishByPickId = new Map(publishData.map(p => [p.pick_id, p]));

  return picks.map(pick => {
    const publish = publishByPickId.get(pick.id);
    return {
      trace_id: pick.trace_id,
      pick: {
        id: pick.id,
        sport: pick.sport,
        selection: pick.selection,
        odds: pick.odds,
        stake: pick.stake,
        status: pick.status,
        form_source: pick.form_source,
        created_at: pick.created_at,
        capper: pick.users?.username || 'Unknown',
      },
      publish: publish
        ? {
            id: publish.id,
            status: publish.status,
            attempts: publish.attempts,
            discord_channel_id: publish.discord_channel_id,
            discord_message_id: publish.discord_message_id,
            created_at: publish.created_at,
            updated_at: publish.updated_at,
          }
        : null,
      bridge_events: 0,
      lifecycle_stage: determineLifecycleStage(pick, publish ?? null),
      created_at: pick.created_at,
    };
  });
}

/**
 * GET /api/ops/traces - Returns recent traces for Live Trace UI
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const statusFilter = searchParams.get('status');

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection unavailable' }, { status: 503 });
  }

  const { picks, error: picksError } = await fetchPicks(supabase, limit);
  if (picksError) {
    return NextResponse.json(
      { error: 'Failed to fetch picks', message: picksError },
      { status: 500 }
    );
  }

  const pickIds = picks.map((p: TracePickData) => p.id);
  const publishData = await fetchPublishRecords(supabase, pickIds, statusFilter);
  const traces = buildTraceRecords(picks, publishData);

  const filteredTraces = statusFilter
    ? traces.filter(t => t.publish?.status === statusFilter)
    : traces;

  return NextResponse.json({
    traces: filteredTraces,
    count: filteredTraces.length,
    query_ms: Date.now() - startTime,
  });
}
