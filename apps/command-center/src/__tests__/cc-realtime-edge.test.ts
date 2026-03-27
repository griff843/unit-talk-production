/**
 * Tests for GET /api/realtime-edge route.
 * Sprint: SPRINT-081-LAYER3-PHASE10-CC-REALTIME-DASHBOARD
 *
 * Covers:
 *   1. Returns 401 when no operator identity
 *   2. Returns 503 when Supabase client is null
 *   3. Returns 200 with correct pipeline shape (empty picks)
 *   4. Correctly counts lifecycle stages from pick rows
 *   5. Correctly marks stale agents (last_heartbeat_at > 5 min ago)
 *   6. Returns 503 when Supabase query returns error
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Global mocks (must precede route import) ─────────────────────────────────

vi.mock('@/lib/auth', () => ({
  requireOperatorIdentity: vi.fn(),
  getOperatorIdentity: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

// ─── Route import (after mocks) ───────────────────────────────────────────────

import { GET } from '@/app/api/realtime-edge/route';
import { requireOperatorIdentity } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/realtime-edge');
}

const mockRequireOperatorIdentity = vi.mocked(requireOperatorIdentity);
const mockGetSupabaseClient = vi.mocked(getSupabaseClient);

function setAuth(userId: string | null) {
  if (userId) {
    mockRequireOperatorIdentity.mockReturnValue({ userId, source: 'header' });
  } else {
    mockRequireOperatorIdentity.mockReturnValue(null);
  }
}

type PickRow = { lifecycle_stage: string | null };
type AgentRow = { agent_name: string; status: string; last_heartbeat_at: string | null };

function makePicksChain(rows: PickRow[], error: { message: string } | null = null) {
  const notFn = vi.fn().mockResolvedValue({ data: error ? null : rows, error });
  const selectFn = vi.fn().mockReturnValue({ not: notFn });
  return { select: selectFn };
}

function makeAgentsChain(rows: AgentRow[], error: { message: string } | null = null) {
  const orderFn = vi.fn().mockResolvedValue({ data: error ? null : rows, error });
  const selectFn = vi.fn().mockReturnValue({ order: orderFn });
  return { select: selectFn };
}

function makeClient(
  pickRows: PickRow[],
  agentRows: AgentRow[],
  options?: { picksError?: { message: string } | null; agentsError?: { message: string } | null }
) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'unified_picks') {
        return makePicksChain(pickRows, options?.picksError ?? null);
      }
      if (table === 'agent_health') {
        return makeAgentsChain(agentRows, options?.agentsError ?? null);
      }
      return {};
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/realtime-edge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no operator identity', async () => {
    setAuth(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 503 when Supabase client is null', async () => {
    setAuth('op-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetSupabaseClient.mockReturnValue(null as any);
    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('Supabase unavailable');
  });

  it('returns 200 with correct pipeline shape when picks are empty', async () => {
    setAuth('op-1');
    const client = makeClient([], []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetSupabaseClient.mockReturnValue(client as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.pipeline).toBeDefined();
    expect(body.pipeline.submitted).toBe(0);
    expect(body.pipeline.graded).toBe(0);
    expect(body.pipeline.promoted).toBe(0);
    expect(body.pipeline.posted).toBe(0);
    expect(body.pipeline.settled).toBe(0);
    expect(body.pipeline.void).toBe(0);
    expect(body.pipeline.other).toBe(0);
    expect(body.pipeline.total).toBe(0);
    expect(body.agents).toBeDefined();
    expect(body.refreshedAt).toBeDefined();
  });

  it('correctly counts lifecycle stages from pick rows', async () => {
    setAuth('op-1');
    const pickRows: PickRow[] = [
      { lifecycle_stage: 'submitted' },
      { lifecycle_stage: 'submitted' },
      { lifecycle_stage: 'graded' },
      { lifecycle_stage: 'promoted' },
      { lifecycle_stage: 'unknown_stage' }, // should land in 'other'
    ];
    const client = makeClient(pickRows, []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetSupabaseClient.mockReturnValue(client as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.pipeline.submitted).toBe(2);
    expect(body.pipeline.graded).toBe(1);
    expect(body.pipeline.promoted).toBe(1);
    expect(body.pipeline.posted).toBe(0);
    expect(body.pipeline.other).toBe(1);
    expect(body.pipeline.total).toBe(5);
  });

  it('correctly marks stale agents (last_heartbeat_at older than 5 min)', async () => {
    setAuth('op-1');
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    const recentTime = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago

    const agentRows: AgentRow[] = [
      { agent_name: 'GradingAgent', status: 'healthy', last_heartbeat_at: recentTime },
      { agent_name: 'PostingAgent', status: 'healthy', last_heartbeat_at: staleTime },
      { agent_name: 'SettlementAgent', status: 'warning', last_heartbeat_at: recentTime },
    ];
    const client = makeClient([], agentRows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetSupabaseClient.mockReturnValue(client as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.agents.total).toBe(3);
    expect(body.agents.healthy).toBe(2);
    expect(body.agents.warning).toBe(1);
    expect(body.agents.error).toBe(0);
    expect(body.agents.stale).toBe(1); // PostingAgent is stale
  });

  it('returns 503 when Supabase picks query returns error', async () => {
    setAuth('op-1');
    const client = makeClient([], [], { picksError: { message: 'connection refused' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetSupabaseClient.mockReturnValue(client as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('connection refused');
  });
});
