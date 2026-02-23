/**
 * @fileoverview Phase 4 Autopilot Policy Control API
 *
 * Provides endpoints for:
 * - Viewing current policy configuration
 * - Setting autopilot mode (OFF/SHADOW/CANARY/AUTO)
 * - Managing freezes (global, per-agent, per-action)
 * - Viewing decision ledger
 *
 * All actions are RBAC-protected and audit-logged.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { RBACService, Permission } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { UnitTalkTracing } from '@/lib/telemetry';

// =============================================================================
// TYPES
// =============================================================================

type AutopilotMode = 'OFF' | 'SHADOW' | 'CANARY' | 'AUTO';

type AutopilotActionType =
  | 'PUBLISH_PICK'
  | 'PUBLISH_ALERT'
  | 'ADJUST_SIZING'
  | 'GENERATE_HEDGE_ALERT'
  | 'DEMOTE_CAPPER'
  | 'PAUSE_AGENT'
  | 'AUTO_PROMOTE'
  | 'SEND_NOTIFICATION'
  | 'APPLY_COOLDOWN'
  | 'UPDATE_TIER';

interface PolicyConfig {
  version: string;
  default_mode: AutopilotMode;
  canary_percentage: number;
  fail_closed: boolean;
  rules: PolicyRule[];
  operator_overrides: {
    global_freeze: boolean;
    agent_freezes: Record<string, boolean>;
    action_freezes: Record<string, boolean>;
  };
  updated_at: string;
  updated_by: string;
}

interface PolicyRule {
  id: string;
  action_type: AutopilotActionType;
  enabled: boolean;
  allowed_modes: AutopilotMode[];
  min_sample_size?: number;
  min_confidence_score?: number;
  min_confidence_tier?: string;
  min_clv_positive_rate?: number;
  max_exposure?: number;
  require_healthy_platform?: boolean;
  require_slo_compliance?: boolean;
  cooldown_seconds?: number;
  cooldown_scope?: string;
}

interface DecisionEntry {
  decision_id: string;
  trace_id: string;
  action_type: string;
  policy_version: string;
  mode: string;
  evaluation_result: string;
  reason_codes: string[];
  reason_message: string;
  executed: boolean;
  created_at: string;
  inputs?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}

// =============================================================================
// POLICY SERVICE
// =============================================================================

class PolicyService {
  /**
   * Get current policy configuration
   */
  static async getConfig(): Promise<PolicyConfig | null> {
    try {
      const { data, error } = await supabase
        .from('autopilot_policy_config')
        .select('*')
        .eq('id', 'default')
        .single();

      if (error || !data) {
        console.error('Error fetching policy config:', error);
        return null;
      }

      return {
        version: String(data.version),
        default_mode: data.default_mode as AutopilotMode,
        canary_percentage: data.canary_percentage,
        fail_closed: data.fail_closed,
        rules: (data.rules as unknown as PolicyRule[]) || [],
        operator_overrides: (data.operator_overrides as PolicyConfig['operator_overrides']) || {
          global_freeze: false,
          agent_freezes: {},
          action_freezes: {},
        },
        updated_at: data.updated_at,
        updated_by: data.updated_by,
      };
    } catch (error) {
      console.error('Error in getConfig:', error);
      return null;
    }
  }

  /**
   * Set autopilot mode
   */
  static async setMode(mode: AutopilotMode, operatorId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('autopilot_policy_config')
        .update({
          default_mode: mode,
          updated_at: new Date().toISOString(),
          updated_by: operatorId,
        })
        .eq('id', 'default');

      return !error;
    } catch (error) {
      console.error('Error setting mode:', error);
      return false;
    }
  }

  /**
   * Set global freeze
   */
  static async setGlobalFreeze(freeze: boolean, operatorId: string): Promise<boolean> {
    try {
      const config = await this.getConfig();
      if (!config) return false;

      const newOverrides = {
        ...config.operator_overrides,
        global_freeze: freeze,
      };

      const { error } = await supabase
        .from('autopilot_policy_config')
        .update({
          operator_overrides: newOverrides,
          updated_at: new Date().toISOString(),
          updated_by: operatorId,
        })
        .eq('id', 'default');

      return !error;
    } catch (error) {
      console.error('Error setting global freeze:', error);
      return false;
    }
  }

  /**
   * Set agent freeze
   */
  static async setAgentFreeze(
    agentId: string,
    freeze: boolean,
    operatorId: string
  ): Promise<boolean> {
    try {
      const config = await this.getConfig();
      if (!config) return false;

      const newOverrides = {
        ...config.operator_overrides,
        agent_freezes: {
          ...config.operator_overrides.agent_freezes,
          [agentId]: freeze,
        },
      };

      const { error } = await supabase
        .from('autopilot_policy_config')
        .update({
          operator_overrides: newOverrides,
          updated_at: new Date().toISOString(),
          updated_by: operatorId,
        })
        .eq('id', 'default');

      return !error;
    } catch (error) {
      console.error('Error setting agent freeze:', error);
      return false;
    }
  }

  /**
   * Set action freeze
   */
  static async setActionFreeze(
    actionType: AutopilotActionType,
    freeze: boolean,
    operatorId: string
  ): Promise<boolean> {
    try {
      const config = await this.getConfig();
      if (!config) return false;

      const newOverrides = {
        ...config.operator_overrides,
        action_freezes: {
          ...config.operator_overrides.action_freezes,
          [actionType]: freeze,
        },
      };

      const { error } = await supabase
        .from('autopilot_policy_config')
        .update({
          operator_overrides: newOverrides,
          updated_at: new Date().toISOString(),
          updated_by: operatorId,
        })
        .eq('id', 'default');

      return !error;
    } catch (error) {
      console.error('Error setting action freeze:', error);
      return false;
    }
  }

  /**
   * Get decision ledger entries
   */
  static async getDecisions(
    limit: number = 50,
    filters?: {
      action_type?: string;
      evaluation_result?: string;
      trace_id?: string;
    }
  ): Promise<DecisionEntry[]> {
    try {
      // Build query with explicit filtering via chained calls
      // Note: Using decision/evaluation_run_id columns from production schema
      const baseQuery = supabase
        .from('autopilot_decisions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Apply filters using production schema columns
      const { data, error } = await (async () => {
        // Filters map to production schema columns where available
        // action_type -> not in schema (skip)
        // evaluation_result -> decision
        // trace_id -> evaluation_run_id
        if (filters?.evaluation_result) {
          return baseQuery.eq('decision', filters.evaluation_result);
        }
        if (filters?.trace_id) {
          return baseQuery.eq('evaluation_run_id', filters.trace_id);
        }
        return baseQuery;
      })();

      if (error) {
        console.error('Error fetching decisions:', error);
        return [];
      }

      // Transform production schema to expected interface
      return (data || []).map(row => ({
        decision_id: row.id,
        trace_id: row.evaluation_run_id,
        action_type: 'unknown', // Not in production schema
        policy_version: '1', // Not in production schema
        mode: row.mode,
        evaluation_result: row.decision,
        reason_codes: [],
        reason_message: row.decision_reason,
        executed: row.would_publish,
        created_at: row.created_at || new Date().toISOString(),
        inputs: row.pick_data as Record<string, unknown>,
        evidence: row.metadata as Record<string, unknown>,
      }));
    } catch (error) {
      console.error('Error in getDecisions:', error);
      return [];
    }
  }

  /**
   * Get decision statistics
   */
  static async getDecisionStats(hours: number = 24): Promise<{
    total: number;
    allow: number;
    deny: number;
    shadow: number;
    executed: number;
    allow_rate: number;
    execution_rate: number;
    by_action: Record<string, { allow: number; deny: number }>;
    by_mode: Record<string, number>;
  }> {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      // Use production schema columns: decision, mode, would_publish
      const { data, error } = await supabase
        .from('autopilot_decisions')
        .select('decision, mode, would_publish')
        .gte('created_at', cutoff);

      if (error || !data) {
        return {
          total: 0,
          allow: 0,
          deny: 0,
          shadow: 0,
          executed: 0,
          allow_rate: 0,
          execution_rate: 0,
          by_action: {},
          by_mode: {},
        };
      }

      // Map production schema to expected types
      const total = data.length;
      const allow = data.filter(d => d.decision === 'ALLOW' || d.decision === 'allow').length;
      const deny = data.filter(d => d.decision === 'DENY' || d.decision === 'deny').length;
      const shadow = data.filter(
        d => d.decision === 'SHADOW_ONLY' || d.decision === 'shadow'
      ).length;
      const executed = data.filter(d => d.would_publish === true).length;

      // No action_type in production schema - return empty
      const byAction: Record<string, { allow: number; deny: number }> = {};

      // Group by mode
      const byMode: Record<string, number> = {};
      data.forEach(d => {
        byMode[d.mode] = (byMode[d.mode] || 0) + 1;
      });

      return {
        total,
        allow,
        deny,
        shadow,
        executed,
        allow_rate: total > 0 ? Math.round((allow / total) * 100) : 0,
        execution_rate: allow > 0 ? Math.round((executed / allow) * 100) : 0,
        by_action: byAction,
        by_mode: byMode,
      };
    } catch (error) {
      console.error('Error in getDecisionStats:', error);
      return {
        total: 0,
        allow: 0,
        deny: 0,
        shadow: 0,
        executed: 0,
        allow_rate: 0,
        execution_rate: 0,
        by_action: {},
        by_mode: {},
      };
    }
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

// Feature gate: Autopilot requires autopilot_* tables which are not in production schema.
// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function isAutopilotEnabled(): boolean {
  return process.env.ENABLE_AUTOPILOT === 'true';
}

function autopilotNotEnabledResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Autopilot policy feature not enabled',
      code: 'FEATURE_NOT_ENABLED',
    },
    { status: 503 }
  );
}

/**
 * GET /api/admin/autopilot/policy
 * Get policy configuration, decisions, and statistics
 */
export async function GET(request: NextRequest) {
  if (!isAutopilotEnabled()) {
    return autopilotNotEnabledResponse();
  }

  const correlationId = uuidv4();
  const span = UnitTalkTracing.startAgentSpan('admin', 'get_autopilot_policy');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';
    await RBACService.requirePermission(userId, Permission.VIEW_DASHBOARD);

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'dashboard';

    let response: Record<string, unknown> = {};

    switch (view) {
      case 'config':
        response = {
          config: await PolicyService.getConfig(),
        };
        break;

      case 'decisions':
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const actionType = searchParams.get('action_type') || undefined;
        const result = searchParams.get('result') || undefined;
        const traceId = searchParams.get('trace_id') || undefined;

        response = {
          decisions: await PolicyService.getDecisions(limit, {
            action_type: actionType,
            evaluation_result: result,
            trace_id: traceId,
          }),
        };
        break;

      case 'stats':
        const hours = parseInt(searchParams.get('hours') || '24', 10);
        response = {
          stats: await PolicyService.getDecisionStats(hours),
        };
        break;

      case 'dashboard':
      default:
        const [config, decisions, stats] = await Promise.all([
          PolicyService.getConfig(),
          PolicyService.getDecisions(20),
          PolicyService.getDecisionStats(24),
        ]);

        response = {
          config,
          decisions,
          stats,
          deep_links: {
            all_decisions: '/dashboard/autopilot?tab=decisions',
            policy_rules: '/dashboard/autopilot?tab=rules',
            freeze_controls: '/dashboard/autopilot?tab=freeze',
          },
        };
        break;
    }

    UnitTalkTracing.recordSuccess(span);

    return NextResponse.json(
      {
        success: true,
        data: response,
        correlation_id: correlationId,
      },
      {
        headers: {
          'X-Response-Time': `${Date.now()}`,
          'X-Correlation-ID': correlationId,
        },
      }
    );
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        code: 'POLICY_GET_ERROR',
        correlation_id: correlationId,
      },
      { status: 500 }
    );
  } finally {
    span.end();
  }
}

/**
 * POST /api/admin/autopilot/policy
 * Update policy settings (mode, freezes)
 */
export async function POST(request: NextRequest) {
  if (!isAutopilotEnabled()) {
    return autopilotNotEnabledResponse();
  }

  const correlationId = uuidv4();
  const span = UnitTalkTracing.startAgentSpan('admin', 'update_autopilot_policy');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await RBACService.requirePermission(userId, Permission.FREEZE_SYSTEM);

    const body = await request.json();
    const { action, ...params } = body;

    // Get previous config for audit
    const previousConfig = await PolicyService.getConfig();

    let success = false;
    let message = '';

    switch (action) {
      case 'set_mode':
        const mode = params.mode as AutopilotMode;
        if (!['OFF', 'SHADOW', 'CANARY', 'AUTO'].includes(mode)) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid mode. Must be: OFF, SHADOW, CANARY, or AUTO',
              code: 'INVALID_MODE',
              correlation_id: correlationId,
            },
            { status: 400 }
          );
        }
        success = await PolicyService.setMode(mode, userId);
        message = success ? `Mode set to ${mode}` : 'Failed to set mode';
        break;

      case 'set_global_freeze':
        success = await PolicyService.setGlobalFreeze(params.freeze === true, userId);
        message = success
          ? `Global freeze ${params.freeze ? 'enabled' : 'disabled'}`
          : 'Failed to set global freeze';
        break;

      case 'set_agent_freeze':
        if (!params.agent_id) {
          return NextResponse.json(
            {
              success: false,
              error: 'agent_id is required',
              code: 'MISSING_AGENT_ID',
              correlation_id: correlationId,
            },
            { status: 400 }
          );
        }
        success = await PolicyService.setAgentFreeze(
          params.agent_id,
          params.freeze === true,
          userId
        );
        message = success
          ? `Agent ${params.agent_id} freeze ${params.freeze ? 'enabled' : 'disabled'}`
          : 'Failed to set agent freeze';
        break;

      case 'set_action_freeze':
        if (!params.action_type) {
          return NextResponse.json(
            {
              success: false,
              error: 'action_type is required',
              code: 'MISSING_ACTION_TYPE',
              correlation_id: correlationId,
            },
            { status: 400 }
          );
        }
        success = await PolicyService.setActionFreeze(
          params.action_type as AutopilotActionType,
          params.freeze === true,
          userId
        );
        message = success
          ? `Action ${params.action_type} freeze ${params.freeze ? 'enabled' : 'disabled'}`
          : 'Failed to set action freeze';
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error:
              'Invalid action. Must be: set_mode, set_global_freeze, set_agent_freeze, or set_action_freeze',
            code: 'INVALID_ACTION',
            correlation_id: correlationId,
          },
          { status: 400 }
        );
    }

    // Get new config for audit
    const newConfig = await PolicyService.getConfig();

    // Log audit event
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: `AUTOPILOT_POLICY_${action.toUpperCase()}`,
      resource_type: 'autopilot_policy',
      resource_id: 'default',
      payload: { action, ...params, success },
      previous_state: previousConfig,
      new_state: newConfig,
      status: success ? 'success' : 'failure',
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    UnitTalkTracing.recordSuccess(span);

    return NextResponse.json(
      {
        success,
        message,
        data: newConfig,
        correlation_id: correlationId,
      },
      {
        headers: {
          'X-Response-Time': `${Date.now()}`,
          'X-Correlation-ID': correlationId,
        },
      }
    );
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    const statusCode = (error as Error).message.includes('Access denied') ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'POLICY_UPDATE_ERROR',
        correlation_id: correlationId,
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}
