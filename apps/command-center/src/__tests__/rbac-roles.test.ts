/**
 * Tests for RBAC role/scope evaluation.
 * SPRINT-049-LAYER3-PHASE10-CC-AUTH-FOUNDATION
 */

import { describe, it, expect } from 'vitest';

import { Role, Permission, roleHasPermission, getPermissionsForRole } from '@/lib/rbac';

describe('Role enum', () => {
  it('defines all required roles', () => {
    expect(Role.CAPPER).toBe('CAPPER');
    expect(Role.ANALYST).toBe('ANALYST');
    expect(Role.VIEWER).toBe('VIEWER');
    expect(Role.OPS).toBe('OPS');
    expect(Role.ADMIN).toBe('ADMIN');
  });
});

describe('roleHasPermission', () => {
  // CAPPER — minimal view permissions
  it('CAPPER can view dashboard', () => {
    expect(roleHasPermission(Role.CAPPER, Permission.VIEW_DASHBOARD)).toBe(true);
  });

  it('CAPPER can view metrics', () => {
    expect(roleHasPermission(Role.CAPPER, Permission.VIEW_METRICS)).toBe(true);
  });

  it('CAPPER cannot view logs', () => {
    expect(roleHasPermission(Role.CAPPER, Permission.VIEW_LOGS)).toBe(false);
  });

  it('CAPPER cannot control agents', () => {
    expect(roleHasPermission(Role.CAPPER, Permission.CONTROL_AGENTS)).toBe(false);
  });

  // ANALYST — CAPPER + logs, traces, events
  it('ANALYST can view logs', () => {
    expect(roleHasPermission(Role.ANALYST, Permission.VIEW_LOGS)).toBe(true);
  });

  it('ANALYST can view traces', () => {
    expect(roleHasPermission(Role.ANALYST, Permission.VIEW_TRACES)).toBe(true);
  });

  it('ANALYST can view events', () => {
    expect(roleHasPermission(Role.ANALYST, Permission.VIEW_EVENTS)).toBe(true);
  });

  it('ANALYST cannot control agents', () => {
    expect(roleHasPermission(Role.ANALYST, Permission.CONTROL_AGENTS)).toBe(false);
  });

  // VIEWER — same as ANALYST (backward compatible)
  it('VIEWER has same permissions as ANALYST', () => {
    const viewerPerms = getPermissionsForRole(Role.VIEWER);
    const analystPerms = getPermissionsForRole(Role.ANALYST);
    expect(viewerPerms).toEqual(analystPerms);
  });

  // OPS — VIEWER + operational controls
  it('OPS can control agents', () => {
    expect(roleHasPermission(Role.OPS, Permission.CONTROL_AGENTS)).toBe(true);
  });

  it('OPS can manage queues', () => {
    expect(roleHasPermission(Role.OPS, Permission.MANAGE_QUEUES)).toBe(true);
  });

  it('OPS can run backfill', () => {
    expect(roleHasPermission(Role.OPS, Permission.RUN_BACKFILL)).toBe(true);
  });

  it('OPS can replay workflows', () => {
    expect(roleHasPermission(Role.OPS, Permission.REPLAY_WORKFLOWS)).toBe(true);
  });

  it('OPS cannot freeze system', () => {
    expect(roleHasPermission(Role.OPS, Permission.FREEZE_SYSTEM)).toBe(false);
  });

  // ADMIN — all permissions
  it('ADMIN can freeze system', () => {
    expect(roleHasPermission(Role.ADMIN, Permission.FREEZE_SYSTEM)).toBe(true);
  });

  it('ADMIN has emergency controls', () => {
    expect(roleHasPermission(Role.ADMIN, Permission.EMERGENCY_CONTROLS)).toBe(true);
  });

  it('ADMIN can manage users', () => {
    expect(roleHasPermission(Role.ADMIN, Permission.MANAGE_USERS)).toBe(true);
  });
});

describe('getPermissionsForRole', () => {
  it('returns permissions array for valid role', () => {
    const perms = getPermissionsForRole(Role.CAPPER);
    expect(Array.isArray(perms)).toBe(true);
    expect(perms.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown role', () => {
    const perms = getPermissionsForRole('UNKNOWN' as Role);
    expect(perms).toEqual([]);
  });

  it('role hierarchy is additive (each higher role includes lower)', () => {
    const capper = new Set(getPermissionsForRole(Role.CAPPER));
    const analyst = new Set(getPermissionsForRole(Role.ANALYST));
    const ops = new Set(getPermissionsForRole(Role.OPS));
    const admin = new Set(getPermissionsForRole(Role.ADMIN));

    // Every CAPPER permission is in ANALYST
    for (const p of capper) {
      expect(analyst.has(p)).toBe(true);
    }

    // Every ANALYST permission is in OPS
    for (const p of analyst) {
      expect(ops.has(p)).toBe(true);
    }

    // Every OPS permission is in ADMIN
    for (const p of ops) {
      expect(admin.has(p)).toBe(true);
    }
  });
});
