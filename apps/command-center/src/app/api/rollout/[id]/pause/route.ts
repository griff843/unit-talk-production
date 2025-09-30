/**
 * Rollout Pause API - Command Center Integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * POST /api/rollout/[id]/pause - Pause an active rollout
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: rolloutId } = params;
    const body = await request.json();
    const reason = body.reason || 'Manual pause from Command Center';

    console.log('Pausing rollout', { rolloutId, reason });

    // Update rollout status in database
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase
        .from('rollout_deployments')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString(),
          metadata: {
            pauseReason: reason,
            pausedAt: new Date().toISOString(),
            pausedBy: 'command_center_user'
          }
        })
        .eq('id', rolloutId);

      if (error) {
        throw error;
      }

      // Log audit event
      await supabase
        .from('events')
        .insert({
          event_type: 'rollout.paused',
          aggregate_id: rolloutId,
          aggregate_type: 'rollout_deployment',
          event_data: {
            rolloutId,
            reason,
            timestamp: new Date().toISOString()
          },
          idempotency_key: `rollout-pause-${rolloutId}-${Date.now()}`,
          metadata: {
            source: 'command_center',
            component: 'rollout_management'
          }
        });
    }

    console.log('Rollout paused successfully', { rolloutId });

    return NextResponse.json({
      success: true,
      message: 'Rollout paused successfully',
      rolloutId,
      status: 'paused'
    });

  } catch (error) {
    console.error('Failed to pause rollout', {
      rolloutId: params.id,
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      { error: 'Failed to pause rollout' },
      { status: 500 }
    );
  }
}