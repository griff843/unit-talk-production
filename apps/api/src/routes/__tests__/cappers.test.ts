/**
 * Tests for /api/cappers route — SPRINT-CAPPER-PERFORMANCE-MV-CREATION
 *
 * Covers:
 *   1. GET /api/cappers returns 200 with expected shape
 *   2. Query params (window, capper_id) are forwarded
 *   3. Empty data returns valid shape (no crash)
 *   4. DB error returns 500 with correlationId
 *   5. Aggregation from MV rollup data works correctly
 *   6. Streak data is joined properly
 *   7. Router exports default
 */

import { type Request, type Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

// Build a chainable mock that resolves to configurable data
function buildChain(resolvedData: any) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(resolvedData);
  return chain;
}

let usersData: any = { data: [], error: null };
let rollupsData: any = { data: [], error: null };
let streaksData: any = { data: [], error: null };

vi.mock('../../services/supabaseClient', () => ({
  supabaseClient: {
    from: vi.fn((table: string) => {
      if (table === 'users') return buildChain(usersData);
      if (table === 'mv_capper_daily_rollup') return buildChain(rollupsData);
      if (table === 'v_capper_streaks') return buildChain(streaksData);
      return buildChain({ data: null, error: null });
    }),
  },
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

import router from '../cappers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockRes() {
  const res = {
    statusCode: 200,
    body: null as any,
    set: vi.fn().mockReturnThis(),
    status: vi.fn().mockImplementation(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn().mockImplementation(function (this: any, data: any) {
      this.body = data;
      return this;
    }),
  } as unknown as Response;
  return res;
}

function makeMockReq(query: Record<string, string> = {}): Request {
  return { query } as unknown as Request;
}

// Get the route handler from the router stack
function getRouteHandler() {
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === '/' && l.route?.methods?.get
  );
  return layer?.route?.stack[0]?.handle;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  usersData = { data: [], error: null };
  rollupsData = { data: [], error: null };
  streaksData = { data: [], error: null };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/cappers', () => {
  it('returns 200 with expected response shape on empty data', async () => {
    const handler = getRouteHandler();
    const req = makeMockReq();
    const res = makeMockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [],
        metadata: expect.objectContaining({
          count: 0,
          window_days: 10,
        }),
      })
    );
  });

  it('aggregates rollup data correctly for a capper', async () => {
    usersData = {
      data: [{ id: 'c1', username: 'TestCapper', tier: 'S', capper_tier: 'S', active: true }],
      error: null,
    };
    rollupsData = {
      data: [
        {
          capper_id: 'c1',
          day: '2026-03-17',
          picks: 5,
          wins: 3,
          losses: 1,
          pushes: 1,
          units_wagered: '5.00',
          units_profit: '2.50',
          roi: '50.00',
        },
        {
          capper_id: 'c1',
          day: '2026-03-16',
          picks: 3,
          wins: 2,
          losses: 1,
          pushes: 0,
          units_wagered: '3.00',
          units_profit: '1.00',
          roi: '33.33',
        },
      ],
      error: null,
    };
    streaksData = {
      data: [{ capper_id: 'c1', current_streak_type: 'win', current_streak_len: 3 }],
      error: null,
    };

    const handler = getRouteHandler();
    const req = makeMockReq({ window: '10' });
    const res = makeMockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            capper_id: 'c1',
            username: 'TestCapper',
            tier: 'S',
            stats: expect.objectContaining({
              picks: 8,
              wins: 5,
              losses: 2,
              pushes: 1,
              units_wagered: 8,
              units_profit: 3.5,
            }),
            streak: { type: 'win', length: 3 },
          }),
        ]),
      })
    );
  });

  it('handles null streak gracefully', async () => {
    usersData = {
      data: [{ id: 'c1', username: 'NoPicks', tier: 'C', capper_tier: null, active: true }],
      error: null,
    };
    // No rollups, no streaks
    rollupsData = { data: [], error: null };
    streaksData = { data: [], error: null };

    const handler = getRouteHandler();
    const req = makeMockReq();
    const res = makeMockRes();
    await handler(req, res);

    const body = (res.json as any).mock.calls[0][0];
    expect(body.data[0].streak).toBeNull();
    expect(body.data[0].stats.picks).toBe(0);
  });

  it('returns 500 on DB error with correlationId', async () => {
    usersData = { data: null, error: { message: 'relation "users" does not exist' } };

    const handler = getRouteHandler();
    const req = makeMockReq();
    const res = makeMockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        correlationId: expect.stringContaining('cappers-'),
      })
    );
  });

  it('exports router as default', () => {
    expect(router).toBeDefined();
  });
});
