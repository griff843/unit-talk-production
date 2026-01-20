/**
 * @fileoverview Autopilot Actions API endpoint
 * Phase 7: Trigger metrics computation, gate evaluation, emergency stop
 */

import { NextRequest, NextResponse } from 'next/server';
import { RBACService, Permission } from '@/lib/rbac';
import { UnitTalkTracing } from '@/lib/telemetry';
import { supabase } from '@/lib/supabase';

// =============================================================================
// ACTION HANDLERS
// =============================================================================

/**
 * POST /api/admin/autopilot/actions
 * Execute autopilot actions
 */
export async function POST(request: NextRequest) {
  const span = UnitTalkTracing.startAgentSpan('admin', 'autopilot_action');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';

    const body = await request.json();
    const { action, params } = body;

    let result: Record<string, unknown> = {};

    switch (action) {
      case 'compute_metrics': {
        // Trigger hourly metrics computation
        await RBACService.requirePermission(userId, Permission.VIEW_DASHBOARD);

        const hourStart = params?.hour_start || undefined;
        const { data, error } = await supabase.rpc('compute_autopilot_hourly_metrics', {
          p_hour_start: hourStart,
        });

        if (error) {
          throw new Error(`Failed to compute metrics: ${error.message}`);
        }

        result = {
          action: 'compute_metrics',
          success: true,
          metrics_id: data,
        };
        break;
      }

      case 'compute_gate': {
        // Compute gate snapshot
        await RBACService.requirePermission(userId, Permission.VIEW_DASHBOARD);

        const gateId = params?.gate_id;
        if (!gateId || !['gate1', 'gate2'].includes(gateId)) {
          throw new Error('gate_id must be "gate1" or "gate2"');
        }

        const { data, error } = await supabase.rpc('compute_gate_snapshot', {
          p_gate_id: gateId,
        });

        if (error) {
          throw new Error(`Failed to compute gate snapshot: ${error.message}`);
        }

        // Fetch the computed snapshot
        const { data: snapshot } = await supabase
          .from('autopilot_gate_snapshots')
          .select('*')
          .eq('id', data)
          .single();

        result = {
          action: 'compute_gate',
          success: true,
          snapshot_id: data,
          snapshot,
        };
        break;
      }

      case 'emergency_stop': {
        // Emergency demotion to LOG_ONLY
        await RBACService.requirePermission(userId, Permission.EMERGENCY_CONTROLS);

        // Get current mode
        const { data: configData } = await supabase.rpc('get_autopilot_mode');
        const currentMode = (configData as { mode: string })?.mode;

        if (currentMode === 'off' || currentMode === 'log_only') {
          result = {
            action: 'emergency_stop',
            success: true,
            message: 'Already in safe mode',
            current_mode: currentMode,
          };
          break;
        }

        // Trigger emergency demotion
        const { data: demotionId, error } = await supabase.rpc('record_autopilot_demotion', {
          p_from_mode: currentMode,
          p_to_mode: 'log_only',
          p_trigger_type: 'manual_emergency',
          p_trigger_details: {
            triggered_by: userId,
            reason: params?.reason || 'Emergency stop triggered via Command Center',
          },
          p_triggered_by: userId,
        });

        if (error) {
          throw new Error(`Failed to execute emergency stop: ${error.message}`);
        }

        // Log audit
        await RBACService.logAudit({
          actor: userId,
          actor_type: 'user',
          action: 'AUTOPILOT_EMERGENCY_STOP',
          resource_type: 'autopilot',
          resource_id: 'mode_config',
          payload: {
            from_mode: currentMode,
            to_mode: 'log_only',
            reason: params?.reason,
            demotion_id: demotionId,
          },
          status: 'success',
        });

        result = {
          action: 'emergency_stop',
          success: true,
          from_mode: currentMode,
          to_mode: 'log_only',
          demotion_id: demotionId,
          message: 'Emergency stop executed. Autopilot demoted to LOG_ONLY mode.',
        };
        break;
      }

      case 'backfill_metrics': {
        // Backfill metrics for a time range
        await RBACService.requirePermission(userId, Permission.RUN_BACKFILL);

        const hoursBack = params?.hours_back || 24;
        const results: string[] = [];

        for (let i = hoursBack; i > 0; i--) {
          const hourStart = new Date(Date.now() - i * 60 * 60 * 1000);
          hourStart.setMinutes(0, 0, 0);

          const { data, error } = await supabase.rpc('compute_autopilot_hourly_metrics', {
            p_hour_start: hourStart.toISOString(),
          });

          if (!error && data) {
            results.push(data as string);
          }
        }

        result = {
          action: 'backfill_metrics',
          success: true,
          hours_processed: results.length,
          metrics_ids: results,
        };
        break;
      }

      case 'clear_pending': {
        // Clear pending PROD confirmation
        await RBACService.requirePermission(userId, Permission.FREEZE_SYSTEM);

        const { error } = await supabase
          .from('autopilot_mode_config')
          .update({
            pending_mode: null,
            pending_mode_requested_at: null,
            pending_mode_requested_by: null,
            pending_mode_expires_at: null,
            updated_at: new Date().toISOString(),
            updated_by: userId,
          })
          .eq('id', 'a0000000-0000-0000-0000-000000000001');

        if (error) {
          throw new Error(`Failed to clear pending mode: ${error.message}`);
        }

        await RBACService.logAudit({
          actor: userId,
          actor_type: 'user',
          action: 'AUTOPILOT_CLEAR_PENDING',
          resource_type: 'autopilot',
          resource_id: 'mode_config',
          payload: {},
          status: 'success',
        });

        result = {
          action: 'clear_pending',
          success: true,
          message: 'Pending PROD confirmation cleared',
        };
        break;
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            code: 'UNKNOWN_ACTION',
            available_actions: [
              'compute_metrics',
              'compute_gate',
              'emergency_stop',
              'backfill_metrics',
              'clear_pending',
            ],
          },
          { status: 400 }
        );
    }

    UnitTalkTracing.recordSuccess(span);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    const userId = request.headers.get('x-user-id') || 'anonymous';
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: 'AUTOPILOT_ACTION_FAILED',
      resource_type: 'autopilot',
      resource_id: 'actions',
      payload: { error: (error as Error).message },
      status: 'failure',
      error_message: (error as Error).message,
    });

    const errorMessage = (error as Error).message;
    const statusCode = errorMessage.includes('Access denied') ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'ACTION_ERROR',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}
