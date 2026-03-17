/**
 * Tests for picks proxy route.
 * Sprint: SPRINT-074-LAYER3-PHASE10-CC-PICK-MANAGEMENT
 *
 * Covers:
 *   1.  GET /api/picks → 401 when no auth
 *   2.  GET /api/picks → proxies picks list response
 *   3.  GET /api/picks → proxies empty picks
 *   4.  GET /api/picks → returns 503 + empty picks on upstream error
 *   5.  GET /api/picks → forwards upstream non-200 status code
 *   6.  GET /api/picks → forwards internal admin token to upstream
 *   7.  GET /api/picks?sport=nba → forwards sport query param
 *   8.  GET /api/picks?workflow_stage=approved → forwards workflow_stage param
 *   9.  GET /api/picks?limit=10 → forwards limit param
 *   10. GET /api/picks?hours=48 → forwards hours param
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Auth mock ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  requireOperatorIdentity: vi.fn(),
  getOperatorIdentity: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET } from '@/app/api/picks/route';
import { requireOperatorIdentity } from '@/lib/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(path = '/api/picks', userId?: string): NextRequest {
  const req = new NextRequest(`http://localhost${path}`);
  if (userId) {
    req.headers.set('x-user-id', userId);
  }
  return req;
}

const mockRequireOperatorIdentity = vi.mocked(requireOperatorIdentity);

function setAuth(userId: string | null) {
  if (userId) {
    mockRequireOperatorIdentity.mockReturnValue({ userId, source: 'header' });
  } else {
    mockRequireOperatorIdentity.mockReturnValue(null);
  }
}

const SAMPLE_PICKS = {
  success: true,
  data: [
    {
      id: 'pick-001',
      user_id: 'user-1',
      selection: 'LeBron James Over 25.5 Points',
      odds: -110,
      confidence: 80,
      workflow_stage: 'approved',
      settlement_status: 'pending',
      tier: 'S',
      sport: 'nba',
      promotion_band: 'HARD',
      professional_score: 8.5,
      created_at: '2026-03-17T10:00:00Z',
      users: { username: 'capper1', discord_id: 'disc-1', tier: 'S', capper_tier: 'S' },
    },
    {
      id: 'pick-002',
      user_id: 'user-2',
      selection: 'Patrick Mahomes Over 2.5 TDs',
      odds: -120,
      confidence: 65,
      workflow_stage: 'pending_review',
      settlement_status: 'pending',
      tier: 'A',
      sport: 'nfl',
      promotion_band: 'SOFT',
      professional_score: 6.2,
      created_at: '2026-03-17T09:30:00Z',
      users: { username: 'capper2', discord_id: 'disc-2', tier: 'A', capper_tier: 'A' },
    },
  ],
  metadata: {
    count: 2,
    sport: 'all',
    workflow_stage: 'all',
    timestamp: '2026-03-17T10:05:00Z',
    correlationId: 'picks-list-123',
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/picks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns 401 when no operator identity', async () => {
    setAuth(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('proxies picks list response from upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_PICKS), { status: 200 })
    );

    const res = await GET(makeRequest('/api/picks', 'op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].promotion_band).toBe('HARD');
    expect(body.data[0].professional_score).toBe(8.5);
    expect(body.data[1].promotion_band).toBe('SOFT');
  });

  it('proxies empty picks list', async () => {
    setAuth('op-1');
    const emptyPayload = {
      success: true,
      data: [],
      metadata: { count: 0, sport: 'all', workflow_stage: 'all', timestamp: '', correlationId: '' },
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(emptyPayload), { status: 200 })
    );

    const res = await GET(makeRequest('/api/picks', 'op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.metadata.count).toBe(0);
  });

  it('returns 503 with empty picks on upstream error', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await GET(makeRequest('/api/picks', 'op-1'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('PROXY_ERROR');
    expect(body.data.picks).toHaveLength(0);
  });

  it('forwards upstream non-200 status code', async () => {
    setAuth('op-1');
    const payload = { error: 'internal', data: [] };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 500 }));

    const res = await GET(makeRequest('/api/picks', 'op-1'));
    expect(res.status).toBe(500);
  });

  it('forwards internal admin token to upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_PICKS), { status: 200 })
    );

    await GET(makeRequest('/api/picks', 'op-1'));

    const [calledUrl, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/api/picks');
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Bearer /);
  });

  it('forwards sport query param to upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_PICKS), { status: 200 })
    );

    await GET(makeRequest('/api/picks?sport=nba', 'op-1'));

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('sport=nba');
  });

  it('forwards workflow_stage query param to upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_PICKS), { status: 200 })
    );

    await GET(makeRequest('/api/picks?workflow_stage=approved', 'op-1'));

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('workflow_stage=approved');
  });

  it('forwards limit query param to upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_PICKS), { status: 200 })
    );

    await GET(makeRequest('/api/picks?limit=10', 'op-1'));

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('limit=10');
  });

  it('forwards hours query param to upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_PICKS), { status: 200 })
    );

    await GET(makeRequest('/api/picks?hours=48', 'op-1'));

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('hours=48');
  });
});
