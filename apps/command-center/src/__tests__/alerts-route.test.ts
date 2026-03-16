/**
 * Tests for alerts proxy route.
 * Sprint: SPRINT-061-LAYER3-PHASE10-CC-ALERT-DASHBOARD
 *
 * Covers:
 *   1.  GET /api/alerts → 401 when no auth
 *   2.  GET /api/alerts → proxies active alerts response
 *   3.  GET /api/alerts → proxies empty alerts (no active alerts)
 *   4.  GET /api/alerts → returns 503 + empty alerts on upstream error
 *   5.  GET /api/alerts → forwards upstream non-200 status code
 *   6.  GET /api/alerts → forwards internal admin token to upstream
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Auth mock ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  requireOperatorIdentity: vi.fn(),
  getOperatorIdentity: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET } from '@/app/api/alerts/route';
import { requireOperatorIdentity } from '@/lib/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(userId?: string): NextRequest {
  const req = new NextRequest('http://localhost/api/alerts');
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

const SAMPLE_ALERTS = {
  alerts: [
    {
      id: 'alert-001',
      ruleId: 'rule-grading-latency',
      title: 'Grading latency elevated',
      description: 'Grading p50 exceeds threshold',
      severity: 'critical',
      timestamp: '2026-03-16T10:00:00Z',
      value: 450,
      threshold: 300,
      status: 'active',
      channels: ['discord'],
      tags: ['grading'],
      metadata: {},
    },
    {
      id: 'alert-002',
      ruleId: 'rule-feed-lag',
      title: 'Feed lag detected',
      description: 'Ingestion lag above normal',
      severity: 'info',
      timestamp: '2026-03-16T10:05:00Z',
      value: 90,
      threshold: 60,
      status: 'active',
      channels: [],
      tags: ['feed'],
      metadata: {},
    },
  ],
  meta: {
    total: 2,
    bySeverity: { info: 1, warning: 0, critical: 1 },
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/alerts', () => {
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

  it('proxies active alerts response from upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_ALERTS), { status: 200 })
    );

    const res = await GET(makeRequest('op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alerts).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    expect(body.meta.bySeverity.critical).toBe(1);
    expect(body.meta.bySeverity.info).toBe(1);
  });

  it('proxies empty alerts when no active alerts', async () => {
    setAuth('op-1');
    const emptyPayload = {
      alerts: [],
      meta: { total: 0, bySeverity: { info: 0, warning: 0, critical: 0 } },
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(emptyPayload), { status: 200 })
    );

    const res = await GET(makeRequest('op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alerts).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  it('returns 503 with empty alerts on upstream error', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await GET(makeRequest('op-1'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('PROXY_ERROR');
    expect(body.data.alerts).toHaveLength(0);
  });

  it('forwards upstream non-200 status code', async () => {
    setAuth('op-1');
    const payload = { error: 'internal', alerts: [] };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 500 }));

    const res = await GET(makeRequest('op-1'));
    expect(res.status).toBe(500);
  });

  it('forwards internal admin token to upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_ALERTS), { status: 200 })
    );

    await GET(makeRequest('op-1'));

    const [calledUrl, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/ops/alerts');
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Bearer /);
  });
});
