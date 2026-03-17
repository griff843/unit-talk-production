/**
 * Tests for POST /ops/picks/batch-action
 * Sprint: SPRINT-082-LAYER3-PHASE11-CC-BATCH-PICK-OPERATIONS
 *
 * Covers:
 *   1. Valid 'promote' batch succeeds for all picks
 *   2. Valid 'reject' batch succeeds for all picks
 *   3. Valid 'requeue' batch succeeds for all picks
 *   4. Missing pickIds returns 400
 *   5. Empty pickIds array returns 400
 *   6. Batch size over 100 returns 400
 *   7. Invalid action returns 400
 *   8. Partial failure — some picks fail lifecycle update
 *   9. Lifecycle throws error — captured in failed array
 *  10. Router exports default
 */

import { type Request, type Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../lib/lifecycle/write-adapter', () => ({
  lifecycleUpdate: vi.fn(),
}));

vi.mock('../../services/supabaseClient', () => ({
  supabase: {},
}));

vi.mock('../../lib/AutopilotGuard', () => ({
  autopilotGuard: {
    getStatus: vi.fn(() => ({ mode: 'off', canaryPercentage: 0 })),
    setMode: vi.fn(),
    setCanaryPercentage: vi.fn(),
    persistMode: vi.fn(),
  },
  AutopilotMode: {},
}));

vi.mock('../../middleware/operatorAuth', () => ({
  operatorAuth: vi.fn((_req: Request, _res: Response, next: () => void) => next()),
}));

vi.mock('../../middleware/operatorAuditLog', () => ({
  operatorAuditLog: vi.fn((_req: Request, _res: Response, next: () => void) => next()),
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

import { lifecycleUpdate } from '../../lib/lifecycle/write-adapter';
import router from '../ops-control';

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
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function makeReq(body: Record<string, unknown>): Request {
  return { body, params: {} } as unknown as Request;
}

async function callBatchAction(
  body: Record<string, unknown>
): Promise<{ statusCode: number; body: unknown }> {
  const req = makeReq(body);
  const res = makeMockRes();

  // Find the batch-action handler on the router stack
  const layer = (
    router as unknown as {
      stack: {
        route?: {
          path: string;
          stack: { method: string; handle: (req: Request, res: Response) => Promise<void> }[];
        };
      };
    }[]
  ).stack.find(l => l.route?.path === '/picks/batch-action');

  if (!layer?.route) throw new Error('batch-action route not registered');

  const postHandler = layer.route.stack.find(h => h.method === 'post');
  if (!postHandler) throw new Error('POST handler not found');

  await postHandler.handle(req, res as unknown as Response);
  return { statusCode: res.statusCode, body: res.body };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /ops/picks/batch-action', () => {
  const mockLifecycleUpdate = vi.mocked(lifecycleUpdate);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. promote: all picks succeed', async () => {
    mockLifecycleUpdate.mockResolvedValue({ success: true });

    const { statusCode, body } = await callBatchAction({
      pickIds: ['pick-1', 'pick-2', 'pick-3'],
      action: 'promote',
      reason: 'operator approval',
    });

    expect(statusCode).toBe(200);
    const b = body as { success: boolean; data: { succeeded: string[]; failed: unknown[] } };
    expect(b.success).toBe(true);
    expect(b.data.succeeded).toEqual(['pick-1', 'pick-2', 'pick-3']);
    expect(b.data.failed).toHaveLength(0);
    expect(mockLifecycleUpdate).toHaveBeenCalledTimes(3);
    expect(mockLifecycleUpdate).toHaveBeenCalledWith(
      {},
      'pick-1',
      { promotion_status: 'queued', risk_decision: 'operator_override_promote' },
      { writerRole: 'operator_override' }
    );
  });

  it('2. reject: all picks succeed', async () => {
    mockLifecycleUpdate.mockResolvedValue({ success: true });

    const { statusCode, body } = await callBatchAction({
      pickIds: ['pick-A', 'pick-B'],
      action: 'reject',
    });

    expect(statusCode).toBe(200);
    const b = body as { data: { succeeded: string[] } };
    expect(b.data.succeeded).toEqual(['pick-A', 'pick-B']);
    expect(mockLifecycleUpdate).toHaveBeenCalledWith(
      {},
      'pick-A',
      { promotion_status: 'failed', risk_decision: 'operator_override_reject' },
      { writerRole: 'operator_override' }
    );
  });

  it('3. requeue: all picks succeed with requeue risk_decision', async () => {
    mockLifecycleUpdate.mockResolvedValue({ success: true });

    const { statusCode, body } = await callBatchAction({
      pickIds: ['pick-X'],
      action: 'requeue',
    });

    expect(statusCode).toBe(200);
    const b = body as { data: { succeeded: string[] } };
    expect(b.data.succeeded).toEqual(['pick-X']);
    expect(mockLifecycleUpdate).toHaveBeenCalledWith(
      {},
      'pick-X',
      { promotion_status: 'queued', risk_decision: 'operator_override_requeue' },
      { writerRole: 'operator_override' }
    );
  });

  it('4. missing pickIds returns 400', async () => {
    const { statusCode, body } = await callBatchAction({ action: 'promote' });

    expect(statusCode).toBe(400);
    const b = body as { success: boolean; error: string };
    expect(b.success).toBe(false);
    expect(b.error).toMatch(/pickIds/);
    expect(mockLifecycleUpdate).not.toHaveBeenCalled();
  });

  it('5. empty pickIds array returns 400', async () => {
    const { statusCode, body } = await callBatchAction({ pickIds: [], action: 'promote' });

    expect(statusCode).toBe(400);
    const b = body as { error: string };
    expect(b.error).toMatch(/non-empty/);
  });

  it('6. batch size over 100 returns 400', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `pick-${i}`);
    const { statusCode, body } = await callBatchAction({ pickIds: ids, action: 'promote' });

    expect(statusCode).toBe(400);
    const b = body as { error: string };
    expect(b.error).toMatch(/100/);
    expect(mockLifecycleUpdate).not.toHaveBeenCalled();
  });

  it('7. invalid action returns 400', async () => {
    const { statusCode, body } = await callBatchAction({
      pickIds: ['pick-1'],
      action: 'approve_all',
    });

    expect(statusCode).toBe(400);
    const b = body as { error: string };
    expect(b.error).toMatch(/promote.*reject.*requeue/);
    expect(mockLifecycleUpdate).not.toHaveBeenCalled();
  });

  it('8. partial failure — first pick fails lifecycle update', async () => {
    mockLifecycleUpdate
      .mockResolvedValueOnce({ success: false, error: 'Pick is locked' })
      .mockResolvedValue({ success: true });

    const { statusCode, body } = await callBatchAction({
      pickIds: ['pick-fail', 'pick-ok'],
      action: 'promote',
    });

    expect(statusCode).toBe(200);
    const b = body as {
      success: boolean;
      data: { succeeded: string[]; failed: { id: string; error: string }[] };
    };
    expect(b.success).toBe(true);
    expect(b.data.succeeded).toContain('pick-ok');
    expect(b.data.failed).toHaveLength(1);
    expect(b.data.failed[0]).toMatchObject({ id: 'pick-fail', error: 'Pick is locked' });
  });

  it('9. lifecycle throws — pick captured in failed array', async () => {
    mockLifecycleUpdate.mockRejectedValueOnce(new Error('DB connection lost'));
    mockLifecycleUpdate.mockResolvedValue({ success: true });

    const { statusCode, body } = await callBatchAction({
      pickIds: ['pick-throw', 'pick-ok'],
      action: 'reject',
    });

    expect(statusCode).toBe(200);
    const b = body as {
      data: { succeeded: string[]; failed: { id: string; error: string }[] };
    };
    expect(b.data.failed).toHaveLength(1);
    expect(b.data.failed[0]).toMatchObject({ id: 'pick-throw', error: 'DB connection lost' });
    expect(b.data.succeeded).toContain('pick-ok');
  });

  it('10. router exports default', () => {
    expect(router).toBeDefined();
  });
});
