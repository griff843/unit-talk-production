/**
 * Tests for Operator Audit Log Middleware
 * Sprint: SPRINT-046-OPERATOR-AUDIT-TRAIL
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsert, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
  return { mockInsert, mockFrom };
});

vi.mock('../services/supabaseClient', () => ({
  supabase: { from: mockFrom },
  supabaseClient: { from: mockFrom },
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { operatorAuditLog } from '../middleware/operatorAuditLog';
import { AuthenticatedRequest } from '../middleware/operatorAuth';

import { Response, NextFunction } from 'express';

describe('operatorAuditLog middleware', () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;
  let finishHandler: (() => void) | null;

  beforeEach(() => {
    vi.clearAllMocks();
    finishHandler = null;
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });

    req = {
      authenticatedOperatorId: 'op-123',
      authenticatedUser: { id: 'op-123', email: 'admin@test.com', role: 'admin' },
      method: 'POST',
      path: '/ops/ingest-now',
      originalUrl: '/ops/ingest-now',
      route: { path: '/ingest-now' } as any,
      body: { sport: 'NBA' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-user-agent'),
      socket: { remoteAddress: '127.0.0.1' } as any,
    };

    res = {
      statusCode: 200,
      on: vi.fn().mockImplementation((event: string, handler: () => void) => {
        if (event === 'finish') finishHandler = handler;
      }),
    };

    next = vi.fn();
  });

  it('calls next() immediately without blocking', () => {
    operatorAuditLog(req as AuthenticatedRequest, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('registers a finish event listener on the response', () => {
    operatorAuditLog(req as AuthenticatedRequest, res as Response, next);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('writes audit entry to supabase on response finish', async () => {
    operatorAuditLog(req as AuthenticatedRequest, res as Response, next);

    expect(finishHandler).not.toBeNull();
    finishHandler!();

    await vi.waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('operator_audit_log');
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        operator_id: 'op-123',
        operator_email: 'admin@test.com',
        action: 'POST /ingest-now',
        endpoint: '/ops/ingest-now',
        method: 'POST',
        response_status: 200,
        ip_address: '127.0.0.1',
        user_agent: 'test-user-agent',
      })
    );
  });

  it('sanitizes sensitive fields in request body', () => {
    req.body = { sport: 'NBA', password: 'secret123', api_key: 'key-456' };

    operatorAuditLog(req as AuthenticatedRequest, res as Response, next);
    finishHandler!();

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        request_body: expect.objectContaining({
          sport: 'NBA',
          password: '[REDACTED]',
          api_key: '[REDACTED]',
        }),
      })
    );
  });

  it('handles missing operator identity gracefully', () => {
    req.authenticatedOperatorId = undefined;
    req.authenticatedUser = undefined;

    operatorAuditLog(req as AuthenticatedRequest, res as Response, next);
    finishHandler!();

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        operator_id: 'unknown',
        operator_email: null,
      })
    );
  });

  it('does not throw if supabase insert fails', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'DB error' } });

    operatorAuditLog(req as AuthenticatedRequest, res as Response, next);
    finishHandler!();

    await vi.waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it('includes duration_ms in the audit entry', () => {
    operatorAuditLog(req as AuthenticatedRequest, res as Response, next);
    finishHandler!();

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_ms: expect.any(Number),
      })
    );
  });
});
