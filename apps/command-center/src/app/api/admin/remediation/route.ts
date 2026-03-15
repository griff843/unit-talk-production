/* eslint-disable max-lines-per-function, complexity, no-console */
/**
 * @fileoverview Remediation Control API endpoint
 * PR8: Auto-Remediation Playbooks
 *
 * RBAC-protected endpoint for managing auto-remediation playbooks
 * All executions are DRY RUN by default unless explicitly approved
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { getOperatorIdentity } from '@/lib/auth';
import { RBACService, Permission } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { UnitTalkTracing } from '@/lib/telemetry';

// =============================================================================
// TYPES
// =============================================================================

type PlaybookId =
  | 'MV_REFRESH_LAG'
  | 'PIPELINE_LAG_THROTTLE'
  | 'CREDIT_BURN_THROTTLE'
  | 'DISCORD_BACKLOG_NUDGE'
  | 'SLO_EVALUATOR_STUCK';

type ExecutionType = 'EXECUTABLE' | 'RECOMMENDATION_ONLY';
type ExecutionStatus = 'pending' | 'approved' | 'executed' | 'failed' | 'skipped' | 'rollback';

interface PlaybookDefinition {
  playbook_id: PlaybookId;
  name: string;
  description: string;
  execution_type: ExecutionType;
  required_knobs: string[];
  default_action: Record<string, unknown>;
  cooldown_seconds: number;
  max_per_hour: number;
  status: 'active' | 'disabled' | 'deprecated';
  version: number;
  created_at?: string;
  updated_at?: string;
}

interface ExecutionRecord {
  execution_id: string;
  playbook_id: PlaybookId;
  incident_id: string;
  correlation_id: string;
  execution_key: string;
  status: ExecutionStatus;
  execution_type: ExecutionType;
  triggered_by: string;
  trigger_value?: number;
  trigger_threshold?: number;
  dry_run: boolean;
  actions_taken: unknown[];
  recommendations?: string[];
  rollback_steps?: string[];
  error_message?: string;
  approved_by?: string;
  approved_at?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
  updated_at: string;
}

interface RemediationStats {
  total_executions: number;
  successful: number;
  failed: number;
  pending_approval: number;
  recommendations_given: number;
  by_playbook: Record<
    string,
    {
      total: number;
      successful: number;
      failed: number;
      avg_duration_ms: number;
    }
  >;
}

// =============================================================================
// REMEDIATION SERVICE
// =============================================================================

class RemediationService {
  /**
   * Get all playbook definitions
   */
  static async getPlaybooks(): Promise<PlaybookDefinition[]> {
    try {
      // Try ops schema first
      const { data, error } = await supabase
        .from('ops.remediation_playbooks')
        .select('*')
        .order('playbook_id');

      if (error) {
        // Fallback to public schema
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('remediation_playbooks')
          .select('*')
          .order('playbook_id');

        if (fallbackError) {
          console.error('Error fetching playbooks:', fallbackError);
          return [];
        }

        return (fallbackData || []) as unknown as PlaybookDefinition[];
      }

      return (data || []) as unknown as PlaybookDefinition[];
    } catch (error) {
      console.error('Error in getPlaybooks:', error);
      return [];
    }
  }

  /**
   * Get playbook by ID
   */
  static async getPlaybook(playbookId: PlaybookId): Promise<PlaybookDefinition | null> {
    try {
      const { data, error } = await supabase
        .from('remediation_playbooks')
        .select('*')
        .eq('playbook_id', playbookId)
        .single();

      if (error) {
        console.error('Error fetching playbook:', error);
        return null;
      }

      return data as unknown as PlaybookDefinition;
    } catch (error) {
      console.error('Error in getPlaybook:', error);
      return null;
    }
  }

  /**
   * Get execution history
   */
  static async getExecutions(
    options: {
      playbookId?: PlaybookId;
      status?: ExecutionStatus;
      limit?: number;
    } = {}
  ): Promise<ExecutionRecord[]> {
    try {
      let query = supabase
        .from('remediation_executions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(options.limit || 50);

      if (options.playbookId) {
        query = query.eq('playbook_id', options.playbookId);
      }

      if (options.status) {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching executions:', error);
        return [];
      }

      return (data || []) as unknown as ExecutionRecord[];
    } catch (error) {
      console.error('Error in getExecutions:', error);
      return [];
    }
  }

  /**
   * Get pending remediations
   */
  static async getPending(): Promise<ExecutionRecord[]> {
    try {
      const { data, error } = await supabase.rpc('get_pending_remediations');

      if (error) {
        console.error('Error fetching pending remediations:', error);
        return [];
      }

      return (data || []) as unknown as ExecutionRecord[];
    } catch (error) {
      console.error('Error in getPending:', error);
      return [];
    }
  }

  /**
   * Get remediation statistics
   */
  static async getStats(hoursBack: number = 24): Promise<RemediationStats> {
    try {
      const { data, error } = await supabase.rpc('get_remediation_stats', {
        p_hours_back: hoursBack,
      });

      if (error) {
        console.error('Error fetching stats:', error);
        return this.getEmptyStats();
      }

      const stats = data?.[0];
      return stats || this.getEmptyStats();
    } catch (error) {
      console.error('Error in getStats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Get configuration
   */
  static async getConfig(): Promise<Record<string, unknown> | null> {
    try {
      const { data, error } = await supabase
        .from('remediation_config')
        .select('*')
        .eq('config_key', 'global')
        .single();

      if (error || !data) {
        return {
          enabled: false,
          dry_run_only: true,
          require_approval: true,
          global_max_per_hour: 10,
        };
      }

      return ((data as { config_value?: unknown }).config_value as Record<string, unknown>) || null;
    } catch (error) {
      console.error('Error in getConfig:', error);
      return null;
    }
  }

  /**
   * Trigger a playbook execution (DRY RUN by default)
   */
  static async triggerPlaybook(
    playbookId: PlaybookId,
    incidentId: string,
    triggeredBy: string,
    dryRun: boolean = true
  ): Promise<{
    success: boolean;
    execution_id?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const executionId = uuidv4();
      const correlationId = uuidv4();
      const executionKey = `${playbookId}:${incidentId}:${correlationId}`.substring(0, 32);

      const { error } = await supabase.rpc('create_remediation_execution', {
        p_execution_id: executionId,
        p_playbook_id: playbookId,
        p_incident_id: incidentId,
        p_correlation_id: correlationId,
        p_execution_key: executionKey,
        p_execution_type: 'EXECUTABLE', // Will be determined by engine
        p_triggered_by: triggeredBy,
        p_trigger_value: null,
        p_trigger_threshold: null,
        p_dry_run: dryRun,
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        execution_id: executionId,
        message: dryRun
          ? 'Playbook triggered in DRY RUN mode. No changes will be made.'
          : 'Playbook execution created and pending approval.',
      };
    } catch (error) {
      console.error('Error triggering playbook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Approve a pending remediation
   */
  static async approve(
    executionId: string,
    approvedBy: string
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('approve_remediation', {
        p_execution_id: executionId,
        p_approved_by: approvedBy,
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        message: 'Remediation approved and ready for execution.',
      };
    } catch (error) {
      console.error('Error approving remediation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update playbook status
   */
  static async updatePlaybookStatus(
    playbookId: PlaybookId,
    status: 'active' | 'disabled'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('remediation_playbooks')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('playbook_id', playbookId);

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating playbook status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private static getEmptyStats(): RemediationStats {
    return {
      total_executions: 0,
      successful: 0,
      failed: 0,
      pending_approval: 0,
      recommendations_given: 0,
      by_playbook: {},
    };
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

// Feature gate: Remediation requires remediation_* tables which are not in production schema.
// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function isRemediationEnabled(): boolean {
  return process.env.ENABLE_REMEDIATION === 'true';
}

function remediationNotEnabledResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Remediation feature not enabled',
      code: 'FEATURE_NOT_ENABLED',
    },
    { status: 503 }
  );
}

/**
 * GET /api/admin/remediation
 * Get remediation dashboard data: playbooks, executions, stats
 */
export async function GET(request: NextRequest) {
  if (!isRemediationEnabled()) {
    return remediationNotEnabledResponse();
  }

  const span = UnitTalkTracing.startAgentSpan('admin', 'get_remediation_dashboard');

  try {
    const { userId } = getOperatorIdentity(request);

    // Require view dashboard permission
    await RBACService.requirePermission(userId, Permission.VIEW_DASHBOARD);

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'dashboard';

    let response: Record<string, unknown> = {};

    switch (view) {
      case 'playbooks':
        response = {
          playbooks: await RemediationService.getPlaybooks(),
        };
        break;

      case 'executions':
        const playbookId = searchParams.get('playbook_id') as PlaybookId | null;
        const status = searchParams.get('status') as ExecutionStatus | null;
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        response = {
          executions: await RemediationService.getExecutions({
            playbookId: playbookId || undefined,
            status: status || undefined,
            limit,
          }),
        };
        break;

      case 'pending':
        response = {
          pending: await RemediationService.getPending(),
        };
        break;

      case 'stats':
        const hoursBack = parseInt(searchParams.get('hours') || '24', 10);
        response = {
          stats: await RemediationService.getStats(hoursBack),
        };
        break;

      case 'config':
        response = {
          config: await RemediationService.getConfig(),
        };
        break;

      case 'dashboard':
      default:
        const [playbooks, executions, pending, stats, config] = await Promise.all([
          RemediationService.getPlaybooks(),
          RemediationService.getExecutions({ limit: 10 }),
          RemediationService.getPending(),
          RemediationService.getStats(24),
          RemediationService.getConfig(),
        ]);

        response = {
          playbooks,
          executions,
          pending,
          stats,
          config,
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
        code: 'REMEDIATION_GET_ERROR',
      },
      { status: 500 }
    );
  } finally {
    span.end();
  }
}

/**
 * POST /api/admin/remediation
 * Trigger a playbook execution or approve a pending remediation
 */
export async function POST(request: NextRequest) {
  if (!isRemediationEnabled()) {
    return remediationNotEnabledResponse();
  }

  const span = UnitTalkTracing.startAgentSpan('admin', 'remediation_action');

  try {
    const { userId } = getOperatorIdentity(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';

    // Require freeze system permission for remediation actions
    await RBACService.requirePermission(userId, Permission.FREEZE_SYSTEM);

    const body = await request.json();
    const { action, playbook_id, incident_id, execution_id, dry_run = true } = body;

    let result: {
      success: boolean;
      message?: string;
      execution_id?: string;
      error?: string;
    };

    switch (action) {
      case 'trigger':
        if (!playbook_id || !incident_id) {
          return NextResponse.json(
            {
              success: false,
              error: 'playbook_id and incident_id are required for trigger action',
              code: 'INVALID_REQUEST',
            },
            { status: 400 }
          );
        }

        result = await RemediationService.triggerPlaybook(
          playbook_id as PlaybookId,
          incident_id,
          userId,
          dry_run !== false // Default to dry run
        );
        break;

      case 'approve':
        if (!execution_id) {
          return NextResponse.json(
            {
              success: false,
              error: 'execution_id is required for approve action',
              code: 'INVALID_REQUEST',
            },
            { status: 400 }
          );
        }

        result = await RemediationService.approve(execution_id, userId);
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action. Must be: trigger or approve',
            code: 'INVALID_ACTION',
          },
          { status: 400 }
        );
    }

    // Log audit event
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: `REMEDIATION_${action.toUpperCase()}`,
      resource_type: 'remediation',
      resource_id: execution_id || playbook_id || 'unknown',
      payload: {
        action,
        playbook_id,
        incident_id,
        execution_id,
        dry_run,
        result: result.success ? 'success' : 'failure',
        ip_address: ipAddress,
        user_agent: userAgent,
      },
      status: result.success ? 'success' : 'failure',
      error_message: result.error,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    UnitTalkTracing.recordSuccess(span, { itemsProcessed: 1 });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: 'REMEDIATION_ACTION_FAILED',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    const errorMessage = (error as Error).message || 'Unknown error';

    UnitTalkTracing.recordError(span, error as Error);

    const statusCode = errorMessage.includes('Access denied') ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'REMEDIATION_ERROR',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}

/**
 * PUT /api/admin/remediation
 * Update playbook configuration
 */
export async function PUT(request: NextRequest) {
  if (!isRemediationEnabled()) {
    return remediationNotEnabledResponse();
  }

  const span = UnitTalkTracing.startAgentSpan('admin', 'update_playbook');

  try {
    const { userId } = getOperatorIdentity(request);

    // Require system config permission
    await RBACService.requirePermission(userId, Permission.SYSTEM_CONFIG);

    const body = await request.json();
    const { playbook_id, status } = body;

    if (!playbook_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'playbook_id is required',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    if (status && !['active', 'disabled'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid status. Must be: active or disabled',
          code: 'INVALID_STATUS',
        },
        { status: 400 }
      );
    }

    const result = await RemediationService.updatePlaybookStatus(playbook_id as PlaybookId, status);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: 'UPDATE_FAILED',
        },
        { status: 400 }
      );
    }

    // Log audit event
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: 'PLAYBOOK_STATUS_UPDATE',
      resource_type: 'remediation_playbook',
      resource_id: playbook_id,
      payload: { status },
      status: 'success',
    });

    UnitTalkTracing.recordSuccess(span);

    return NextResponse.json({
      success: true,
      message: `Playbook ${playbook_id} status updated to ${status}`,
    });
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        code: 'UPDATE_ERROR',
      },
      { status: 500 }
    );
  } finally {
    span.end();
  }
}
