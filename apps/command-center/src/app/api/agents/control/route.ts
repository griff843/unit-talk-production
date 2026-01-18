/**
 * Agent Control API Endpoint
 *
 * Phase 1 Agent Control Plane - Real enforcement integration.
 * Provides RBAC-gated agent lifecycle control operations:
 * - pause/resume/stop/drain (operator+)
 * - kill with confirmation flow (admin+)
 * - emergency stop (super_admin only)
 *
 * All operations are audited and idempotent.
 *
 * @module agents/control
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

/**
 * RPC Response Types
 */
interface StateChangeResponse {
  success: boolean;
  previous_state?: string;
  new_state?: string;
  error?: string;
  action_required?: string;
}

interface KillConfirmationResponse {
  confirmation_token: string;
  expires_at: string;
}

interface KillConfirmResponse {
  success: boolean;
  agent_id?: string;
  killed_at?: string;
  error?: string;
}

interface AgentRegistryRow {
  agent_id: string;
  agent_type: string;
  display_name: string;
  desired_state: string;
  current_state: string;
  last_heartbeat: string | null;
  heartbeat_timeout_ms: number | null;
}

interface MetricsSnapshotRow {
  run_count: number;
  success_count: number;
  failure_count: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  backlog_size: number;
  collected_at: string;
}

interface LifecycleEventRow {
  event_type: string;
  previous_state: string | null;
  new_state: string | null;
  requested_by: string | null;
  reason: string | null;
  timestamp: string;
}

/**
 * RBAC Roles for agent control
 */
export type AgentControlRole = 'viewer' | 'operator' | 'admin' | 'super_admin';

/**
 * Permission mapping
 */
const ROLE_PERMISSIONS: Record<AgentControlRole, string[]> = {
  viewer: ['view_agents', 'view_metrics'],
  operator: [
    'view_agents',
    'view_metrics',
    'view_lifecycle_events',
    'pause_agent',
    'resume_agent',
    'stop_agent',
    'drain_agent',
  ],
  admin: [
    'view_agents',
    'view_metrics',
    'view_lifecycle_events',
    'pause_agent',
    'resume_agent',
    'stop_agent',
    'drain_agent',
    'kill_agent',
  ],
  super_admin: [
    'view_agents',
    'view_metrics',
    'view_lifecycle_events',
    'pause_agent',
    'resume_agent',
    'stop_agent',
    'drain_agent',
    'kill_agent',
    'emergency_stop_all',
  ],
};

/**
 * Check if user has permission for action
 */
function hasPermission(role: AgentControlRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Get operator context from session
 * In production, this would come from auth middleware
 */
async function getOperatorContext(): Promise<{
  userId: string;
  role: AgentControlRole;
  correlationId: string;
}> {
  // For development/testing, default to operator role
  // In production, this would be extracted from session/JWT
  const cookieStore = await cookies();
  const userRole = (cookieStore.get('user_role')?.value as AgentControlRole) || 'operator';
  const userId = cookieStore.get('user_id')?.value || 'system-operator';

  return {
    userId,
    role: userRole,
    correlationId: `ctrl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

/**
 * Log audit event
 */
async function auditLog(
  client: ReturnType<typeof getSupabaseClient>,
  action: string,
  agentId: string,
  result: 'success' | 'failure' | 'denied',
  operatorContext: Awaited<ReturnType<typeof getOperatorContext>>,
  details?: Record<string, unknown>
): Promise<void> {
  if (!client) return;

  try {
    await client.from('audit_log').insert({
      action: `agent_control.${action}`,
      resource_type: 'agent',
      resource_id: agentId,
      actor_id: operatorContext.userId,
      actor_role: operatorContext.role,
      result,
      correlation_id: operatorContext.correlationId,
      metadata: {
        ...details,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * POST /api/agents/control
 *
 * Agent control operations. Request body:
 * {
 *   action: 'pause' | 'resume' | 'stop' | 'drain' | 'kill_request' | 'kill_confirm' | 'emergency_stop',
 *   agentId: string,
 *   reason?: string,
 *   confirmationToken?: string (for kill_confirm)
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { action, agentId, reason, confirmationToken } = body;

    console.log('🎮 POST /api/agents/control', { action, agentId, reason });

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      );
    }

    // Get operator context
    const operatorContext = await getOperatorContext();

    // Map action to permission
    const actionPermissions: Record<string, string> = {
      pause: 'pause_agent',
      resume: 'resume_agent',
      stop: 'stop_agent',
      drain: 'drain_agent',
      kill_request: 'kill_agent',
      kill_confirm: 'kill_agent',
      emergency_stop: 'emergency_stop_all',
    };

    const requiredPermission = actionPermissions[action];
    if (!requiredPermission) {
      return NextResponse.json(
        { success: false, error: `Invalid action: ${action}` },
        { status: 400 }
      );
    }

    // Check permission
    if (!hasPermission(operatorContext.role, requiredPermission)) {
      await auditLog(
        getSupabaseClient(),
        action,
        agentId || '*',
        'denied',
        operatorContext,
        { requiredPermission }
      );

      return NextResponse.json(
        {
          success: false,
          error: `Permission denied: ${requiredPermission} required (your role: ${operatorContext.role})`,
          permissionDenied: true,
        },
        { status: 403 }
      );
    }

    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable' },
        { status: 503 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'pause':
      case 'resume':
      case 'stop':
      case 'drain': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId is required' },
            { status: 400 }
          );
        }

        const desiredState =
          action === 'pause'
            ? 'paused'
            : action === 'resume'
              ? 'running'
              : action === 'stop'
                ? 'stopped'
                : 'draining';

        const { data: rpcData, error } = await client.rpc('request_agent_state_change', {
          p_agent_id: agentId,
          p_desired_state: desiredState,
          p_requested_by: operatorContext.userId,
          p_reason: reason || `Operator ${action} command`,
          p_correlation_id: operatorContext.correlationId,
        });

        if (error) {
          await auditLog(client, action, agentId, 'failure', operatorContext, {
            error: error.message,
          });

          return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
          );
        }

        // Type assertion for RPC response
        const data = rpcData as StateChangeResponse | null;

        if (!data?.success) {
          await auditLog(client, action, agentId, 'failure', operatorContext, {
            error: data?.error || data?.action_required,
          });

          return NextResponse.json({
            success: false,
            error: data?.error || data?.action_required || 'State change failed',
            actionRequired: data?.action_required,
          });
        }

        await auditLog(client, action, agentId, 'success', operatorContext, {
          previousState: data.previous_state,
          newState: data.new_state,
        });

        return NextResponse.json({
          success: true,
          data: {
            agentId,
            command: action,
            previousState: data.previous_state,
            newState: data.new_state,
            timestamp: new Date().toISOString(),
          },
          message: `Agent ${action} command executed successfully`,
          latencyMs: Date.now() - startTime,
        });
      }

      case 'kill_request': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId is required' },
            { status: 400 }
          );
        }

        if (!reason) {
          return NextResponse.json(
            { success: false, error: 'reason is required for kill operations' },
            { status: 400 }
          );
        }

        const { data: rpcData, error } = await client.rpc('create_kill_confirmation', {
          p_agent_id: agentId,
          p_requested_by: operatorContext.userId,
          p_reason: reason,
          p_validity_seconds: 60, // 60 second token validity
        });

        if (error) {
          await auditLog(client, 'kill_request', agentId, 'failure', operatorContext, {
            error: error.message,
          });

          return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
          );
        }

        // Type assertion for RPC response
        const data = rpcData as KillConfirmationResponse | null;

        await auditLog(client, 'kill_request', agentId, 'success', operatorContext, {
          expiresAt: data?.expires_at,
        });

        return NextResponse.json({
          success: true,
          data: {
            agentId,
            confirmationToken: data?.confirmation_token,
            expiresAt: data?.expires_at,
            expiresInSeconds: 60,
          },
          message:
            'Kill confirmation token created. You have 60 seconds to confirm.',
          latencyMs: Date.now() - startTime,
        });
      }

      case 'kill_confirm': {
        if (!confirmationToken) {
          return NextResponse.json(
            { success: false, error: 'confirmationToken is required' },
            { status: 400 }
          );
        }

        const { data: rpcData, error } = await client.rpc('confirm_agent_kill', {
          p_confirmation_token: confirmationToken,
          p_confirmed_by: operatorContext.userId,
        });

        if (error) {
          await auditLog(client, 'kill_confirm', agentId || 'unknown', 'failure', operatorContext, {
            error: error.message,
          });

          return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
          );
        }

        // Type assertion for RPC response
        const data = rpcData as KillConfirmResponse | null;

        if (!data?.success) {
          await auditLog(client, 'kill_confirm', agentId || 'unknown', 'failure', operatorContext, {
            error: data?.error,
          });

          return NextResponse.json({
            success: false,
            error: data?.error || 'Kill confirmation failed',
          });
        }

        await auditLog(client, 'kill_confirm', data.agent_id || 'unknown', 'success', operatorContext, {
          killedAt: data.killed_at,
        });

        return NextResponse.json({
          success: true,
          data: {
            agentId: data.agent_id,
            command: 'kill',
            newState: 'killed',
            killedAt: data.killed_at,
            timestamp: new Date().toISOString(),
          },
          message: `Agent ${data.agent_id} has been killed`,
          latencyMs: Date.now() - startTime,
        });
      }

      case 'emergency_stop': {
        // Super admin only - stop all agents
        try {
          // Set system-wide emergency stop flag
          await client.from('system_status').upsert({
            id: 'global',
            emergency_stop: true,
            emergency_stop_reason: reason || 'Emergency stop triggered',
            emergency_stop_by: operatorContext.userId,
            emergency_stop_at: new Date().toISOString(),
          });

          // Get all running agents
          const { data: agents } = await client
            .from('agent_registry')
            .select('agent_id')
            .in('current_state', ['running', 'paused', 'draining']);

          let stoppedCount = 0;
          for (const agent of agents || []) {
            await client.rpc('request_agent_state_change', {
              p_agent_id: agent.agent_id,
              p_desired_state: 'stopped',
              p_requested_by: operatorContext.userId,
              p_reason: `Emergency stop: ${reason || 'No reason provided'}`,
              p_correlation_id: operatorContext.correlationId,
            });
            stoppedCount++;
          }

          await auditLog(client, 'emergency_stop', '*', 'success', operatorContext, {
            reason,
            agentsStopped: stoppedCount,
          });

          return NextResponse.json({
            success: true,
            data: {
              agentsStopped: stoppedCount,
              timestamp: new Date().toISOString(),
            },
            message: `Emergency stop activated. ${stoppedCount} agents stopped.`,
            latencyMs: Date.now() - startTime,
          });
        } catch (error) {
          await auditLog(client, 'emergency_stop', '*', 'failure', operatorContext, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          return NextResponse.json(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Emergency stop failed',
            },
            { status: 500 }
          );
        }
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ POST /api/agents/control error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/control
 *
 * Get agent control status from agent_registry table.
 * Query params:
 * - agentId: specific agent
 * - includeMetrics: include metrics snapshots
 * - includeEvents: include lifecycle events
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const includeMetrics = searchParams.get('includeMetrics') === 'true';
    const includeEvents = searchParams.get('includeEvents') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    console.log('📊 GET /api/agents/control', { agentId, includeMetrics, includeEvents });

    const operatorContext = await getOperatorContext();

    // Viewers can see agent status
    if (!hasPermission(operatorContext.role, 'view_agents')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied: view_agents required',
          permissionDenied: true,
        },
        { status: 403 }
      );
    }

    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable' },
        { status: 503 }
      );
    }

    // Get specific agent
    if (agentId) {
      const { data: agentData, error } = await client
        .from('agent_registry')
        .select('*')
        .eq('agent_id', agentId)
        .single();

      if (error || !agentData) {
        return NextResponse.json(
          { success: false, error: 'Agent not found' },
          { status: 404 }
        );
      }

      // Type assertion for agent data (Supabase returns unknown)
      const agent = agentData as unknown as AgentRegistryRow;

      const heartbeatAge = agent.last_heartbeat
        ? Date.now() - new Date(agent.last_heartbeat).getTime()
        : Infinity;

      const result: Record<string, unknown> = {
        agentId: agent.agent_id,
        agentType: agent.agent_type,
        displayName: agent.display_name,
        desiredState: agent.desired_state,
        currentState: agent.current_state,
        lastHeartbeat: agent.last_heartbeat,
        isHealthy: heartbeatAge < (agent.heartbeat_timeout_ms || 30000),
        heartbeatAgeMs: agent.last_heartbeat ? heartbeatAge : null,
      };

      // Include metrics if requested
      if (includeMetrics && hasPermission(operatorContext.role, 'view_metrics')) {
        const { data: metricsData } = await client
          .from('agent_metrics_snapshots')
          .select('*')
          .eq('agent_id', agentId)
          .order('collected_at', { ascending: false })
          .limit(limit);

        // Type assertion for metrics data (Supabase returns unknown)
        const metrics = (metricsData || []) as unknown as MetricsSnapshotRow[];

        result.metrics = metrics.map((m) => ({
          runCount: m.run_count,
          successCount: m.success_count,
          failureCount: m.failure_count,
          avgLatencyMs: m.avg_latency_ms,
          p95LatencyMs: m.p95_latency_ms,
          backlogSize: m.backlog_size,
          collectedAt: m.collected_at,
        }));
      }

      // Include lifecycle events if requested
      if (includeEvents && hasPermission(operatorContext.role, 'view_lifecycle_events')) {
        const { data: eventsData } = await client
          .from('agent_lifecycle_events')
          .select('*')
          .eq('agent_id', agentId)
          .order('timestamp', { ascending: false })
          .limit(limit);

        // Type assertion for events data (Supabase returns unknown)
        const events = (eventsData || []) as unknown as LifecycleEventRow[];

        result.lifecycleEvents = events.map((e) => ({
          eventType: e.event_type,
          previousState: e.previous_state,
          newState: e.new_state,
          requestedBy: e.requested_by,
          reason: e.reason,
          timestamp: e.timestamp,
        }));
      }

      return NextResponse.json({
        success: true,
        data: result,
        source: 'agent_registry',
      });
    }

    // List all agents
    const { data: agentsData, error } = await client
      .from('agent_registry')
      .select('*')
      .order('agent_id');

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Type assertion for agents data (Supabase returns unknown)
    const agents = (agentsData || []) as unknown as AgentRegistryRow[];

    const agentList = agents.map((agent) => {
      const heartbeatAge = agent.last_heartbeat
        ? Date.now() - new Date(agent.last_heartbeat).getTime()
        : Infinity;

      return {
        agentId: agent.agent_id,
        agentType: agent.agent_type,
        displayName: agent.display_name,
        desiredState: agent.desired_state,
        currentState: agent.current_state,
        lastHeartbeat: agent.last_heartbeat,
        isHealthy: heartbeatAge < (agent.heartbeat_timeout_ms || 30000),
      };
    });

    // Calculate summary
    const summary = {
      total: agentList.length,
      running: agentList.filter((a) => a.currentState === 'running').length,
      paused: agentList.filter((a) => a.currentState === 'paused').length,
      stopped: agentList.filter((a) => a.currentState === 'stopped').length,
      draining: agentList.filter((a) => a.currentState === 'draining').length,
      killed: agentList.filter((a) => a.currentState === 'killed').length,
      healthy: agentList.filter((a) => a.isHealthy).length,
      unhealthy: agentList.filter((a) => !a.isHealthy).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        agents: agentList,
        summary,
      },
      count: agentList.length,
      source: 'agent_registry',
    });
  } catch (error) {
    console.error('❌ GET /api/agents/control error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
