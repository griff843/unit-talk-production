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

import { NextRequest } from 'next/server';

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
