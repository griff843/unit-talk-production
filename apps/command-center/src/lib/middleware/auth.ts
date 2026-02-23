import { NextRequest, NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';

// Using 'any' cast to avoid type recursion with merged database types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbClient = supabase as any;

/**
 * Authentication and Authorization Middleware
 * Provides role-based access control (RBAC) for the Command Center
 */

export enum Permission {
  // Dashboard permissions
  VIEW_DASHBOARD = 'view:dashboard',
  VIEW_ANALYTICS = 'view:analytics',

  // Agent permissions
  VIEW_AGENTS = 'view:agents',
  CONTROL_AGENTS = 'control:agents',
  CONFIGURE_AGENTS = 'configure:agents',

  // User management permissions
  VIEW_USERS = 'view:users',
  MANAGE_USERS = 'manage:users',
  BAN_USERS = 'ban:users',

  // System permissions
  VIEW_SYSTEM = 'view:system',
  CONFIGURE_SYSTEM = 'configure:system',
  EMERGENCY_CONTROLS = 'emergency:controls',
  MAINTENANCE_MODE = 'maintenance:mode',

  // Security permissions
  VIEW_SECURITY = 'view:security',
  MANAGE_SECURITY = 'manage:security',
  VIEW_AUDIT_LOGS = 'view:audit_logs',

  // Administrative permissions
  SYSTEM_ADMIN = 'system:admin',
  USER_ADMIN = 'user:admin',
  SECURITY_ADMIN = 'security:admin',
}

export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  OPERATOR = 'operator',
  ANALYST = 'analyst',
  VIEWER = 'viewer',
}

interface User {
  id: string;
  email: string;
  role: Role;
  permissions: Permission[];
  status: 'active' | 'inactive' | 'suspended';
  last_login?: string;
  created_at: string;
}

interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: Role) => boolean;
  requiresPermission: (permission: Permission) => void;
}

// Role-based permission mapping
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: Object.values(Permission), // All permissions

  [Role.ADMIN]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_AGENTS,
    Permission.CONTROL_AGENTS,
    Permission.CONFIGURE_AGENTS,
    Permission.VIEW_USERS,
    Permission.MANAGE_USERS,
    Permission.VIEW_SYSTEM,
    Permission.CONFIGURE_SYSTEM,
    Permission.VIEW_SECURITY,
    Permission.MANAGE_SECURITY,
    Permission.VIEW_AUDIT_LOGS,
    Permission.USER_ADMIN,
  ],

  [Role.OPERATOR]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_AGENTS,
    Permission.CONTROL_AGENTS,
    Permission.VIEW_USERS,
    Permission.VIEW_SYSTEM,
    Permission.VIEW_SECURITY,
    Permission.VIEW_AUDIT_LOGS,
  ],

  [Role.ANALYST]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_AGENTS,
    Permission.VIEW_USERS,
    Permission.VIEW_SYSTEM,
    Permission.VIEW_SECURITY,
  ],

  [Role.VIEWER]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_AGENTS,
    Permission.VIEW_USERS,
  ],
};

/**
 * Authentication middleware
 * Verifies JWT token and extracts user information
 */
export async function authenticate(request: NextRequest): Promise<AuthContext> {
  try {
    // Get token from Authorization header or cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth-token')?.value;

    if (!token) {
      return createUnauthenticatedContext();
    }

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await dbClient.auth.getUser(token);

    if (error || !user) {
      console.log('🔐 Authentication failed:', error?.message);
      return createUnauthenticatedContext();
    }

    // Get user profile with role and permissions
    const { data: profile, error: profileError } = await dbClient
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.log('👤 User profile not found:', user.id);
      return createUnauthenticatedContext();
    }

    // Check if user is active
    if (profile.status !== 'active') {
      console.log('🚫 User account is not active:', profile.status);
      return createUnauthenticatedContext();
    }

    const userRole = profile.role as Role;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    const authenticatedUser: User = {
      id: user.id,
      email: (user.email as string) || '',
      role: userRole,
      permissions: userPermissions,
      status: profile.status,
      last_login: profile.last_login as string,
      created_at: profile.created_at as string,
    };

    // Update last login timestamp
    await dbClient
      .from('user_profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    return createAuthenticatedContext(authenticatedUser);
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return createUnauthenticatedContext();
  }
}

/**
 * Authorization middleware
 * Checks if user has required permissions for specific actions
 */
export function requirePermission(permission: Permission) {
  return (authContext: AuthContext) => {
    if (!authContext.isAuthenticated) {
      throw new AuthenticationError('Authentication required');
    }

    if (!authContext.hasPermission(permission)) {
      throw new AuthorizationError(`Insufficient permissions. Required: ${permission}`);
    }
  };
}

/**
 * Role-based access control middleware
 */
export function requireRole(role: Role) {
  return (authContext: AuthContext) => {
    if (!authContext.isAuthenticated) {
      throw new AuthenticationError('Authentication required');
    }

    if (!authContext.hasRole(role)) {
      throw new AuthorizationError(`Insufficient role. Required: ${role}`);
    }
  };
}

/**
 * API endpoint protection middleware
 */
export function withAuth(
  handler: (request: NextRequest, authContext: AuthContext) => Promise<NextResponse>,
  requiredPermission?: Permission
) {
  return async (request: NextRequest) => {
    try {
      const authContext = await authenticate(request);

      // Check if authentication is required
      if (requiredPermission && !authContext.isAuthenticated) {
        return NextResponse.json(
          {
            success: false,
            error: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED',
          },
          { status: 401 }
        );
      }

      // Check permissions if specified
      if (requiredPermission && !authContext.hasPermission(requiredPermission)) {
        // Log unauthorized access attempt
        await logUnauthorizedAccess(request, authContext, requiredPermission);

        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            required_permission: requiredPermission,
          },
          { status: 403 }
        );
      }

      // Call the actual handler with auth context
      return await handler(request, authContext);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: 'AUTHENTICATION_ERROR',
          },
          { status: 401 }
        );
      }

      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: 'AUTHORIZATION_ERROR',
          },
          { status: 403 }
        );
      }

      console.error('❌ Auth middleware error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Emergency access bypass for critical situations
 * Should only be used with extreme caution and proper logging
 */
export async function emergencyBypass(
  request: NextRequest,
  emergencyCode: string,
  justification: string
): Promise<AuthContext> {
  // SPRINT-SCHEMA-ENV-GATES-002: Lazy env access moved inside function
  const validEmergencyCode = process.env.EMERGENCY_BYPASS_CODE;

  if (!validEmergencyCode || emergencyCode !== validEmergencyCode) {
    throw new AuthorizationError('Invalid emergency code');
  }

  // Log emergency bypass usage
  console.log('🚨 EMERGENCY BYPASS ACTIVATED', {
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent'),
    justification,
    timestamp: new Date().toISOString(),
  });

  // Create emergency admin context
  const emergencyUser: User = {
    id: 'emergency-bypass',
    email: 'emergency@system.local',
    role: Role.SUPER_ADMIN,
    permissions: Object.values(Permission),
    status: 'active',
    created_at: new Date().toISOString(),
  };

  return createAuthenticatedContext(emergencyUser);
}

// Helper functions
function createAuthenticatedContext(user: User): AuthContext {
  return {
    user,
    isAuthenticated: true,
    hasPermission: (permission: Permission) => user.permissions.includes(permission),
    hasRole: (role: Role) => user.role === role || user.role === Role.SUPER_ADMIN,
    requiresPermission: (permission: Permission) => {
      if (!user.permissions.includes(permission)) {
        throw new AuthorizationError(`Missing permission: ${permission}`);
      }
    },
  };
}

function createUnauthenticatedContext(): AuthContext {
  return {
    user: null,
    isAuthenticated: false,
    hasPermission: () => false,
    hasRole: () => false,
    requiresPermission: (permission: Permission) => {
      throw new AuthenticationError('Authentication required');
    },
  };
}

async function logUnauthorizedAccess(
  request: NextRequest,
  authContext: AuthContext,
  requiredPermission: Permission
) {
  try {
    const auditEvent = {
      user_id: authContext.user?.id || 'anonymous',
      action: 'unauthorized_access_attempt',
      resource: request.url,
      details: {
        method: request.method,
        required_permission: requiredPermission,
        user_permissions: authContext.user?.permissions || [],
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      status: 'failure' as const,
      risk_level: 'high' as const,
    };

    await dbClient.from('audit_logs').insert(auditEvent);
  } catch (error) {
    console.error('❌ Failed to log unauthorized access:', error);
  }
}

// Custom error classes
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// Utility functions for API usage
export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function canUserPerformAction(user: User, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

export function isHighPrivilegeAction(permission: Permission): boolean {
  const highPrivilegePermissions = [
    Permission.EMERGENCY_CONTROLS,
    Permission.MAINTENANCE_MODE,
    Permission.SYSTEM_ADMIN,
    Permission.BAN_USERS,
    Permission.CONFIGURE_SYSTEM,
  ];

  return highPrivilegePermissions.includes(permission);
}
