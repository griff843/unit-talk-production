import { getAdminClient } from './db';

export type Role = 'viewer' | 'ops' | 'admin';

export interface User {
  id: string;
  email: string;
  role: Role;
  permissions: string[];
}

// Role definitions and permissions
const ROLE_PERMISSIONS = {
  viewer: [
    'view:dashboard',
    'view:health',
    'view:metrics',
  ],
  ops: [
    'view:dashboard',
    'view:health', 
    'view:metrics',
    'control:agents',
    'manage:system-config',
    'view:audit',
  ],
  admin: [
    'view:dashboard',
    'view:health',
    'view:metrics', 
    'control:agents',
    'manage:system-config',
    'manage:users',
    'emergency:controls',
    'view:audit',
    'manage:audit',
  ],
} as const;

/**
 * Get user roles from database or default fallback
 */
export async function getRolesFor(user: { id: string; email?: string }): Promise<Role[]> {
  try {
    const client = getAdminClient();
    
    // Try to get role from database first
    const { data: userData, error } = await client
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!error && userData?.role) {
      return [userData.role as Role];
    }

    // Fallback to email-based role assignment for development
    if (user.email) {
      if (user.email.includes('admin') || user.email.includes('griff')) {
        return ['admin'];
      }
      if (user.email.includes('ops')) {
        return ['ops'];
      }
    }

    // Default to viewer
    return ['viewer'];
  } catch (error) {
    console.error('Failed to get user roles:', error);
    return ['viewer']; // Safe default
  }
}

/**
 * Check if user has required role
 */
export function requireRole(userRoles: Role[], allowedRoles: Role[]): boolean {
  return userRoles.some(role => allowedRoles.includes(role));
}

/**
 * Get all permissions for user roles
 */
export function getPermissionsFor(roles: Role[]): string[] {
  const permissions = new Set<string>();
  
  for (const role of roles) {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    rolePermissions.forEach(permission => permissions.add(permission));
  }
  
  return Array.from(permissions);
}

/**
 * Check if user has specific permission
 */
export function hasPermission(userRoles: Role[], permission: string): boolean {
  const userPermissions = getPermissionsFor(userRoles);
  return userPermissions.includes(permission);
}

/**
 * Middleware helper to check role authorization
 */
export function createRoleGuard(allowedRoles: Role[]) {
  return async (user: { id: string; email?: string }) => {
    const roles = await getRolesFor(user);
    
    if (!requireRole(roles, allowedRoles)) {
      throw new Error(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
    }
    
    return { roles, permissions: getPermissionsFor(roles) };
  };
}

/**
 * Extract user info from request headers (for development/testing)
 */
export function extractUserFromHeaders(headers: Headers): { id: string; email?: string } | null {
  // In production, this would come from JWT/session
  const userId = headers.get('x-user-id');
  const userEmail = headers.get('x-user-email');
  
  if (userId) {
    return { id: userId, email: userEmail || undefined };
  }
  
  // Development fallback - use a test user
  return { id: 'dev-user', email: 'admin@example.com' };
}

/**
 * Create a 403 Forbidden response
 */
export function createForbiddenResponse(message = 'Access denied') {
  return Response.json(
    {
      error: 'Forbidden',
      message,
      code: 'INSUFFICIENT_PERMISSIONS',
    },
    { status: 403 }
  );
}