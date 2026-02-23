/**
 * @fileoverview Autopilot Mode Control API endpoint
 * Phase 7: Evidence-based autopilot rollout with promotion gates
 *
 * RBAC-protected endpoint for managing autopilot mode configuration
 * Two-step confirmation required for PROD mode activation
 */

import { NextRequest, NextResponse } from 'next/server';

import { RBACService, Permission } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { UnitTalkTracing } from '@/lib/telemetry';

// =============================================================================
// TYPES
// =============================================================================

type AutopilotMode = 'off' | 'log_only' | 'canary' | 'prod';

interface AutopilotConfig {
  mode: AutopilotMode;
  canary_percentage: number;
  pending_mode?: AutopilotMode | null;
  pending_mode_expires_at?: string | null;
  pending_mode_requested_by?: string | null;
  gate1_thresholds: {
    accuracy: number;
    false_positive_max: number;
    min_picks: number;
    window_days: number;
  };
  gate2_thresholds: {
    accuracy: number;
    false_positive_max: number;
    min_picks: number;
    window_days: number;
  };
  demotion_thresholds: {
    error_spike: number;
    accuracy_min: number;
    window_hours: number;
  };
  updated_at: string;
  updated_by: string;
}

interface GateSnapshot {
  id: string;
  gate_id: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  window_start: string;
  window_end: string;
  total_picks: number;
  proxy_accuracy_rate: number;
  false_positive_rate: number;
  required_picks: number;
  required_accuracy: number;
  required_fp_max: number;
  reasons: string[];
  current_mode: string;
  target_mode: string;
  evaluated_at: string;
}

interface DemotionEvent {
  id: string;
  from_mode: string;
  to_mode: string;
  trigger_type: string;
  trigger_details: Record<string, unknown>;
  triggered_by: string;
  demoted_at: string;
}

interface MetricsHourly {
  hour_start: string;
  total_decisions: number;
  approve_count: number;
  reject_count: number;
  unknown_count: number;
  approval_rate: number | null;
  block_reasons: Record<string, number>;
  canary_total: number;
  canary_approved: number;
  proxy_accuracy_rate: number | null;
  mode_at_time: string;
}

// =============================================================================
// AUTOPILOT SERVICE
// =============================================================================

class AutopilotService {
  /**
   * Get current autopilot configuration
   */
  static async getConfig(): Promise<AutopilotConfig | null> {
    try {
      const { data, error } = await supabase.rpc('get_autopilot_mode');

      if (error) {
        console.error('Error fetching autopilot config:', error);
        return null;
      }

      return data as unknown as AutopilotConfig;
    } catch (error) {
      console.error('Error in getConfig:', error);
      return null;
    }
  }

  /**
   * Set autopilot mode with confirmation flow
   */
  static async setMode(
    mode: AutopilotMode,
    actor: string,
    confirm: boolean = false,
    canaryPercentage?: number
  ): Promise<{
    status: 'success' | 'pending_confirmation' | 'error';
    message?: string;
    old_mode?: string;
    new_mode?: string;
    expires_at?: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('set_autopilot_mode', {
        p_mode: mode,
        p_actor: actor,
        p_confirm: confirm,
        p_canary_percentage: canaryPercentage ?? null,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as {
        status: 'success' | 'pending_confirmation';
        message?: string;
        old_mode?: string;
        new_mode?: string;
        expires_at?: string;
      };
    } catch (error) {
      console.error('Error setting autopilot mode:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get recent gate snapshots
   */
  static async getGateSnapshots(gateId?: string, limit: number = 10): Promise<GateSnapshot[]> {
    try {
      let query = supabase
        .from('autopilot_gate_snapshots')
        .select('*')
        .order('evaluated_at', { ascending: false })
        .limit(limit);

      if (gateId) {
        query = query.eq('gate_id', gateId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching gate snapshots:', error);
        return [];
      }

      return (data || []) as unknown as GateSnapshot[];
    } catch (error) {
      console.error('Error in getGateSnapshots:', error);
      return [];
    }
  }

  /**
   * Get recent demotion events
   */
  static async getDemotionEvents(limit: number = 20): Promise<DemotionEvent[]> {
    try {
      const { data, error } = await supabase
        .from('autopilot_demotion_events')
        .select('*')
        .order('demoted_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching demotion events:', error);
        return [];
      }

      return (data || []) as unknown as DemotionEvent[];
    } catch (error) {
      console.error('Error in getDemotionEvents:', error);
      return [];
    }
  }

  /**
   * Get hourly metrics for dashboard
   */
  static async getHourlyMetrics(hours: number = 24): Promise<MetricsHourly[]> {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('autopilot_metrics_hourly')
        .select('*')
        .gte('hour_start', cutoff)
        .order('hour_start', { ascending: false });

      if (error) {
        console.error('Error fetching hourly metrics:', error);
        return [];
      }

      return (data || []) as unknown as MetricsHourly[];
    } catch (error) {
      console.error('Error in getHourlyMetrics:', error);
      return [];
    }
  }

  /**
   * Trigger metrics computation for current hour
   */
  static async computeMetrics(): Promise<{ success: boolean; id?: string }> {
    try {
      const { data, error } = await supabase.rpc('compute_autopilot_hourly_metrics');

      if (error) {
        console.error('Error computing metrics:', error);
        return { success: false };
      }

      return { success: true, id: data as string };
    } catch (error) {
      console.error('Error in computeMetrics:', error);
      return { success: false };
    }
  }

  /**
   * Compute gate snapshot for a specific gate
   */
  static async computeGateSnapshot(gateId: string): Promise<{ success: boolean; id?: string }> {
    try {
      const { data, error } = await supabase.rpc('compute_gate_snapshot', {
        p_gate_id: gateId,
      });

      if (error) {
        console.error('Error computing gate snapshot:', error);
        return { success: false };
      }

      return { success: true, id: data as string };
    } catch (error) {
      console.error('Error in computeGateSnapshot:', error);
      return { success: false };
    }
  }

  /**
   * Get decision breakdown for last 24 hours
   */
  static async getDecisionBreakdown(): Promise<{
    approve: number;
    reject: number;
    unknown: number;
    top_reject_reasons: Array<{ reason: string; count: number }>;
    canary_volume: number;
  }> {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Get decision counts - using production schema columns
      const { data: decisions, error: decisionsError } = await supabase
        .from('autopilot_decisions')
        .select('decision, decision_reason')
        .gte('created_at', cutoff);

      if (decisionsError || !decisions) {
        return {
          approve: 0,
          reject: 0,
          unknown: 0,
          top_reject_reasons: [],
          canary_volume: 0,
        };
      }

      const approve = decisions.filter(
        d => d.decision === 'ALLOW' || d.decision === 'allow'
      ).length;
      const reject = decisions.filter(
        d => d.decision === 'REJECT' || d.decision === 'reject' || d.decision === 'deny'
      ).length;
      const unknown = decisions.filter(
        d => d.decision === 'UNKNOWN' || d.decision === 'unknown'
      ).length;

      // Count reject reasons using production schema column
      const reasonCounts: Record<string, number> = {};
      decisions
        .filter(d => d.decision === 'REJECT' || d.decision === 'reject' || d.decision === 'deny')
        .forEach(d => {
          const key = d.decision_reason?.substring(0, 50) || 'unknown';
          reasonCounts[key] = (reasonCounts[key] || 0) + 1;
        });

      const top_reject_reasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Canary routing not in production schema - return 0
      const canaryCount = 0;

      return {
        approve,
        reject,
        unknown,
        top_reject_reasons,
        canary_volume: canaryCount || 0,
      };
    } catch (error) {
      console.error('Error in getDecisionBreakdown:', error);
      return {
        approve: 0,
        reject: 0,
        unknown: 0,
        top_reject_reasons: [],
        canary_volume: 0,
      };
    }
  }

  /**
   * Get audit log for mode changes
   */
  static async getModeChangeLog(limit: number = 20): Promise<
    Array<{
      actor: string;
      action: string;
      previous_state: Record<string, unknown>;
      new_state: Record<string, unknown>;
      created_at: string;
    }>
  > {
    try {
      // Production schema uses 'details' JSON field instead of separate state columns
      const { data, error } = await supabase
        .from('audit_log')
        .select('actor, action, details, created_at')
        .in('action', ['AUTOPILOT_MODE_CHANGE', 'AUTOPILOT_DEMOTION'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching mode change log:', error);
        return [];
      }

      // Transform to expected format - details may contain previous/new state info
      return (data || []).map(row => {
        const details = (row.details || {}) as Record<string, unknown>;
        return {
          actor: row.actor,
          action: row.action,
          previous_state: (details.previous_state as Record<string, unknown>) || {},
          new_state: (details.new_state as Record<string, unknown>) || details,
          created_at: row.created_at || new Date().toISOString(),
        };
      });
    } catch (error) {
      console.error('Error in getModeChangeLog:', error);
      return [];
    }
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

// Feature gate: Autopilot requires autopilot_* tables which are not in production schema.
// Return 503 when feature is not enabled.
// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function isAutopilotEnabled(): boolean {
  return process.env.ENABLE_AUTOPILOT === 'true';
}

function autopilotNotEnabledResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Autopilot feature not enabled',
      code: 'FEATURE_NOT_ENABLED',
      message:
        'The autopilot feature requires additional database tables that are not provisioned. Set ENABLE_AUTOPILOT=true when tables are available.',
    },
    { status: 503 }
  );
}

/**
 * GET /api/admin/autopilot
 * Get autopilot status, configuration, and dashboard data
 */
export async function GET(request: NextRequest) {
  if (!isAutopilotEnabled()) {
    return autopilotNotEnabledResponse();
  }

  const span = UnitTalkTracing.startAgentSpan('admin', 'get_autopilot_status');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';

    // Require view dashboard permission
    await RBACService.requirePermission(userId, Permission.VIEW_DASHBOARD);

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'dashboard';

    let response: Record<string, unknown> = {};

    switch (view) {
      case 'config':
        // Just return config
        response = {
          config: await AutopilotService.getConfig(),
        };
        break;

      case 'gates':
        // Return gate snapshots
        const gateId = searchParams.get('gate_id') || undefined;
        response = {
          gate1: await AutopilotService.getGateSnapshots('gate1', 5),
          gate2: await AutopilotService.getGateSnapshots('gate2', 5),
        };
        break;

      case 'metrics':
        // Return hourly metrics
        const hours = parseInt(searchParams.get('hours') || '24', 10);
        response = {
          metrics: await AutopilotService.getHourlyMetrics(hours),
        };
        break;

      case 'demotions':
        // Return demotion events
        response = {
          demotions: await AutopilotService.getDemotionEvents(),
        };
        break;

      case 'audit':
        // Return mode change audit log
        response = {
          audit: await AutopilotService.getModeChangeLog(),
        };
        break;

      case 'dashboard':
      default:
        // Return full dashboard data
        const [config, gate1, gate2, decisions, demotions, metrics, audit] = await Promise.all([
          AutopilotService.getConfig(),
          AutopilotService.getGateSnapshots('gate1', 1),
          AutopilotService.getGateSnapshots('gate2', 1),
          AutopilotService.getDecisionBreakdown(),
          AutopilotService.getDemotionEvents(5),
          AutopilotService.getHourlyMetrics(24),
          AutopilotService.getModeChangeLog(10),
        ]);

        response = {
          config,
          gates: {
            gate1: gate1[0] || null,
            gate2: gate2[0] || null,
          },
          decisions,
          demotions,
          metrics,
          audit,
        };
        break;
    }

    UnitTalkTracing.recordSuccess(span);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        code: 'AUTOPILOT_GET_ERROR',
      },
      { status: 500 }
    );
  } finally {
    span.end();
  }
}

/**
 * POST /api/admin/autopilot/mode
 * Set autopilot mode (with two-step confirm for PROD)
 */
export async function POST(request: NextRequest) {
  if (!isAutopilotEnabled()) {
    return autopilotNotEnabledResponse();
  }

  const span = UnitTalkTracing.startAgentSpan('admin', 'set_autopilot_mode');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';

    // Require admin permissions for mode changes
    await RBACService.requirePermission(userId, Permission.FREEZE_SYSTEM);

    const body = await request.json();
    const { mode, confirm, canary_percentage } = body;

    // Validate mode
    if (!['off', 'log_only', 'canary', 'prod'].includes(mode)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid mode. Must be: off, log_only, canary, or prod',
          code: 'INVALID_MODE',
        },
        { status: 400 }
      );
    }

    // Validate canary percentage
    if (canary_percentage !== undefined) {
      const pct = parseInt(canary_percentage, 10);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return NextResponse.json(
          {
            success: false,
            error: 'canary_percentage must be between 0 and 100',
            code: 'INVALID_CANARY_PERCENTAGE',
          },
          { status: 400 }
        );
      }
    }

    // Get current config for comparison
    const previousConfig = await AutopilotService.getConfig();

    // Set mode
    const result = await AutopilotService.setMode(
      mode as AutopilotMode,
      userId,
      confirm === true,
      canary_percentage
    );

    if (result.status === 'error') {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          code: 'MODE_CHANGE_ERROR',
        },
        { status: 400 }
      );
    }

    // Log audit event
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action:
        result.status === 'pending_confirmation'
          ? 'AUTOPILOT_MODE_CHANGE_REQUESTED'
          : 'AUTOPILOT_MODE_CHANGE',
      resource_type: 'autopilot',
      resource_id: 'mode_config',
      payload: {
        requested_mode: mode,
        confirm,
        canary_percentage,
        result: result.status,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
      previous_state: previousConfig,
      new_state: result,
      status: 'success',
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    UnitTalkTracing.recordSuccess(span, { itemsProcessed: 1 });

    return NextResponse.json({
      success: true,
      data: result,
      message:
        result.status === 'pending_confirmation'
          ? 'PROD mode requires confirmation. Call again with confirm=true within 5 minutes.'
          : `Mode changed to ${mode} successfully`,
    });
  } catch (error) {
    const errorMessage = (error as Error).message || 'Unknown error';

    UnitTalkTracing.recordError(span, error as Error);

    // Log failed attempt
    const userId = request.headers.get('x-user-id') || 'anonymous';
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: 'AUTOPILOT_MODE_CHANGE_FAILED',
      resource_type: 'autopilot',
      resource_id: 'mode_config',
      payload: { error: errorMessage },
      status: 'failure',
      error_message: errorMessage,
    });

    const statusCode = errorMessage.includes('Access denied') ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'AUTOPILOT_ERROR',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}

/**
 * PUT /api/admin/autopilot/config
 * Update autopilot thresholds (admin only)
 */
export async function PUT(request: NextRequest) {
  if (!isAutopilotEnabled()) {
    return autopilotNotEnabledResponse();
  }

  const span = UnitTalkTracing.startAgentSpan('admin', 'update_autopilot_config');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';

    // Require system config permission
    await RBACService.requirePermission(userId, Permission.SYSTEM_CONFIG);

    const body = await request.json();
    const { canary_percentage, gate1_thresholds, gate2_thresholds, demotion_thresholds } = body;

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };

    if (canary_percentage !== undefined) {
      const pct = parseInt(canary_percentage, 10);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return NextResponse.json(
          {
            success: false,
            error: 'canary_percentage must be between 0 and 100',
            code: 'INVALID_CANARY_PERCENTAGE',
          },
          { status: 400 }
        );
      }
      updates.canary_percentage = pct;
    }

    if (gate1_thresholds) {
      if (gate1_thresholds.accuracy !== undefined) {
        updates.gate1_accuracy_threshold = gate1_thresholds.accuracy;
      }
      if (gate1_thresholds.false_positive_max !== undefined) {
        updates.gate1_false_positive_threshold = gate1_thresholds.false_positive_max;
      }
      if (gate1_thresholds.min_picks !== undefined) {
        updates.gate1_min_picks = gate1_thresholds.min_picks;
      }
      if (gate1_thresholds.window_days !== undefined) {
        updates.gate1_window_days = gate1_thresholds.window_days;
      }
    }

    if (gate2_thresholds) {
      if (gate2_thresholds.accuracy !== undefined) {
        updates.gate2_accuracy_threshold = gate2_thresholds.accuracy;
      }
      if (gate2_thresholds.false_positive_max !== undefined) {
        updates.gate2_false_positive_threshold = gate2_thresholds.false_positive_max;
      }
      if (gate2_thresholds.min_picks !== undefined) {
        updates.gate2_min_picks = gate2_thresholds.min_picks;
      }
      if (gate2_thresholds.window_days !== undefined) {
        updates.gate2_window_days = gate2_thresholds.window_days;
      }
    }

    if (demotion_thresholds) {
      if (demotion_thresholds.error_spike !== undefined) {
        updates.demotion_error_spike_threshold = demotion_thresholds.error_spike;
      }
      if (demotion_thresholds.accuracy_min !== undefined) {
        updates.demotion_accuracy_threshold = demotion_thresholds.accuracy_min;
      }
      if (demotion_thresholds.window_hours !== undefined) {
        updates.demotion_window_hours = demotion_thresholds.window_hours;
      }
    }

    // Get current config
    const previousConfig = await AutopilotService.getConfig();

    // Update config
    const { error } = await supabase
      .from('autopilot_mode_config')
      .update(updates)
      .eq('id', 'a0000000-0000-0000-0000-000000000001');

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }

    // Get updated config
    const newConfig = await AutopilotService.getConfig();

    // Log audit event
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: 'AUTOPILOT_CONFIG_UPDATE',
      resource_type: 'autopilot',
      resource_id: 'mode_config',
      payload: updates,
      previous_state: previousConfig,
      new_state: newConfig,
      status: 'success',
    });

    UnitTalkTracing.recordSuccess(span);

    return NextResponse.json({
      success: true,
      data: newConfig,
      message: 'Autopilot configuration updated successfully',
    });
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        code: 'CONFIG_UPDATE_ERROR',
      },
      { status: 500 }
    );
  } finally {
    span.end();
  }
}
