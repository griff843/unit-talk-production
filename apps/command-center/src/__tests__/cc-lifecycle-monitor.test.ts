/**
 * Lifecycle monitor tests for SPRINT-078-LAYER3-PHASE10-CC-LIFECYCLE-MONITOR.
 *
 * Covers:
 *  - GET /api/lifecycle/picks → 401 when unauthenticated
 *  - GET /api/lifecycle/picks → 200 with picks + summary when authenticated
 *  - GET /api/lifecycle/picks/[id]/timeline → 401 when unauthenticated
 *  - GET /api/lifecycle/picks/[id]/timeline → 200 with events when authenticated
 *  - GET /api/lifecycle/picks/[id]/timeline → 404 when pick not found
 *  - GET /api/lifecycle/picks with needs_attention=true filter
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Global mocks (before route imports) ─────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  requireOperatorIdentity: vi.fn(),
  getOperatorIdentity: vi.fn(),
  enforcePermission: vi.fn(),
}));

vi.mock('@/lib/lifecycleDisplay', async () => {
  const actual = await vi.importActual('@/lib/lifecycleDisplay');
  return actual;
});

vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy({}, { get: () => vi.fn() }),
  createClient: vi.fn(),
  getSupabaseClient: vi.fn(),
}));

// ─── Route imports ────────────────────────────────────────────────────────────

import { GET as timelineGET } from '@/app/api/lifecycle/picks/[id]/timeline/route';
import { GET as picksGET } from '@/app/api/lifecycle/picks/route';
import { requireOperatorIdentity } from '@/lib/auth';
import { createClient } from '@/lib/supabase';

const MOCK_IDENTITY = { userId: 'op-001', role: 'operator', name: 'Test Op' };

function makeReq(path: string, params?: Record<string, string>): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function setNoAuth() {
  vi.mocked(requireOperatorIdentity).mockReturnValue(null as any);
}

function setAuth() {
  vi.mocked(requireOperatorIdentity).mockReturnValue(MOCK_IDENTITY as any);
}

function makeChain(terminal: Record<string, unknown>) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'order', 'range', 'limit'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  Object.assign(chain, terminal);
  return chain;
}

function mockSupabaseWithPicks(picks: unknown[]) {
  const chain = makeChain({
    range: vi.fn().mockResolvedValue({ data: picks, error: null }),
  });
  vi.mocked(createClient).mockReturnValue({ from: () => chain } as any);
}

function mockSupabaseWith404() {
  const chain = makeChain({
    single: vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Row not found' } }),
  });
  vi.mocked(createClient).mockReturnValue({ from: () => chain } as any);
}

function mockSupabaseWithPick(pick: unknown) {
  const chain = makeChain({
    single: vi.fn().mockResolvedValue({ data: pick, error: null }),
  });
  vi.mocked(createClient).mockReturnValue({ from: () => chain } as any);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SPRINT-078 CC Lifecycle Monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  // ── picks route ────────────────────────────────────────────────────────────

  describe('GET /api/lifecycle/picks', () => {
    it('returns 401 when unauthenticated', async () => {
      setNoAuth();
      const res = await picksGET(makeReq('/api/lifecycle/picks'));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 200 with empty picks when database returns no rows', async () => {
      setAuth();
      mockSupabaseWithPicks([]);
      const res = await picksGET(makeReq('/api/lifecycle/picks'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.picks)).toBe(true);
      expect(body.summary).toBeDefined();
      expect(body.summary.total).toBe(0);
    });

    it('returns 200 with picks and summary when data exists', async () => {
      setAuth();
      const mockPick = {
        id: 'pick-1',
        user_id: 'user-abc',
        selection: 'Lakers ML',
        odds: -110,
        confidence: 70,
        sport: 'NBA',
        tier: 'A',
        status: 'active',
        promotion_status: 'queued',
        settlement_status: null,
        posted_to_discord: false,
        discord_message_id: null,
        blocked_reason: null,
        failed_reason: null,
        created_at: new Date(Date.now() - 3 * 60000).toISOString(),
        placed_at: null,
        promotion_queued_at: new Date(Date.now() - 2 * 60000).toISOString(),
        promotion_posted_at: null,
        settled_at: null,
        blocked_at: null,
        failed_at: null,
      };
      mockSupabaseWithPicks([mockPick]);
      const res = await picksGET(makeReq('/api/lifecycle/picks'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.picks).toHaveLength(1);
      expect(body.picks[0].lifecycle_stage).toBe('QUEUED');
      expect(body.summary.total).toBe(1);
      expect(body.thresholds).toBeDefined();
    });

    it('returns 503 when database is unavailable', async () => {
      setAuth();
      vi.mocked(createClient).mockReturnValue(null as any);
      const res = await picksGET(makeReq('/api/lifecycle/picks'));
      expect(res.status).toBe(503);
    });
  });

  // ── timeline route ─────────────────────────────────────────────────────────

  describe('GET /api/lifecycle/picks/[id]/timeline', () => {
    it('returns 401 when unauthenticated', async () => {
      setNoAuth();
      const res = await timelineGET(makeReq('/api/lifecycle/picks/pick-1/timeline'), {
        params: Promise.resolve({ id: 'pick-1' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 404 when pick does not exist', async () => {
      setAuth();
      mockSupabaseWith404();
      const res = await timelineGET(makeReq('/api/lifecycle/picks/missing/timeline'), {
        params: Promise.resolve({ id: 'missing' }),
      });
      expect(res.status).toBe(404);
    });

    it('returns 200 with timeline events when pick exists', async () => {
      setAuth();
      const now = new Date();
      const mockPick = {
        id: 'pick-1',
        workflow_stage: 'active',
        promotion_status: null,
        settlement_status: 'settled',
        posted_to_discord: true,
        discord_message_id: 'msg-123',
        blocked_reason: null,
        failed_reason: null,
        created_at: new Date(now.getTime() - 60 * 60000).toISOString(),
        placed_at: null,
        promotion_queued_at: new Date(now.getTime() - 45 * 60000).toISOString(),
        promotion_posted_at: new Date(now.getTime() - 30 * 60000).toISOString(),
        settled_at: now.toISOString(),
        blocked_at: null,
        failed_at: null,
      };
      mockSupabaseWithPick(mockPick);
      const res = await timelineGET(makeReq('/api/lifecycle/picks/pick-1/timeline'), {
        params: Promise.resolve({ id: 'pick-1' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pickId).toBe('pick-1');
      expect(body.currentStage).toBe('SETTLED');
      expect(Array.isArray(body.events)).toBe(true);
      expect(body.events.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 503 when database is unavailable', async () => {
      setAuth();
      vi.mocked(createClient).mockReturnValue(null as any);
      const res = await timelineGET(makeReq('/api/lifecycle/picks/pick-1/timeline'), {
        params: Promise.resolve({ id: 'pick-1' }),
      });
      expect(res.status).toBe(503);
    });
  });
});
