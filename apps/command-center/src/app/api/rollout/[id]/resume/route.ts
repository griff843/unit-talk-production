/**
 * Rollout Resume API - Command Center Integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * POST /api/rollout/[id]/resume - Resume a paused rollout
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: rolloutId } = params;

    console.log('Resuming rollout', { rolloutId });

    // Update rollout status in database
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase
        .from('rollout_deployments')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
          metadata: {
            resumedAt: new Date().toISOString(),
            resumedBy: 'command_center_user'
          }
        })
        .eq('id', rolloutId)
        .eq('status', 'paused'); // Only allow resuming paused rollouts

      if (error) {
        throw error;
      }

      // Log audit event
      await supabase
        .from('events')
        .insert({
          event_type: 'rollout.resumed',
          aggregate_id: rolloutId,
          aggregate_type: 'rollout_deployment',
          event_data: {
            rolloutId,
            timestamp: new Date().toISOString()
          },
          idempotency_key: `rollout-resume-${rolloutId}-${Date.now()}`,
          metadata: {
            source: 'command_center',
            component: 'rollout_management'
          }
        });
    }

    console.log('Rollout resumed successfully', { rolloutId });

    return NextResponse.json({
      success: true,
      message: 'Rollout resumed successfully',
      rolloutId,
      status: 'in_progress'
    });

  } catch (error) {
    console.error('Failed to resume rollout', {
      rolloutId: params.id,
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      { error: 'Failed to resume rollout' },
      { status: 500 }
    );
  }
}