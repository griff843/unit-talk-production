/**
 * Tests for ops-alerts route
 * Sprint: SPRINT-061-LAYER3-PHASE10-CC-ALERT-DASHBOARD (original)
 * Sprint: SPRINT-REM-002-ALERT-PIPELINE-ACTIVATION (fix)
 *
 * Covers:
 *   1. GET /ops/alerts returns 200 with alerts array and meta.bySeverity
 *   2. bySeverity counts are correctly computed
 *   3. Empty alerts returns valid shape
 *   4. evaluatePlatformThresholds error returns programmatic alerts only (fail-open for threshold eval)
 *   5. Router exports default
 *   6. Threshold alerts are mapped to Alert shape
 *   7. Programmatic and threshold alerts are merged without duplicates
 *   8. sendOperatorAlert registers alert in alertManager
 */

import { type Request, type Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../monitoring/alerts', () => ({
  alertManager: {
    getActiveAlerts: vi.fn(),
    createAlert: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/PlatformThresholdEvaluator', () => ({
  evaluatePlatformThresholds: vi.fn(),
}));

vi.mock('../../services/supabaseClient', () => ({
  supabase: {},
}));

vi.mock('../../utils/dateUtils', () => ({
  toISOString: (d: Date) => d.toISOString(),
}));

vi.mock('../../middleware/operatorAuth', () => ({
  operatorAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock('../../middleware/operatorAuditLog', () => ({
  operatorAuditLog: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock('../../utils/logger', () => {
  const fns = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() });
  return { createLogger: () => fns(), makeLogger: () => fns() };
});

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { alertManager } from '../../monitoring/alerts';
import { evaluatePlatformThresholds } from '../../services/PlatformThresholdEvaluator';
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

const mockGetActiveAlerts = vi.mocked(alertManager.getActiveAlerts);
const mockEvaluateThresholds = vi.mocked(evaluatePlatformThresholds);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ops-alerts router — GET /alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveAlerts.mockReturnValue([]);
    mockEvaluateThresholds.mockResolvedValue({
      alerts: [],
      evaluated_at: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('route is registered in the router', () => {
    expect(() => getAlertsHandler()).not.toThrow();
  });

  it('returns 200 with alerts array and meta.bySeverity when no alerts', async () => {
    const res = makeMockRes();
    const handler = getAlertsHandler();
    await handler(makeReq(), res, () => {});

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      alerts: unknown[];
      meta: { total: number; bySeverity: Record<string, number> };
    };
    expect(body.alerts).toHaveLength(0);
    expect(body.meta.total).toBe(0);
    expect(body.meta.bySeverity.critical).toBe(0);
    expect(body.meta.bySeverity.warning).toBe(0);
    expect(body.meta.bySeverity.info).toBe(0);
  });

  it('surfaces threshold alerts from PlatformThresholdEvaluator', async () => {
    mockEvaluateThresholds.mockResolvedValue({
      alerts: [
        {
          id: 'slo_breach_lifecycle',
          severity: 'HIGH',
          message: 'SLO BREACH: Lifecycle — attainment 0.00 below target',
          source: 'slo',
          detected_at: '2026-03-18T10:00:00Z',
        },
        {
          id: 'heartbeat_stale_workers',
          severity: 'HIGH',
          message: 'Worker heartbeat stale: workers last seen 1500min ago',
          source: 'heartbeat',
          detected_at: '2026-03-18T10:00:00Z',
        },
      ],
      evaluated_at: '2026-03-18T10:00:00Z',
    });

    const res = makeMockRes();
    await getAlertsHandler()(makeReq(), res, () => {});

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      alerts: Array<{ id: string; severity: string; tags: string[] }>;
      meta: { total: number; bySeverity: Record<string, number> };
    };
    expect(body.alerts).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    expect(body.meta.bySeverity.critical).toBe(2); // HIGH maps to critical
  });

  it('maps threshold severity correctly: HIGH→critical, MEDIUM→warning', async () => {
    mockEvaluateThresholds.mockResolvedValue({
      alerts: [
        {
          id: 'slo_high',
          severity: 'HIGH',
          message: 'SLO breach',
          source: 'slo',
          detected_at: '2026-03-18T10:00:00Z',
        },
        {
          id: 'outbox_medium',
          severity: 'MEDIUM',
          message: 'Outbox depth alert',
          source: 'outbox',
          detected_at: '2026-03-18T10:00:00Z',
        },
      ],
      evaluated_at: '2026-03-18T10:00:00Z',
    });

    const res = makeMockRes();
    await getAlertsHandler()(makeReq(), res, () => {});

    const body = res.body as { alerts: Array<{ id: string; severity: string }> };
    const sloAlert = body.alerts.find(a => a.id === 'slo_high');
    const outboxAlert = body.alerts.find(a => a.id === 'outbox_medium');
    expect(sloAlert?.severity).toBe('critical');
    expect(outboxAlert?.severity).toBe('warning');
  });

  it('merges programmatic and threshold alerts', async () => {
    mockGetActiveAlerts.mockReturnValue([
      {
        id: 'workflow_failure_123',
        ruleId: 'operator_workflow_failure',
        title: 'WORKFLOW_FAILURE: feedAgent failed',
        description: 'feedAgent workflow failed',
        severity: 'critical',
        timestamp: '2026-03-18T10:00:00Z',
        value: 0,
        threshold: 0,
        status: 'active',
        channels: ['discord-alerts'],
        tags: ['workflow_failure', 'operator'],
        metadata: {},
      },
    ]);
    mockEvaluateThresholds.mockResolvedValue({
      alerts: [
        {
          id: 'slo_breach_lifecycle',
          severity: 'HIGH',
          message: 'SLO breach',
          source: 'slo',
          detected_at: '2026-03-18T10:00:00Z',
        },
      ],
      evaluated_at: '2026-03-18T10:00:00Z',
    });

    const res = makeMockRes();
    await getAlertsHandler()(makeReq(), res, () => {});

    const body = res.body as { alerts: Array<{ id: string }>; meta: { total: number } };
    expect(body.alerts).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    expect(body.alerts.map(a => a.id).sort()).toEqual([
      'slo_breach_lifecycle',
      'workflow_failure_123',
    ]);
  });

  it('deduplicates by id — programmatic alerts take precedence', async () => {
    const sharedId = 'slo_breach_lifecycle';
    mockGetActiveAlerts.mockReturnValue([
      {
        id: sharedId,
        ruleId: 'custom',
        title: 'Custom alert',
        description: 'From programmatic source',
        severity: 'critical',
        timestamp: '2026-03-18T10:00:00Z',
        value: 0,
        threshold: 0,
        status: 'active',
        channels: [],
        tags: [],
        metadata: { source: 'programmatic' },
      },
    ]);
    mockEvaluateThresholds.mockResolvedValue({
      alerts: [
        {
          id: sharedId,
          severity: 'HIGH',
          message: 'From threshold source',
          source: 'slo',
          detected_at: '2026-03-18T10:00:00Z',
        },
      ],
      evaluated_at: '2026-03-18T10:00:00Z',
    });

    const res = makeMockRes();
    await getAlertsHandler()(makeReq(), res, () => {});

    const body = res.body as { alerts: Array<{ id: string; metadata: Record<string, string> }> };
    expect(body.alerts).toHaveLength(1);
    expect(body.alerts[0].metadata.source).toBe('programmatic'); // programmatic wins
  });

  it('returns programmatic alerts only when threshold evaluation fails', async () => {
    mockGetActiveAlerts.mockReturnValue([
      {
        id: 'wf_1',
        ruleId: 'r1',
        title: 'Alert',
        description: 'desc',
        severity: 'warning',
        timestamp: '',
        value: 0,
        threshold: 0,
        status: 'active',
        channels: [],
        tags: [],
        metadata: {},
      },
    ]);
    mockEvaluateThresholds.mockRejectedValue(new Error('DB connection failed'));

    const res = makeMockRes();
    await getAlertsHandler()(makeReq(), res, () => {});

    expect(res.statusCode).toBe(200);
    const body = res.body as { alerts: unknown[]; meta: { total: number } };
    expect(body.alerts).toHaveLength(1);
    expect(body.meta.total).toBe(1);
  });

  it('returns 500 when alertManager throws', async () => {
    mockGetActiveAlerts.mockImplementation(() => {
      throw new Error('alertManager internal error');
    });

    const res = makeMockRes();
    await getAlertsHandler()(makeReq(), res, () => {});

    expect(res.statusCode).toBe(500);
    const body = res.body as { error: string };
    expect(body.error).toMatch(/alert/i);
  });

  it('threshold alerts include source tag', async () => {
    mockEvaluateThresholds.mockResolvedValue({
      alerts: [
        {
          id: 'heartbeat_stale_workers',
          severity: 'HIGH',
          message: 'Worker heartbeat stale',
          source: 'heartbeat',
          detected_at: '2026-03-18T10:00:00Z',
        },
      ],
      evaluated_at: '2026-03-18T10:00:00Z',
    });

    const res = makeMockRes();
    await getAlertsHandler()(makeReq(), res, () => {});

    const body = res.body as { alerts: Array<{ tags: string[] }> };
    expect(body.alerts[0].tags).toContain('heartbeat');
  });
});

// ─── sendOperatorAlert → alertManager integration ────────────────────────────

describe('sendOperatorAlert → alertManager integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sendOperatorAlert registers alert in alertManager', async () => {
    // Mock axios to prevent actual HTTP call
    vi.mock('axios', () => ({
      default: { post: vi.fn().mockResolvedValue({ status: 204 }) },
    }));

    const { sendOperatorAlert } = await import('../../activities/alerts');
    const mockCreateAlert = vi.mocked(alertManager.createAlert);

    await sendOperatorAlert({
      type: 'workflow_failure',
      message: 'feedAgentWorkflow failed',
      severity: 'critical',
      metadata: { workflowName: 'feedAgent' },
    });

    expect(mockCreateAlert).toHaveBeenCalledTimes(1);
    const alertArg = mockCreateAlert.mock.calls[0][0];
    expect(alertArg.severity).toBe('critical');
    expect(alertArg.tags).toContain('workflow_failure');
    expect(alertArg.tags).toContain('operator');
    expect(alertArg.description).toContain('feedAgentWorkflow failed');
  });
});
