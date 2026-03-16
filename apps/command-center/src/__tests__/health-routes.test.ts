/**
 * Tests for health/summary and slo/status proxy routes.
 * Sprint: SPRINT-058-LAYER3-PHASE10-CC-HEALTH-DASHBOARD
 *
 * Covers:
 *   1.  /api/health/summary → 401 when no auth
 *   2.  /api/health/summary → proxies HEALTHY response
 *   3.  /api/health/summary → proxies DEGRADED response
 *   4.  /api/health/summary → proxies CRITICAL response (503 from upstream)
 *   5.  /api/health/summary → returns 503 + CRITICAL payload on upstream error
 *   6.  /api/slo/status     → 401 when no auth
 *   7.  /api/slo/status     → proxies SLO array (all OK)
 *   8.  /api/slo/status     → proxies AT_RISK (WARN) SLO
 *   9.  /api/slo/status     → proxies BREACH SLO
 *   10. /api/slo/status     → returns 503 + empty slos on upstream error
 *   11. /api/health/summary → forwards upstream status code on non-200
 *   12. /api/slo/status     → forwards upstream status code on upstream error response
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Auth mock ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  requireOperatorIdentity: vi.fn(),
  getOperatorIdentity: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as healthSummaryGET } from '@/app/api/health/summary/route';
import { GET as sloStatusGET } from '@/app/api/slo/status/route';
import { requireOperatorIdentity } from '@/lib/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(userId?: string): NextRequest {
  const req = new NextRequest('http://localhost/api/test');
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/health/summary', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns 401 when no operator identity', async () => {
    setAuth(null);
    const res = await healthSummaryGET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('proxies a HEALTHY response', async () => {
    setAuth('op-1');
    const payload = {
      platform_status: 'HEALTHY',
      computed_at: '2026-03-15T12:00:00Z',
      subsystems: [],
      slo_breaches: 0,
      slo_warns: 0,
      alert_count: 0,
      high_alert_count: 0,
      autopilot_mode: 'LOG_ONLY',
    };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));

    const res = await healthSummaryGET(makeRequest('op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.platform_status).toBe('HEALTHY');
    expect(body.autopilot_mode).toBe('LOG_ONLY');
  });

  it('proxies a DEGRADED response', async () => {
    setAuth('op-1');
    const payload = {
      platform_status: 'DEGRADED',
      computed_at: '2026-03-15T12:00:00Z',
      subsystems: [{ name: 'outbox', status: 'DEGRADED' }],
      slo_breaches: 0,
      slo_warns: 1,
      alert_count: 1,
      high_alert_count: 0,
      autopilot_mode: 'CANARY',
    };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));

    const res = await healthSummaryGET(makeRequest('op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.platform_status).toBe('DEGRADED');
    expect(body.slo_warns).toBe(1);
  });

  it('proxies a CRITICAL response (503 from upstream)', async () => {
    setAuth('op-1');
    const payload = {
      platform_status: 'CRITICAL',
      computed_at: '2026-03-15T12:00:00Z',
      subsystems: [{ name: 'lifecycle_completion_slo', status: 'DOWN' }],
      slo_breaches: 1,
      slo_warns: 0,
      alert_count: 2,
      high_alert_count: 2,
      autopilot_mode: 'LOG_ONLY',
    };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 503 }));

    const res = await healthSummaryGET(makeRequest('op-1'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.platform_status).toBe('CRITICAL');
    expect(body.slo_breaches).toBe(1);
  });

  it('returns 503 stable CRITICAL payload when upstream throws', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await healthSummaryGET(makeRequest('op-1'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.platform_status).toBe('CRITICAL');
    expect(body.error).toBeDefined();
    expect(body.slos).toBeUndefined(); // confirms it's the fallback shape
  });
});

describe('GET /api/slo/status', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns 401 when no operator identity', async () => {
    setAuth(null);
    const res = await sloStatusGET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('proxies SLO array when all SLOs are OK', async () => {
    setAuth('op-1');
    const payload = {
      success: true,
      data: {
        window_days: 7,
        computed_at: '2026-03-15T12:00:00Z',
        slos: [
          {
            id: 'lifecycle_completion',
            name: 'Pick Lifecycle Completion Rate',
            target: 0.95,
            attainment: 0.97,
            status: 'OK',
            unit: 'ratio',
          },
          {
            id: 'discord_posting',
            name: 'Discord Posting Success Rate',
            target: 0.98,
            attainment: 0.99,
            status: 'OK',
            unit: 'ratio',
          },
          {
            id: 'grading_latency_p50',
            name: 'Grading Latency (p50)',
            target: 300,
            attainment: 120,
            status: 'OK',
            unit: 'seconds',
          },
          {
            id: 'settlement_accuracy',
            name: 'Settlement Accuracy',
            target: 0.995,
            attainment: 0.998,
            status: 'OK',
            unit: 'ratio',
          },
        ],
      },
      timestamp: '2026-03-15T12:00:00Z',
    };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));

    const res = await sloStatusGET(makeRequest('op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.slos).toHaveLength(4);
    expect(body.data.slos[0].status).toBe('OK');
  });

  it('proxies an AT_RISK (WARN) SLO', async () => {
    setAuth('op-1');
    const payload = {
      success: true,
      data: {
        window_days: 7,
        computed_at: '2026-03-15T12:00:00Z',
        slos: [
          {
            id: 'discord_posting',
            name: 'Discord Posting Success Rate',
            target: 0.98,
            attainment: 0.942,
            status: 'WARN',
            unit: 'ratio',
          },
        ],
      },
      timestamp: '2026-03-15T12:00:00Z',
    };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));

    const res = await sloStatusGET(makeRequest('op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.slos[0].status).toBe('WARN');
  });

  it('proxies a BREACH SLO', async () => {
    setAuth('op-1');
    const payload = {
      success: true,
      data: {
        window_days: 7,
        computed_at: '2026-03-15T12:00:00Z',
        slos: [
          {
            id: 'lifecycle_completion',
            name: 'Pick Lifecycle Completion Rate',
            target: 0.95,
            attainment: 0.7,
            status: 'BREACH',
            unit: 'ratio',
          },
        ],
      },
      timestamp: '2026-03-15T12:00:00Z',
    };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));

    const res = await sloStatusGET(makeRequest('op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.slos[0].status).toBe('BREACH');
    expect(body.data.slos[0].attainment).toBe(0.7);
  });

  it('returns 503 with empty slos on upstream error', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('upstream timeout'));

    const res = await sloStatusGET(makeRequest('op-1'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('PROXY_ERROR');
    expect(body.data.slos).toHaveLength(0);
  });

  it('forwards upstream non-200 status code', async () => {
    setAuth('op-1');
    const payload = { success: false, error: 'internal', timestamp: '2026-03-15T12:00:00Z' };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 500 }));

    const res = await sloStatusGET(makeRequest('op-1'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('forwards the internal auth token to upstream', async () => {
    setAuth('op-1');
    const payload = {
      success: true,
      data: { window_days: 7, computed_at: '2026-03-15T12:00:00Z', slos: [] },
      timestamp: '2026-03-15T12:00:00Z',
    };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));

    await sloStatusGET(makeRequest('op-1'));
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Bearer /);
  });
});
