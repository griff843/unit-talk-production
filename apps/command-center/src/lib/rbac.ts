/**
 * @fileoverview RBAC (Role-Based Access Control) system for Command Center
 * Provides comprehensive authorization and audit logging
 *
 * NOTE: roles, audit_log tables may not exist in production.
 * Using 'any' casts to avoid type errors with merged database types.
 */

import { supabase } from './supabase';

import { UnitTalkTracing } from '@/lib/telemetry';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbClient = supabase as any;

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export enum Role {
  VIEWER = 'VIEWER',
  OPS = 'OPS',
  ADMIN = 'ADMIN',
}

export enum Permission {
  // View permissions
  VIEW_DASHBOARD = 'view:dashboard',
  VIEW_METRICS = 'view:metrics',
  VIEW_LOGS = 'view:logs',
  VIEW_TRACES = 'view:traces',
  VIEW_EVENTS = 'view:events',

  // Operational permissions
  CONTROL_AGENTS = 'control:agents',
  MANAGE_QUEUES = 'control:queues',
  RUN_BACKFILL = 'ops:backfill',
  REPLAY_WORKFLOWS = 'ops:replay',

  // Administrative permissions
  SAFE_MODE = 'admin:safe_mode',
  FREEZE_SYSTEM = 'admin:freeze',
  MANAGE_USERS = 'admin:users',
  SYSTEM_CONFIG = 'admin:config',

  // Emergency permissions
  EMERGENCY_CONTROLS = 'emergency:all',
}

export interface UserRole {
  user_id: string;
  role: Role;
  permissions: Permission[];
  granted_by?: string;
  granted_at: Date;
  expires_at?: Date;
  team?: string;
  region?: string;
}

export interface AuditEvent {
  id?: string;
  actor: string;
  actor_type: 'user' | 'system' | 'api' | 'agent';
  session_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  payload?: any;
  previous_state?: any;
  new_state?: any;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  status: 'success' | 'failure' | 'error';
  error_message?: string;
  duration_ms?: number;
  created_at?: Date;
}

// =============================================================================
// ROLE DEFINITIONS
// =============================================================================

// Define base permissions for each role without circular references
const VIEWER_PERMISSIONS: Permission[] = [
  Permission.VIEW_DASHBOARD,
  Permission.VIEW_METRICS,
  Permission.VIEW_LOGS,
  Permission.VIEW_EVENTS,
];

const OPS_PERMISSIONS: Permission[] = [
  // All viewer permissions
  ...VIEWER_PERMISSIONS,
  // Operational permissions
  Permission.VIEW_TRACES,
  Permission.CONTROL_AGENTS,
  Permission.MANAGE_QUEUES,
  Permission.RUN_BACKFILL,
  Permission.REPLAY_WORKFLOWS,
];

const ADMIN_PERMISSIONS: Permission[] = [
  // All ops permissions
  ...OPS_PERMISSIONS,
  // Administrative permissions
  Permission.SAFE_MODE,
  Permission.FREEZE_SYSTEM,
  Permission.MANAGE_USERS,
  Permission.SYSTEM_CONFIG,
  Permission.EMERGENCY_CONTROLS,
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.VIEWER]: VIEWER_PERMISSIONS,
  [Role.OPS]: OPS_PERMISSIONS,
  [Role.ADMIN]: ADMIN_PERMISSIONS,
};

// =============================================================================
// RBAC SERVICE
// =============================================================================

export class RBACService {
  /**
   * Check if user has specific permission
   */
  static async hasPermission(userId: string, permission: Permission): Promise<boolean> {
    try {
      const userRole = await this.getUserRole(userId);
      if (!userRole) return false;

      // Check if role has expired
      if (userRole.expires_at && new Date() > userRole.expires_at) {
        return false;
      }

      // Check explicit permissions first
      if (userRole.permissions.includes(permission)) {
        return true;
      }

      // Check role-based permissions
      const rolePermissions = ROLE_PERMISSIONS[userRole.role] || [];
      return rolePermissions.includes(permission);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Require specific permission (throws if not authorized)
   */
  static async requirePermission(
    userId: string,
    permission: Permission,
    context?: any
  ): Promise<void> {
    const hasAccess = await this.hasPermission(userId, permission);

    if (!hasAccess) {
      // Log unauthorized access attempt
      await this.logAudit({
        actor: userId,
        actor_type: 'user',
        action: 'UNAUTHORIZED_ACCESS',
        resource_type: 'permission',
        resource_id: permission,
        payload: context,
        status: 'failure',
        error_message: `User ${userId} lacks permission: ${permission}`,
      });

      throw new Error(`Access denied: insufficient permissions for ${permission}`);
    }
  }

  /**
   * Get user role and permissions
   */
  static async getUserRole(userId: string): Promise<UserRole | null> {
    try {
      const { data, error } = await dbClient
        .from('roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) return null;

      return {
        user_id: data.user_id as string,
        role: data.role as Role,
        permissions: (data.permissions as Permission[]) || [],
        granted_by: data.granted_by as string,
        granted_at: new Date(data.granted_at as string),
        expires_at: data.expires_at ? new Date(data.expires_at as string) : undefined,
        team: data.team as string,
        region: data.region as string,
      };
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  }

  /**
   * Grant role to user
   */
  static async grantRole(
    userId: string,
    role: Role,
    grantedBy: string,
    options?: {
      expiresAt?: Date;
      team?: string;
      region?: string;
      additionalPermissions?: Permission[];
    }
  ): Promise<void> {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    const allPermissions = [...rolePermissions, ...(options?.additionalPermissions || [])];

    const { error } = await dbClient.from('roles').upsert({
      user_id: userId,
      role,
      permissions: allPermissions,
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
      expires_at: options?.expiresAt?.toISOString(),
      team: options?.team,
      region: options?.region,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to grant role: ${error.message}`);
    }

    // Log role grant
    await this.logAudit({
      actor: grantedBy,
      actor_type: 'user',
      action: 'GRANT_ROLE',
      resource_type: 'user',
      resource_id: userId,
      payload: { role, permissions: allPermissions, ...options },
      status: 'success',
    });
  }

  /**
   * Revoke user role
   */
  static async revokeRole(userId: string, revokedBy: string): Promise<void> {
    const previousRole = await this.getUserRole(userId);

    const { error } = await dbClient.from('roles').delete().eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to revoke role: ${error.message}`);
    }

    // Log role revocation
    await this.logAudit({
      actor: revokedBy,
      actor_type: 'user',
      action: 'REVOKE_ROLE',
      resource_type: 'user',
      resource_id: userId,
      previous_state: previousRole,
      status: 'success',
    });
  }

  /**
   * List all users with roles
   */
  static async listUsersWithRoles(): Promise<UserRole[]> {
    const { data, error } = await dbClient
      .from('roles')
      .select('*')
      .order('granted_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return (data || []).map(row => ({
      user_id: row.user_id as string,
      role: row.role as Role,
      permissions: (row.permissions as Permission[]) || [],
      granted_by: row.granted_by as string,
      granted_at: new Date(row.granted_at as string),
      expires_at: row.expires_at ? new Date(row.expires_at as string) : undefined,
      team: row.team as string,
      region: row.region as string,
    }));
  }

  /**
   * Log audit event
   */
  static async logAudit(event: Omit<AuditEvent, 'id' | 'created_at'>): Promise<void> {
    try {
      const auditEvent = {
        ...event,
        request_id: event.request_id || UnitTalkTracing.getCurrentTraceId(),
        created_at: new Date().toISOString(),
      };

      const { error } = await dbClient.from('audit_log').insert(auditEvent);

      if (error) {
        console.error('Failed to log audit event:', error);
      }
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }

  /**
   * Get audit trail for user or resource
   */
  static async getAuditTrail(filters?: {
    actor?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    let query = dbClient.from('audit_log').select('*').order('created_at', { ascending: false });

    if (filters?.actor) {
      query = query.eq('actor', filters.actor);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }
    if (filters?.resourceId) {
      query = query.eq('resource_id', filters.resourceId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch audit trail: ${error.message}`);
    }

    return (data || []).map(row => ({
      ...(row as any),
      created_at: new Date((row as any).created_at),
    })) as AuditEvent[];
  }
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Express middleware for RBAC
 */
export function rbacMiddleware(requiredPermission: Permission) {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      await RBACService.requirePermission(userId, requiredPermission, {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
      });

      // Add user role to request for downstream use
      req.userRole = await RBACService.getUserRole(userId);
      next();
    } catch (error) {
      return res.status(403).json({
        error: error.message,
        code: 'INSUFFICIENT_PERMISSIONS',
        required_permission: requiredPermission,
      });
    }
  };
}

/**
 * React hook for client-side permission checking
 */
export function usePermissions() {
  // This would be implemented in the React components
  // For now, just export the structure
  return {
    hasPermission: (permission: Permission) => {
      // Implementation would check current user permissions
      return false;
    },
    requirePermission: (permission: Permission) => {
      // Implementation would throw or redirect if no permission
    },
    userRole: null as UserRole | null,
    loading: false,
    error: null,
  };
}
