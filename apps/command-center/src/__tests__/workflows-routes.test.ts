/**
 * Tests for ops/workflows proxy route.
 * Sprint: SPRINT-060-LAYER3-PHASE11-CC-WORKFLOW-MANAGEMENT
 *
 * Covers:
 *   1.  GET /api/ops/workflows → 401 when no auth
 *   2.  GET /api/ops/workflows → proxies registry response
 *   3.  GET /api/ops/workflows?category=health → passes category filter upstream
 *   4.  GET /api/ops/workflows → returns 503 on upstream error
 *   5.  GET /api/ops/workflows → forwards internal admin token to upstream
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Auth mock ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  requireOperatorIdentity: vi.fn(),
  getOperatorIdentity: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET } from '@/app/api/ops/workflows/route';
import { requireOperatorIdentity } from '@/lib/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(path = '/api/ops/workflows', userId?: string): NextRequest {
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

const SAMPLE_REGISTRY = {
  workflows: [
    {
      name: 'grade-picks',
      displayName: 'Grade Picks',
      description: 'Runs the grading pipeline for pending picks',
      category: 'analysis',
      scriptPath: 'scripts/grade-picks.ts',
      riskLevel: 'low',
      invocation: 'pnpm grade:picks',
    },
    {
      name: 'settle-picks',
      displayName: 'Settle Picks',
      description: 'Settles picks against final scores',
      category: 'settlement',
      scriptPath: 'scripts/settle-picks.ts',
      riskLevel: 'medium',
      invocation: 'pnpm settle:picks',
    },
  ],
  categories: ['analysis', 'settlement'],
  counts: { analysis: 1, settlement: 1 },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/ops/workflows', () => {
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

  it('proxies registry response from upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_REGISTRY), { status: 200 })
    );

    const res = await GET(makeRequest('/api/ops/workflows', 'op-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflows).toHaveLength(2);
    expect(body.categories).toContain('analysis');
    expect(body.workflows[0].name).toBe('grade-picks');
  });

  it('passes ?category= filter through to upstream URL', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          workflows: [SAMPLE_REGISTRY.workflows[0]],
          categories: ['analysis'],
          counts: { analysis: 1 },
        }),
        { status: 200 }
      )
    );

    await GET(makeRequest('/api/ops/workflows?category=analysis', 'op-1'));

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('category=analysis');
  });

  it('returns 503 with empty registry on upstream error', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await GET(makeRequest('/api/ops/workflows', 'op-1'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.workflows).toHaveLength(0);
    expect(body.categories).toHaveLength(0);
    expect(body.error).toBeDefined();
  });

  it('forwards internal admin token to upstream', async () => {
    setAuth('op-1');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SAMPLE_REGISTRY), { status: 200 })
    );

    await GET(makeRequest('/api/ops/workflows', 'op-1'));

    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Bearer /);
  });
});
