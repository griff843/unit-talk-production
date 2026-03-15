'use client';

/**
 * Client-side auth context for Command Center pages and components.
 *
 * Provides operator identity to React components via context.
 * Components should use useAuth() instead of hardcoding user IDs.
 *
 * SPRINT-049-LAYER3-PHASE10-CC-AUTH-FOUNDATION
 */

import { createContext, useContext, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  /** Operator/user ID */
  userId: string;
  /** Display name (optional) */
  displayName?: string;
}

interface AuthContextValue {
  /** Authenticated user, or null if not authenticated */
  user: AuthUser | null;
  /** Whether a user identity is available */
  isAuthenticated: boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Wrap pages/layouts with AuthProvider to make operator identity
 * available to all child components via useAuth().
 */
export function AuthProvider({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the current operator identity from any client component.
 *
 * Returns { user, isAuthenticated }. If no AuthProvider is mounted,
 * returns { user: null, isAuthenticated: false }.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
