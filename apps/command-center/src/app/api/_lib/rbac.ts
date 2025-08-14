import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { writeAudit } from '@/server/systemConfig';

export type UserRole = 'admin' | 'ops' | 'viewer';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Get user role from Supabase session
 */
export async function getUserRole(request?: NextRequest): Promise<{ user: AuthenticatedUser | null; error?: string }> {
  try {
    // DEV ONLY override
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_ASSUME_ROLE) {
      return { 
        user: { 
          id: 'dev', 
          email: 'dev@local', 
          role: process.env.DEV_ASSUME_ROLE as UserRole 
        } 
      };
    }
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { user: null, error: 'Not authenticated' };
    }

    // Extract role from user metadata or default to viewer
    // In production, this would come from your user management system
    const role = (user.user_metadata?.role || 'viewer') as UserRole;
    
    // Validate role
    if (!['admin', 'ops', 'viewer'].includes(role)) {
      return { user: null, error: 'Invalid user role' };
    }

    return {
      user: {
        id: user.id,
        email: user.email || '',
        role,
      }
    };
  } catch (error) {
    console.error('Error getting user role:', error);
    return { user: null, error: 'Authentication error' };
  }
}

/**
 * Check if user has required permissions for an action
 */
export function hasPermission(userRole: UserRole, action: string): boolean {
  const permissions = {
    admin: ['read', 'toggle', 'resolve', 'rollback', 'test', 'audit'],
    ops: ['read', 'toggle', 'resolve', 'audit'],
    viewer: ['read'],
  };

  return permissions[userRole]?.includes(action) || false;
}

/**
 * Middleware to check user permissions for route access
 */
export async function requirePermission(
  request: NextRequest,
  requiredAction: string
): Promise<{ success: boolean; user?: AuthenticatedUser; error?: string }> {
  const { user, error } = await getUserRole(request);
  
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  if (!hasPermission(user.role, requiredAction)) {
    // Log unauthorized access attempt
    await writeAudit({
      actor: user.email,
      action: 'unauthorized_access_attempt',
      target: requiredAction,
      meta: {
        user_role: user.role,
        required_action: requiredAction,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent'),
      },
      user_id: user.id,
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return { 
      success: false, 
      error: `Insufficient permissions - ${getRequiredRoleForAction(requiredAction)} role required` 
    };
  }

  return { success: true, user };
}

/**
 * Get the minimum required role for an action
 */
function getRequiredRoleForAction(action: string): string {
  switch (action) {
    case 'rollback':
    case 'test':
      return 'Admin';
    case 'toggle':
    case 'resolve':
    case 'audit':
      return 'Ops';
    case 'read':
      return 'Viewer';
    default:
      return 'Admin';
  }
}

/**
 * Helper to extract client IP and user agent
 */
export function getClientMetadata(request: NextRequest) {
  return {
    ip_address: request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                undefined,
    user_agent: request.headers.get('user-agent') || undefined,
  };
}

/**
 * Audit helper for API route actions
 */
export async function auditApiAction(
  user: AuthenticatedUser,
  action: string,
  target: string,
  meta: Record<string, any> = {},
  request?: NextRequest
) {
  const clientMeta = request ? getClientMetadata(request) : {};
  
  return await writeAudit({
    actor: user.email,
    action,
    target,
    meta: {
      ...meta,
      timestamp: new Date().toISOString(),
      user_role: user.role,
    },
    user_id: user.id,
    ...clientMeta,
  });
}

/**
 * Role-based response helper
 */
export function createUnauthorizedResponse(error: string, status: number = 403) {
  return new Response(
    JSON.stringify({ 
      error,
      timestamp: new Date().toISOString(),
    }), 
    { 
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Success response helper with audit logging
 */
export function createSuccessResponse(
  data: any,
  user: AuthenticatedUser,
  action: string,
  target: string,
  request?: NextRequest
) {
  // Log successful action (fire and forget)
  auditApiAction(user, action, target, { response_data: data }, request)
    .catch(error => console.error('Failed to audit successful action:', error));

  return new Response(
    JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}