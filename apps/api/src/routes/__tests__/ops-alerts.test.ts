/**
 * Tests for ops-alerts route
 * Sprint: SPRINT-061-LAYER3-PHASE10-CC-ALERT-DASHBOARD
 *
 * Covers:
 *   1. GET /ops/alerts returns 200 with alerts array and meta.bySeverity
 *   2. bySeverity counts are correctly computed
 *   3. Empty alerts returns valid shape
 *   4. alertManager error returns 500
 *   5. Router exports default
 */

import { type Request, type Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../monitoring/alerts', () => ({
  alertManager: {
    getActiveAlerts: vi.fn(),
  },
}));

vi.mock('../../middleware/operatorAuth', () => ({
  operatorAuth: vi.fn((_req, _res, next: () => void) => next()),
}));

vi.mock('../../middleware/operatorAuditLog', () => ({
  operatorAuditLog: vi.fn((_req, _res, next: () => void) => next()),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { alertManager } from '../../monitoring/alerts';
import router from '../ops-alerts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

function makeReq(): Partial<Request> {
  return { method: 'GET', path: '/alerts', query: {} };
}

/** Extract the GET /alerts handler from the router stack */
function getAlertsHandler() {
  const layer = (
    router as unknown as {
      stack: Array<{ route: { path: string; stack: Array<{ method: string; handle: Function }> } }>;
    }
  ).stack.find(l => l.route?.path === '/alerts');
  if (!layer) throw new Error('GET /alerts route not registered in router');
  const handler = layer.route.stack.find(s => s.method === 'get');
  if (!handler) throw new Error('GET handler not found on /alerts route');
  return handler.handle;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ops-alerts router — GET /alerts', () => {
  const mockGetActiveAlerts = vi.mocked(alertManager.getActiveAlerts);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('route is registered in the router', () => {
    expect(() => getAlertsHandler()).not.toThrow();
  });

  it('returns 200 with alerts array and meta.bySeverity', async () => {
    mockGetActiveAlerts.mockReturnValue([
      {
        id: 'a1',
        ruleId: 'r1',
        title: 'Grading slow',
        description: 'p50 elevated',
        severity: 'critical',
        timestamp: '2026-03-16T10:00:00Z',
        value: 450,
        threshold: 300,
        status: 'active',
        channels: [],
        tags: [],
        metadata: {},
      },
      {
        id: 'a2',
        ruleId: 'r2',
        title: 'Feed lag',
        description: 'slight lag',
        severity: 'info',
        timestamp: '2026-03-16T10:01:00Z',
        value: 90,
        threshold: 60,
        status: 'active',
        channels: [],
        tags: [],
        metadata: {},
      },
    ] as Parameters<typeof mockGetActiveAlerts>[0] extends undefined
      ? never
      : ReturnType<typeof mockGetActiveAlerts>);

    const res = makeMockRes();
    const handler = getAlertsHandler();
    handler(makeReq(), res, () => {});

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      alerts: unknown[];
      meta: { total: number; bySeverity: { info: number; warning: number; critical: number } };
    };
    expect(body.alerts).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    expect(body.meta.bySeverity.critical).toBe(1);
    expect(body.meta.bySeverity.info).toBe(1);
    expect(body.meta.bySeverity.warning).toBe(0);
  });

  it('returns empty alerts with correct meta when no active alerts', async () => {
    mockGetActiveAlerts.mockReturnValue([]);

    const res = makeMockRes();
    const handler = getAlertsHandler();
    handler(makeReq(), res, () => {});

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      alerts: unknown[];
      meta: { total: number; bySeverity: Record<string, number> };
    };
    expect(body.alerts).toHaveLength(0);
    expect(body.meta.total).toBe(0);
    expect(body.meta.bySeverity.critical).toBe(0);
    expect(body.meta.bySeverity.info).toBe(0);
    expect(body.meta.bySeverity.warning).toBe(0);
  });

  it('computes bySeverity correctly for mixed severities', () => {
    mockGetActiveAlerts.mockReturnValue([
      {
        id: 'a1',
        ruleId: 'r1',
        title: 'T1',
        description: 'D1',
        severity: 'critical',
        timestamp: '',
        value: 1,
        threshold: 1,
        status: 'active',
        channels: [],
        tags: [],
        metadata: {},
      },
      {
        id: 'a2',
        ruleId: 'r2',
        title: 'T2',
        description: 'D2',
        severity: 'critical',
        timestamp: '',
        value: 1,
        threshold: 1,
        status: 'active',
        channels: [],
        tags: [],
        metadata: {},
      },
      {
        id: 'a3',
        ruleId: 'r3',
        title: 'T3',
        description: 'D3',
        severity: 'warning',
        timestamp: '',
        value: 1,
        threshold: 1,
        status: 'active',
        channels: [],
        tags: [],
        metadata: {},
      },
      {
        id: 'a4',
        ruleId: 'r4',
        title: 'T4',
        description: 'D4',
        severity: 'info',
        timestamp: '',
        value: 1,
        threshold: 1,
        status: 'active',
        channels: [],
        tags: [],
        metadata: {},
      },
    ] as ReturnType<typeof mockGetActiveAlerts>);

    const res = makeMockRes();
    const handler = getAlertsHandler();
    handler(makeReq(), res, () => {});

    const body = res.body as {
      meta: { bySeverity: { info: number; warning: number; critical: number } };
    };
    expect(body.meta.bySeverity.critical).toBe(2);
    expect(body.meta.bySeverity.warning).toBe(1);
    expect(body.meta.bySeverity.info).toBe(1);
  });

  it('returns 500 when alertManager throws', () => {
    mockGetActiveAlerts.mockImplementation(() => {
      throw new Error('alertManager internal error');
    });

    const res = makeMockRes();
    const handler = getAlertsHandler();
    handler(makeReq(), res, () => {});

    expect(res.statusCode).toBe(500);
    const body = res.body as { error: string };
    expect(body.error).toMatch(/alert/i);
  });
});
