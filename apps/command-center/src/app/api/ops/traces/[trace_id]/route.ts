/* eslint-disable max-lines-per-function */
import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseClient } from '@/lib/supabase';

interface PickData {
  id: string;
  trace_id: string;
  bet_slip_id?: string;
  sport: string;
  stat_type?: string;
  selection: string;
  line?: number;
  odds: number;
  stake: number;
  confidence?: number;
  status: string;
  form_source: string;
  workflow_stage?: string;
  is_live?: boolean;
  created_at: string;
  updated_at: string;
  users?: { id: string; username: string; tier?: string; discord_id?: string };
}

interface PublishRecord {
  id: string;
  pick_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  discord_channel_id: string | null;
  discord_thread_id?: string | null;
  discord_message_id: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Determine overall lifecycle stage from picks
 */
function determineOverallLifecycle(picks: Array<{ publish?: PublishRecord | null }>): string {
  if (!picks.length) return 'unknown';

  const allPublished = picks.every(p => p.publish?.discord_message_id);
  if (allPublished) return 'discord_published';

  const anyFailed = picks.some(p => p.publish?.status === 'failed');
  if (anyFailed) return 'publish_failed';

  const anyProcessing = picks.some(p => p.publish?.status === 'processing');
  if (anyProcessing) return 'publishing';

  const allPending = picks.every(p => p.publish?.status === 'pending');
  if (allPending) return 'awaiting_publish';

  return 'pick_created';
}

/**
 * Transform pick data with publish info
 */
function transformPick(pick: PickData, publish: PublishRecord | undefined) {
  return {
    id: pick.id,
    trace_id: pick.trace_id,
    bet_slip_id: pick.bet_slip_id,
    sport: pick.sport,
    stat_type: pick.stat_type,
    selection: pick.selection,
    line: pick.line,
    odds: pick.odds,
    stake: pick.stake,
    confidence: pick.confidence,
    status: pick.status,
    form_source: pick.form_source,
    workflow_stage: pick.workflow_stage,
    is_live: pick.is_live,
    created_at: pick.created_at,
    updated_at: pick.updated_at,
    capper: {
      id: pick.users?.id,
      username: pick.users?.username || 'Unknown',
      tier: pick.users?.tier,
      discord_id: pick.users?.discord_id,
    },
    publish: publish
      ? {
          id: publish.id,
          status: publish.status,
          attempts: publish.attempts,
          max_attempts: publish.max_attempts,
          discord_channel_id: publish.discord_channel_id,
          discord_thread_id: publish.discord_thread_id,
          discord_message_id: publish.discord_message_id,
          last_error: publish.last_error,
          created_at: publish.created_at,
          updated_at: publish.updated_at,
        }
      : null,
  };
}

/**
 * GET /api/ops/traces/[trace_id] - Returns detailed trace info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trace_id: string }> }
) {
  const startTime = Date.now();
  const { trace_id } = await params;

  if (!trace_id) {
    return NextResponse.json({ error: 'Missing trace_id parameter' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection unavailable' }, { status: 503 });
  }

  // Fetch picks
  const { data: picks, error: picksError } = await supabase
    .from('unified_picks')
    .select(
      `
      id, trace_id, bet_slip_id, sport, stat_type, selection, line, odds, stake, confidence,
      status, form_source, workflow_stage, is_live, created_at, updated_at,
      users!unified_picks_user_id_fkey (id, username, tier, discord_id)
    `
    )
    .eq('trace_id', trace_id);

  if (picksError) {
    return NextResponse.json(
      { error: 'Failed to fetch picks', message: picksError.message },
      { status: 500 }
    );
  }

  if (!picks?.length) {
    return NextResponse.json(
      { error: 'Trace not found', message: `No picks found with trace_id: ${trace_id}` },
      { status: 404 }
    );
  }

  // Fetch publish records
  const pickIds = picks.map((p: PickData) => p.id);
  const { data: publishRecords } = await supabase
    .from('pick_publish')
    .select(
      'id, pick_id, status, attempts, max_attempts, discord_channel_id, discord_thread_id, discord_message_id, last_error, created_at, updated_at'
    )
    .in('pick_id', pickIds);

  const publishByPickId = new Map((publishRecords || []).map((p: PublishRecord) => [p.pick_id, p]));
  const detailedPicks = picks.map((pick: PickData) =>
    transformPick(pick, publishByPickId.get(pick.id))
  );

  // Build Discord links
  const discordLinks = (publishRecords || [])
    .filter((p: PublishRecord) => p.discord_message_id && p.discord_channel_id)
    .map((p: PublishRecord) => ({
      pick_id: p.pick_id,
      channel_id: p.discord_channel_id,
      message_id: p.discord_message_id,
      link: `https://discord.com/channels/@me/${p.discord_channel_id}/${p.discord_message_id}`,
    }));

  return NextResponse.json({
    trace_id,
    lifecycle_stage: determineOverallLifecycle(detailedPicks),
    picks: detailedPicks,
    publish_records: publishRecords || [],
    bridge_events: [],
    discord_links: discordLinks,
    summary: {
      pick_count: picks.length,
      publish_count: (publishRecords || []).length,
      bridge_event_count: 0,
      discord_published: discordLinks.length,
      created_at: picks[0]?.created_at,
    },
    query_ms: Date.now() - startTime,
  });
}
