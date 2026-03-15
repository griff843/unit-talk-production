/**
 * Server-side auth identity helper for Command Center API routes.
 *
 * Centralizes operator identity extraction from requests.
 * All route handlers should use getOperatorIdentity() instead of
 * directly reading request.headers.get('x-user-id').
 *
 * Current source: x-user-id request header
 * Future: Supabase JWT auth (see middleware/auth.ts for scaffolding)
 *
 * SPRINT-049-LAYER3-PHASE10-CC-AUTH-FOUNDATION
 */

import { NextRequest, NextResponse } from 'next/server';

import { Permission, RBACService } from './rbac';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OperatorIdentity {
  /** Operator/user ID */
  userId: string;
  /** How identity was determined */
  source: 'header' | 'anonymous';
}

// ---------------------------------------------------------------------------
// Identity extraction
// ---------------------------------------------------------------------------

/**
 * Extract operator identity from a Next.js API request.
 *
 * Reads the x-user-id header. If absent, returns an anonymous identity.
 * Routes that require authentication should use requireOperatorIdentity().
 */
export function getOperatorIdentity(request: NextRequest): OperatorIdentity {
  const userId = request.headers.get('x-user-id');
  if (userId && userId.trim().length > 0) {
    return { userId: userId.trim(), source: 'header' };
  }
  return { userId: 'anonymous', source: 'anonymous' };
}

/**
 * Require a non-anonymous operator identity.
 *
 * Returns the identity if present, or null if the request has no
 * authenticated identity. Callers should return a 401 response when null.
 */
export function requireOperatorIdentity(request: NextRequest): OperatorIdentity | null {
  const identity = getOperatorIdentity(request);
  if (identity.source === 'anonymous') {
    return null;
  }
  return identity;
}

// ---------------------------------------------------------------------------
// Route-level permission enforcement
// ---------------------------------------------------------------------------

/**
 * Enforce identity + permission on an API route handler.
 *
 * Returns a NextResponse (401 or 403) if the check fails, or null if the
 * caller is authorized. Usage:
 *
 *   const denied = await enforcePermission(request, Permission.FREEZE_SYSTEM);
 *   if (denied) return denied;
 *   // ... proceed with authorized logic
 *
 * SPRINT-050-LAYER3-PHASE10-CC-PERMISSION-ENFORCEMENT
 */
export async function enforcePermission(
  request: NextRequest,
  permission: Permission
): Promise<NextResponse | null> {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const hasAccess = await RBACService.hasPermission(identity.userId, permission);
  if (!hasAccess) {
    await RBACService.logAudit({
      actor: identity.userId,
      actor_type: 'user',
      action: 'UNAUTHORIZED_ACCESS',
      resource_type: 'permission',
      resource_id: permission,
      payload: { path: request.nextUrl.pathname, method: request.method },
      status: 'failure',
      error_message: `User ${identity.userId} lacks permission: ${permission}`,
    });
    return NextResponse.json(
      {
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required_permission: permission,
      },
      { status: 403 }
    );
  }

  return null; // authorized
}
