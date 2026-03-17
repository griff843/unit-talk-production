/**
 * Tests for POST /api/picks/batch-action CC proxy route.
 * Sprint: SPRINT-082-LAYER3-PHASE11-CC-BATCH-PICK-OPERATIONS
 *
 * Covers:
 *   1.  POST /api/picks/batch-action → 401 when no auth
 *   2.  POST /api/picks/batch-action → proxies promote response
 *   3.  POST /api/picks/batch-action → proxies reject response
 *   4.  POST /api/picks/batch-action → proxies requeue response
 *   5.  POST /api/picks/batch-action → returns 503 on upstream error
 *   6.  POST /api/picks/batch-action → forwards upstream non-200 status
 *   7.  POST /api/picks/batch-action → forwards INTERNAL_API_TOKEN in auth header
 *   8.  POST /api/picks/batch-action → partial failure response proxied correctly
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Auth mock ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  requireOperatorIdentity: vi.fn(),
  getOperatorIdentity: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { POST } from '@/app/api/picks/batch-action/route';
import { requireOperatorIdentity } from '@/lib/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>, userId?: string): NextRequest {
  const req = new NextRequest('http://localhost/api/picks/batch-action', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  if (userId) req.headers.set('x-user-id', userId);
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

describe('POST /api/picks/batch-action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. returns 401 when no auth', async () => {
    setAuth(null);
    const req = makeRequest({ pickIds: ['p1'], action: 'promote' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Unauthorized/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('2. proxies promote response with 200', async () => {
    setAuth('op-1');
    const upstream = {
      success: true,
      data: { succeeded: ['p1', 'p2'], failed: [] },
      timestamp: '2026-03-17T00:00:00Z',
    };
    vi.mocked(global.fetch).mockResolvedValueOnce({
      status: 200,
      json: async () => upstream,
    } as Response);

    const req = makeRequest({ pickIds: ['p1', 'p2'], action: 'promote' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.succeeded).toEqual(['p1', 'p2']);
    expect(body.data.failed).toHaveLength(0);
  });

  it('3. proxies reject response', async () => {
    setAuth('op-1');
    const upstream = {
      success: true,
      data: { succeeded: ['p3'], failed: [] },
      timestamp: '2026-03-17T00:00:00Z',
    };
    vi.mocked(global.fetch).mockResolvedValueOnce({
      status: 200,
      json: async () => upstream,
    } as Response);

    const req = makeRequest({ pickIds: ['p3'], action: 'reject' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.succeeded).toContain('p3');
  });

  it('4. proxies requeue response', async () => {
    setAuth('op-1');
    const upstream = {
      success: true,
      data: { succeeded: ['p4'], failed: [] },
      timestamp: '2026-03-17T00:00:00Z',
    };
    vi.mocked(global.fetch).mockResolvedValueOnce({
      status: 200,
      json: async () => upstream,
    } as Response);

    const req = makeRequest({ pickIds: ['p4'], action: 'requeue' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.succeeded).toContain('p4');
  });

  it('5. returns 503 on upstream fetch error', async () => {
    setAuth('op-1');
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Connection refused'));

    const req = makeRequest({ pickIds: ['p1'], action: 'promote' });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('PROXY_ERROR');
    expect(body.message).toContain('Connection refused');
  });

  it('6. forwards upstream non-200 status', async () => {
    setAuth('op-1');
    vi.mocked(global.fetch).mockResolvedValueOnce({
      status: 400,
      json: async () => ({ success: false, error: 'pickIds must be a non-empty array' }),
    } as Response);

    const req = makeRequest({ pickIds: [], action: 'promote' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/pickIds/);
  });

  it('7. includes Authorization header in upstream request', async () => {
    setAuth('op-1');

    vi.mocked(global.fetch).mockResolvedValueOnce({
      status: 200,
      json: async () => ({ success: true, data: { succeeded: [], failed: [] } }),
    } as Response);

    const req = makeRequest({ pickIds: ['p1'], action: 'promote' });
    await POST(req);

    const [, fetchOpts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    const authHeader = (fetchOpts?.headers as Record<string, string>)?.['Authorization'];
    expect(authHeader).toMatch(/^Bearer /);
  });

  it('8. partial failure response proxied correctly', async () => {
    setAuth('op-1');
    const upstream = {
      success: true,
      data: {
        succeeded: ['p2'],
        failed: [{ id: 'p1', error: 'Pick is locked' }],
      },
      timestamp: '2026-03-17T00:00:00Z',
    };
    vi.mocked(global.fetch).mockResolvedValueOnce({
      status: 200,
      json: async () => upstream,
    } as Response);

    const req = makeRequest({ pickIds: ['p1', 'p2'], action: 'promote' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.succeeded).toContain('p2');
    expect(body.data.failed).toHaveLength(1);
    expect(body.data.failed[0]).toMatchObject({ id: 'p1', error: 'Pick is locked' });
  });
});
