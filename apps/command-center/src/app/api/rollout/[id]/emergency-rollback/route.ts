/**
 * Emergency Rollback API - Command Center Integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * POST /api/rollout/[id]/emergency-rollback - Trigger emergency rollback
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: rolloutId } = params;
    const body = await request.json();
    const reason = body.reason || 'Emergency rollback from Command Center';

    console.error('EMERGENCY ROLLBACK TRIGGERED', { rolloutId, reason });

    // Create emergency rollback record
    const rollbackId = `emergency-rollback-${rolloutId}-${Date.now()}`;

    const supabase = getSupabaseClient();
    if (supabase) {
      const { error: rollbackError } = await supabase
        .from('rollback_executions')
        .insert({
          id: rollbackId,
          rollout_id: rolloutId,
          trigger_reason: reason,
          rollback_type: 'emergency',
          severity: 'emergency',
          initiated_by: 'command_center_user',
          initiated_at: new Date().toISOString(),
          status: 'initiated'
        });

      if (rollbackError) {
        throw rollbackError;
      }

      // Update original rollout status
      const { error: updateError } = await supabase
        .from('rollout_deployments')
        .update({
          status: 'rolled_back',
          updated_at: new Date().toISOString(),
          metadata: {
            rollbackId,
            rollbackReason: reason,
            rolledBackAt: new Date().toISOString(),
            rolledBackBy: 'command_center_user'
          }
        })
        .eq('id', rolloutId);

      if (updateError) {
        throw updateError;
      }

      // Log critical audit event
      await supabase
        .from('events')
        .insert({
          event_type: 'rollout.emergency_rollback',
          aggregate_id: rolloutId,
          aggregate_type: 'rollout_deployment',
          event_data: {
            rolloutId,
            rollbackId,
            reason,
            severity: 'emergency',
            timestamp: new Date().toISOString()
          },
          idempotency_key: `emergency-rollback-${rolloutId}-${Date.now()}`,
          metadata: {
            source: 'command_center',
            component: 'emergency_rollback',
            priority: 'critical'
          }
        });
    }

    console.log('Emergency rollback initiated', { rolloutId, rollbackId });

    return NextResponse.json({
      success: true,
      message: 'Emergency rollback initiated',
      rolloutId,
      rollbackId,
      status: 'rolled_back'
    });

  } catch (error) {
    console.error('Failed to initiate emergency rollback', {
      rolloutId: params.id,
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      { error: 'Failed to initiate emergency rollback' },
      { status: 500 }
    );
  }
}