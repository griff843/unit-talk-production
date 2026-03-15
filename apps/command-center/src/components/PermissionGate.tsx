'use client';

import type { ReactNode } from 'react';

import { Permission , usePermissions } from '@/lib/rbac';

/**
 * Conditionally renders children based on the current operator's permissions.
 *
 * - If the operator has the required permission, renders `children`.
 * - Otherwise renders `fallback` (defaults to nothing).
 *
 * SPRINT-050-LAYER3-PHASE10-CC-PERMISSION-ENFORCEMENT
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
