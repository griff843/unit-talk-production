/**
 * CC Route: GET /api/realtime-edge
 *
 * SPRINT-081-LAYER3-PHASE10-CC-REALTIME-DASHBOARD
 * Layer/Phase: Layer 3 / Phase 10 — Command Center UX
 *
 * Queries Supabase directly for live operational state:
 *   1. Pick lifecycle stage distribution (unified_picks.lifecycle_stage)
 *   2. Agent health summary with stale detection (agent_health)
 *
 * Auth: requireOperatorIdentity (JWT) — no unauthenticated access.
 * CC MUST NOT write to any business table — read-only.
 */

import { type NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_STAGES = ['submitted', 'graded', 'promoted', 'posted', 'settled', 'void'] as const;
type KnownStage = (typeof KNOWN_STAGES)[number];

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchPipelineCounts(client: any): Promise<Record<string, number>> {
  const { data, error } = await client
    .from('unified_picks')
    .select('lifecycle_stage')
    .not('lifecycle_stage', 'is', null);

  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {
    submitted: 0,
    graded: 0,
    promoted: 0,
    posted: 0,
    settled: 0,
    void: 0,
    other: 0,
  };

  const rows = (data ?? []) as Array<{ lifecycle_stage: string }>;
  for (const row of rows) {
    const stage = row.lifecycle_stage as KnownStage;
    if ((KNOWN_STAGES as readonly string[]).includes(stage)) {
      counts[stage]++;
    } else {
      counts['other']++;
    }
  }

  counts['total'] = rows.length;
  return counts;
}

interface AgentSummary {
  total: number;
  healthy: number;
  warning: number;
  error: number;
  stale: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAgentSummary(client: any): Promise<AgentSummary> {
  const { data, error } = await client
    .from('agent_health')
    .select('agent_name, status, last_heartbeat_at')
    .order('agent_name');

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    agent_name: string;
    status: string;
    last_heartbeat_at: string | null;
  }>;

  const staleThreshold = Date.now() - STALE_THRESHOLD_MS;
  let healthy = 0;
  let warning = 0;
  let errored = 0;
  let stale = 0;

  for (const agent of rows) {
    const heartbeatMs = agent.last_heartbeat_at ? new Date(agent.last_heartbeat_at).getTime() : 0;
    if (heartbeatMs < staleThreshold) stale++;
    if (agent.status === 'healthy') healthy++;
    else if (agent.status === 'warning') warning++;
    else if (agent.status === 'error') errored++;
  }

  return { total: rows.length, healthy, warning, error: errored, stale };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const client = getSupabaseClient();
  if (!client) {
    return NextResponse.json({ success: false, error: 'Supabase unavailable' }, { status: 503 });
  }

  try {
    const [pipeline, agents] = await Promise.all([
      fetchPipelineCounts(client),
      fetchAgentSummary(client),
    ]);

    return NextResponse.json({
      success: true,
      pipeline,
      agents,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Query failed' },
      { status: 503 }
    );
  }
}
