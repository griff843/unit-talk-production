/**
 * Tests for capper-performance proxy route.
 * Sprint: SPRINT-075-LAYER3-PHASE10-CC-CAPPER-DASHBOARD
 *
 * Covers:
 *   1.  GET /api/capper-performance → 401 when no auth
 *   2.  GET /api/capper-performance → proxies capper list response
 *   3.  GET /api/capper-performance → proxies empty cappers list
 *   4.  GET /api/capper-performance → returns 503 + empty cappers on upstream error
 *   5.  GET /api/capper-performance → forwards upstream non-200 status code
 *   6.  GET /api/capper-performance → forwards internal admin token to upstream
 *   7.  GET /api/capper-performance?window=30 → forwards window query param
 *   8.  GET /api/capper-performance?capper_id=<id> → forwards capper_id query param
 *   9.  GET /api/capper-performance → response includes win_rate and roi fields
 *   10. GET /api/capper-performance → proxies capper streak data
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Auth mock ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  requireOperatorIdentity: vi.fn(),
  getOperatorIdentity: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET } from '@/app/api/capper-performance/route';
import { requireOperatorIdentity } from '@/lib/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(path = '/api/capper-performance', userId?: string): NextRequest {
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

const SAMPLE_CAPPERS = {
  success: true,
  data: [
    {
      capper_id: 'capper-001',
      username: 'sharpbetter',
      tier: 'S',
      active: true,
      rolling_window_days: 10,
      stats: {
        picks: 42,
        wins: 28,
        losses: 12,
        pushes: 2,
        units_wagered: 84,
        units_profit: 16.8,
        win_rate: 70.0,
        roi: 20.0,
      },
      streak: { type: 'win', length: 5 },
    },
    {
      capper_id: 'capper-002',
      username: 'valuehunter',
      tier: 'A',
      active: true,
      rolling_window_days: 10,
      stats: {
        picks: 18,
        wins: 10,
        losses: 8,
        pushes: 0,
        units_wagered: 36,
        units_profit: -1.8,
        win_rate: 55.6,
        roi: -5.0,
      },
      streak: { type: 'loss', length: 2 },
    },
  ],
  metadata: {
    count: 2,
    window_days: 10,
    timestamp: '2026-03-17T10:00:00Z',
    correlationId: 'cappers-123',
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/capper-performance', () => {
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

  it('proxies capper list response from upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_CAPPERS), { status: 200 })
    );

    const res = await GET(makeRequest('/api/capper-performance', 'op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].username).toBe('sharpbetter');
    expect(body.data[1].username).toBe('valuehunter');
  });

  it('proxies empty cappers list', async () => {
    setAuth('op-1');
    const emptyPayload = {
      success: true,
      data: [],
      metadata: { count: 0, window_days: 10, timestamp: '', correlationId: '' },
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(emptyPayload), { status: 200 })
    );

    const res = await GET(makeRequest('/api/capper-performance', 'op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.metadata.count).toBe(0);
  });

  it('returns 503 with empty cappers on upstream error', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await GET(makeRequest('/api/capper-performance', 'op-1'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('PROXY_ERROR');
    expect(body.data.cappers).toHaveLength(0);
  });

  it('forwards upstream non-200 status code', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'internal' }), { status: 500 })
    );

    const res = await GET(makeRequest('/api/capper-performance', 'op-1'));
    expect(res.status).toBe(500);
  });

  it('forwards internal admin token to upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_CAPPERS), { status: 200 })
    );

    await GET(makeRequest('/api/capper-performance', 'op-1'));

    const [calledUrl, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/api/cappers');
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Bearer /);
  });

  it('forwards window query param to upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_CAPPERS), { status: 200 })
    );

    await GET(makeRequest('/api/capper-performance?window=30', 'op-1'));

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('window=30');
  });

  it('forwards capper_id query param to upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_CAPPERS), { status: 200 })
    );

    await GET(makeRequest('/api/capper-performance?capper_id=capper-001', 'op-1'));

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('capper_id=capper-001');
  });

  it('response includes win_rate and roi fields', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_CAPPERS), { status: 200 })
    );

    const res = await GET(makeRequest('/api/capper-performance', 'op-1'));
    const body = await res.json();
    expect(body.data[0].stats.win_rate).toBe(70.0);
    expect(body.data[0].stats.roi).toBe(20.0);
    expect(body.data[1].stats.roi).toBe(-5.0);
  });

  it('proxies capper streak data', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_CAPPERS), { status: 200 })
    );

    const res = await GET(makeRequest('/api/capper-performance', 'op-1'));
    const body = await res.json();
    expect(body.data[0].streak).toEqual({ type: 'win', length: 5 });
    expect(body.data[1].streak).toEqual({ type: 'loss', length: 2 });
  });
});
