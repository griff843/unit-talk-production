/**
 * Tests for settlement console API routes.
 * Sprint: SPRINT-079-LAYER3-PHASE10-CC-SETTLEMENT-CONSOLE
 *
 * GET /api/settlement:
 *   1. 401 when unauthenticated
 *   2. 200 with empty picks when no unsettled picks
 *   3. 200 with picks array and count
 *   4. 503 when Supabase client unavailable
 *   5. filters results by sport query param
 *
 * POST /api/settlement:
 *   6. 401 when unauthenticated
 *   7. 400 when pick_id is missing
 *   8. 400 when result is invalid (not win/loss/push)
 *   9. 422 when RPC rejects settlement
 *   10. 200 when RPC succeeds
 *   11. 503 when Supabase client unavailable (POST)
 */

import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  requireOperatorIdentity: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET, POST } from '@/app/api/settlement/route';
import { requireOperatorIdentity } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockAuth = vi.mocked(requireOperatorIdentity);
const mockGetSupabase = vi.mocked(getSupabaseClient);

function setAuth(userId: string | null) {
  if (userId) {
    mockAuth.mockReturnValue({ userId, source: 'header' });
  } else {
    mockAuth.mockReturnValue(null);
  }
}

function makeGetRequest(path = '/api/settlement'): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/settlement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Creates a chainable Supabase query mock where every fluent method returns
 * the same chain object. The terminal `{ data, error }` is applied last via
 * Object.assign so the `await query` expression resolves correctly.
 */
function makeChain(terminal: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'or', 'order', 'limit', 'eq'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  Object.assign(chain, terminal);
  return chain;
}

const SAMPLE_PICKS = [
  {
    id: 'pick-001',
    player_name: 'LeBron James',
    stat_type: 'Points',
    line: 25.5,
    side: 'over',
    sport: 'nba',
    odds: -110,
    confidence: 80,
    professional_score: 8.5,
    promotion_band: 'HARD',
    bet_type: 'single',
    market: 'points',
    capper_id: 'capper-1',
    created_at: '2026-03-17T10:00:00Z',
  },
  {
    id: 'pick-002',
    player_name: 'Patrick Mahomes',
    stat_type: 'Touchdowns',
    line: 2.5,
    side: 'over',
    sport: 'nfl',
    odds: -120,
    confidence: 65,
    professional_score: 6.2,
    promotion_band: 'SOFT',
    bet_type: 'single',
    market: 'touchdowns',
    capper_id: 'capper-2',
    created_at: '2026-03-17T09:30:00Z',
  },
];

// ─── Tests: GET /api/settlement ───────────────────────────────────────────────

describe('GET /api/settlement', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setAuth(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 200 with empty picks when no unsettled picks', async () => {
    setAuth('op-1');
    const chain = makeChain({ data: [], error: null });
    mockGetSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.picks).toHaveLength(0);
    expect(body.count).toBe(0);
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns 200 with picks array and count', async () => {
    setAuth('op-1');
    const chain = makeChain({ data: SAMPLE_PICKS, error: null });
    mockGetSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.picks).toHaveLength(2);
    expect(body.count).toBe(2);
    expect(body.picks[0].player_name).toBe('LeBron James');
    expect(body.picks[0].promotion_band).toBe('HARD');
  });

  it('returns 503 when Supabase client unavailable', async () => {
    setAuth('op-1');
    mockGetSupabase.mockReturnValue(null as any);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(Array.isArray(body.picks)).toBe(true);
  });

  it('filters results by sport query param', async () => {
    setAuth('op-1');
    const nbaOnly = SAMPLE_PICKS.filter(p => p.sport === 'nba');
    const chain = makeChain({ data: nbaOnly, error: null });
    mockGetSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any);

    const res = await GET(makeGetRequest('/api/settlement?sport=nba'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.picks).toHaveLength(1);
    expect(body.picks[0].sport).toBe('nba');
    // Verify .eq('sport', 'nba') was called on the chain
    expect(vi.mocked(chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('sport', 'nba');
  });
});

// ─── Tests: POST /api/settlement ─────────────────────────────────────────────

describe('POST /api/settlement', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setAuth(null);
    const res = await POST(makePostRequest({ pick_id: 'p1', result: 'win' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when pick_id is missing', async () => {
    setAuth('op-1');
    mockGetSupabase.mockReturnValue({ rpc: vi.fn() } as any);

    const res = await POST(makePostRequest({ result: 'win' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('pick_id');
  });

  it('returns 400 when result is invalid', async () => {
    setAuth('op-1');
    mockGetSupabase.mockReturnValue({ rpc: vi.fn() } as any);

    const res = await POST(makePostRequest({ pick_id: 'p1', result: 'invalid_result' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('result');
  });

  it('returns 422 when RPC rejects settlement', async () => {
    setAuth('op-1');
    const rpcFn = vi.fn().mockResolvedValue({
      data: { success: false, error: 'Pick already settled' },
      error: null,
    });
    mockGetSupabase.mockReturnValue({ rpc: rpcFn } as any);

    const res = await POST(makePostRequest({ pick_id: 'p1', result: 'win' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Pick already settled');
  });

  it('returns 200 when RPC succeeds', async () => {
    setAuth('op-1');
    const rpcFn = vi.fn().mockResolvedValue({
      data: { success: true, pick_id: 'p1', result: 'win', settled_at: '2026-03-17T12:00:00Z' },
      error: null,
    });
    mockGetSupabase.mockReturnValue({ rpc: rpcFn } as any);

    const res = await POST(
      makePostRequest({ pick_id: 'p1', result: 'win', actual_value: 26.0, notes: 'Test settle' })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.pick_id).toBe('p1');
    expect(body.result).toBe('win');
    expect(typeof body.timestamp).toBe('string');
    // Verify RPC was called with correct args
    expect(rpcFn).toHaveBeenCalledWith(
      'manual_settle_pick',
      expect.objectContaining({
        p_pick_id: 'p1',
        p_result: 'win',
        p_meta: expect.objectContaining({ actual_value: 26.0, notes: 'Test settle' }),
      })
    );
  });

  it('returns 503 when Supabase client unavailable', async () => {
    setAuth('op-1');
    mockGetSupabase.mockReturnValue(null as any);

    const res = await POST(makePostRequest({ pick_id: 'p1', result: 'win' }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
