/**
 * UTRP-R6 DEFECT-32 — OperatorAuth Regression Test
 * Sprint: UTRP-R6-VERIFICATION-CONTROL-PLANE-RECONSTRUCTION
 *
 * Tests operatorAuth middleware auth paths to prevent silent regression of R3 fix.
 *
 * Coverage:
 *   1. Valid internal service token → next() called (operator_override role)
 *   2. Missing token in production mode → 401
 *   3. Invalid/expired JWT → 403
 *   4. E2E test bypass in test env → next() called
 *
 * Mocks: supabase client, TokenManager, SecurityEventLogger.
 * No HTTP server required — middleware is called directly with mock req/res/next.
 */

import type { Response, NextFunction } from 'express';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'user-001',
          email: 'test@ut.com',
          role: 'operator',
          display_name: 'Test',
          status: 'active',
          active: true,
        },
        error: null,
      }),
    }),
  },
}));

vi.mock('../../security', () => ({
  TokenManager: {
    verifyToken: vi.fn(),
  },
  SecurityEventLogger: {
    logEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../utils/logger', () => {
  const fns = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { createLogger: () => fns };
});

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { TokenManager } from '../../security';
import { operatorAuth } from '../operatorAuth';

import type { AuthenticatedRequest } from '../operatorAuth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    headers: {},
    path: '/ops/test',
    method: 'POST',
    ip: '127.0.0.1',
    get: vi.fn((name: string) => (name === 'User-Agent' ? 'test-agent' : undefined)) as any,
    ...overrides,
  } as AuthenticatedRequest;
}

function makeRes(): { res: Response; statusCode: number | null; body: unknown } {
  const ctx = { statusCode: null as number | null, body: null as unknown };
  const res = {
    status: vi.fn((code: number) => {
      ctx.statusCode = code;
      return res;
    }),
    json: vi.fn((b: unknown) => {
      ctx.body = b;
      return res;
    }),
  } as unknown as Response;
  return { res, ...ctx };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DEFECT-32 — operatorAuth regression coverage', () => {
  const VALID_INTERNAL_TOKEN = 'test-internal-token-32-chars-xxxxx'; // >= 32 chars

  let originalNodeEnv: string | undefined;
  let originalInternalToken: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env['NODE_ENV'];
    originalInternalToken = process.env['INTERNAL_SERVICE_TOKEN'];
    vi.mocked(TokenManager.verifyToken).mockReset();
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) {
      process.env['NODE_ENV'] = originalNodeEnv;
    }
    if (originalInternalToken !== undefined) {
      process.env['INTERNAL_SERVICE_TOKEN'] = originalInternalToken;
    } else {
      delete process.env['INTERNAL_SERVICE_TOKEN'];
    }
  });

  // ─── Scenario 1: Valid internal service token ─────────────────────────────

  it('Scenario 1: valid X-Internal-Service-Token → calls next() with operator_override role', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['INTERNAL_SERVICE_TOKEN'] = VALID_INTERNAL_TOKEN;

    const req = makeReq({
      headers: { 'x-internal-service-token': VALID_INTERNAL_TOKEN },
    });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await operatorAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.authenticatedOperatorId).toBe('internal-service');
    expect(req.authenticatedUser?.role).toBe('operator_override');
  });

  // ─── Scenario 2: Missing token in production → 401 ───────────────────────

  it('Scenario 2: missing token in production mode → 401', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['INTERNAL_SERVICE_TOKEN'];

    const req = makeReq({ headers: {} });
    const { res, statusCode, body } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await operatorAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // ─── Scenario 3: Invalid JWT → 403 ───────────────────────────────────────

  it('Scenario 3: invalid/expired JWT → 403', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['INTERNAL_SERVICE_TOKEN'];

    vi.mocked(TokenManager.verifyToken).mockReturnValue(null); // invalid token

    const req = makeReq({
      headers: { authorization: 'Bearer bad-jwt-token' },
    });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await operatorAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(TokenManager.verifyToken).toHaveBeenCalledWith('bad-jwt-token');
  });

  // ─── Scenario 4: E2E test bypass in test env ─────────────────────────────

  it('Scenario 4: x-e2e-test header in test env → next() called with e2e-test-operator', async () => {
    process.env['NODE_ENV'] = 'test';
    delete process.env['INTERNAL_SERVICE_TOKEN'];

    const req = makeReq({
      headers: { 'x-e2e-test': 'true' },
    });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await operatorAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.authenticatedOperatorId).toBe('e2e-test-operator');
    expect(req.authenticatedUser?.role).toBe('operator_override');
  });

  // ─── Scenario 5: Internal token too short → does NOT authenticate via token ─

  it('Scenario 5: token shorter than 32 chars is NOT treated as valid internal token', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['INTERNAL_SERVICE_TOKEN'] = 'short'; // < 32 chars

    vi.mocked(TokenManager.verifyToken).mockReturnValue(null);

    const req = makeReq({
      headers: { 'x-internal-service-token': 'short' },
    });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await operatorAuth(req, res, next);

    // Should NOT match internal token path (length guard fails)
    // Falls through to JWT path — no Authorization header → 401
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // ─── Scenario 6: Valid JWT + active user → 200 (next called) ─────────────

  it('Scenario 6: valid JWT with active user → next() called with user id', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['INTERNAL_SERVICE_TOKEN'];

    vi.mocked(TokenManager.verifyToken).mockReturnValue({ userId: 'user-001' });

    const req = makeReq({
      headers: { authorization: 'Bearer valid-jwt-token' },
    });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await operatorAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.authenticatedOperatorId).toBe('user-001');
  });
});
