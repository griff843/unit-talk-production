/**
 * Tests for enforcePermission() route-level RBAC enforcement.
 * SPRINT-050-LAYER3-PHASE10-CC-PERMISSION-ENFORCEMENT
 *
 * Verifies the three enforcement scenarios:
 *   1. Unauthenticated → 401
 *   2. Authenticated but lacking permission → 403
 *   3. Authenticated with permission → null (authorized)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { enforcePermission } from '@/lib/auth';
import { Permission, RBACService } from '@/lib/rbac';

// Mock RBACService methods used by enforcePermission
vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return {
    ...actual,
    RBACService: {
      hasPermission: vi.fn(),
      logAudit: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// Minimal NextRequest mock with headers + nextUrl
function mockRequest(headers: Record<string, string> = {}, path = '/api/test') {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
    nextUrl: { pathname: path },
    method: 'POST',
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('enforcePermission', () => {
  // -------------------------------------------------------------------------
  // Scenario 1: Unauthenticated → 401
  // -------------------------------------------------------------------------
  describe('unauthenticated requests', () => {
    it('returns 401 when no x-user-id header', async () => {
      const req = mockRequest({});
      const result = await enforcePermission(req, Permission.CONTROL_AGENTS);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);

      const body = await result!.json();
      expect(body.code).toBe('AUTH_REQUIRED');
    });

    it('returns 401 when x-user-id is empty', async () => {
      const req = mockRequest({ 'x-user-id': '' });
      const result = await enforcePermission(req, Permission.CONTROL_AGENTS);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    it('does not call RBACService when unauthenticated', async () => {
      const req = mockRequest({});
      await enforcePermission(req, Permission.CONTROL_AGENTS);

      expect(RBACService.hasPermission).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Authenticated but lacking permission → 403
  // -------------------------------------------------------------------------
  describe('unauthorized requests', () => {
    it('returns 403 when user lacks required permission', async () => {
      vi.mocked(RBACService.hasPermission).mockResolvedValue(false);

      const req = mockRequest({ 'x-user-id': 'capper-1' });
      const result = await enforcePermission(req, Permission.CONTROL_AGENTS);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);

      const body = await result!.json();
      expect(body.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(body.required_permission).toBe(Permission.CONTROL_AGENTS);
    });

    it('logs audit event on permission denial', async () => {
      vi.mocked(RBACService.hasPermission).mockResolvedValue(false);

      const req = mockRequest({ 'x-user-id': 'capper-1' }, '/api/agents/control');
      await enforcePermission(req, Permission.EMERGENCY_CONTROLS);

      expect(RBACService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'capper-1',
          action: 'UNAUTHORIZED_ACCESS',
          resource_id: Permission.EMERGENCY_CONTROLS,
          status: 'failure',
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Authenticated with permission → null (authorized)
  // -------------------------------------------------------------------------
  describe('authorized requests', () => {
    it('returns null when user has required permission', async () => {
      vi.mocked(RBACService.hasPermission).mockResolvedValue(true);

      const req = mockRequest({ 'x-user-id': 'ops-admin' });
      const result = await enforcePermission(req, Permission.CONTROL_AGENTS);

      expect(result).toBeNull();
    });

    it('passes correct userId to RBACService', async () => {
      vi.mocked(RBACService.hasPermission).mockResolvedValue(true);

      const req = mockRequest({ 'x-user-id': 'ops-admin' });
      await enforcePermission(req, Permission.RUN_BACKFILL);

      expect(RBACService.hasPermission).toHaveBeenCalledWith('ops-admin', Permission.RUN_BACKFILL);
    });

    it('does not log audit on success', async () => {
      vi.mocked(RBACService.hasPermission).mockResolvedValue(true);

      const req = mockRequest({ 'x-user-id': 'ops-admin' });
      await enforcePermission(req, Permission.CONTROL_AGENTS);

      expect(RBACService.logAudit).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Permission-specific enforcement (maps to route targets)
  // -------------------------------------------------------------------------
  describe('enforced surface permissions', () => {
    const surfaces = [
      { name: 'agents/control (ops)', permission: Permission.CONTROL_AGENTS },
      { name: 'agents/control (kill)', permission: Permission.EMERGENCY_CONTROLS },
      { name: 'lifecycle/retry', permission: Permission.REPLAY_WORKFLOWS },
      { name: 'ops/submit', permission: Permission.RUN_BACKFILL },
      { name: 'agents/control GET', permission: Permission.VIEW_METRICS },
    ];

    for (const surface of surfaces) {
      it(`${surface.name}: authorized user passes`, async () => {
        vi.mocked(RBACService.hasPermission).mockResolvedValue(true);
        const req = mockRequest({ 'x-user-id': 'test-user' });
        const result = await enforcePermission(req, surface.permission);
        expect(result).toBeNull();
      });

      it(`${surface.name}: unauthorized user gets 403`, async () => {
        vi.mocked(RBACService.hasPermission).mockResolvedValue(false);
        const req = mockRequest({ 'x-user-id': 'test-user' });
        const result = await enforcePermission(req, surface.permission);
        expect(result).not.toBeNull();
        expect(result!.status).toBe(403);
      });
    }
  });
});
