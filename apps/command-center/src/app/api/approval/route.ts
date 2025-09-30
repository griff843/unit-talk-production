import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? 'pending';

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'pending': {
        // Get picks that have been scored but are pending approval
        const { data: pendingPicks, error } = await supabase
          .from('unified_picks')
          .select(`
            id,
            user_id,
            selection,
            odds,
            confidence,
            status,
            workflow_stage,
            sport,
            created_at,
            professional_score,
            kelly_fraction,
            devigged_edge,
            tier,
            feature_contributions,
            users!unified_picks_user_id_fkey (
              username,
              discord_id,
              tier,
              capper_tier
            )
          `)
          .eq('workflow_stage', 'pending_review')
          .not('professional_score', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('❌ Error fetching pending picks:', error);
          return NextResponse.json(
            { error: `Failed to fetch pending picks: ${error.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          count: pendingPicks?.length || 0,
          picks: pendingPicks || []
        });
      }

      case 'history': {
        const { data: history, error } = await supabase
          .from('unified_picks')
          .select(`
            id,
            user_id,
            selection,
            odds,
            confidence,
            status,
            workflow_stage,
            sport,
            created_at,
            professional_score,
            kelly_fraction,
            tier,
            users!unified_picks_user_id_fkey (
              username,
              discord_id,
              tier,
              capper_tier
            )
          `)
          .in('workflow_stage', ['approved', 'rejected'])
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('❌ Error fetching approval history:', error);
          return NextResponse.json(
            { error: `Failed to fetch approval history: ${error.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          count: history?.length || 0,
          history: history || []
        });
      }

      case 'health': {
        const { data: stats, error } = await supabase
          .from('unified_picks')
          .select('workflow_stage')
          .not('professional_score', 'is', null);

        if (error) {
          console.error('❌ Error checking approval health:', error);
          return NextResponse.json(
            { error: `Failed to check approval health: ${error.message}` },
            { status: 500 }
          );
        }

        const counts = {
          pending: stats?.filter(s => s.workflow_stage === 'pending_review').length || 0,
          approved: stats?.filter(s => s.workflow_stage === 'approved').length || 0,
          rejected: stats?.filter(s => s.workflow_stage === 'rejected').length || 0,
          total: stats?.length || 0
        };

        return NextResponse.json({
          success: true,
          workflow: 'operational',
          stats: counts,
          timestamp: new Date().toISOString()
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Approval API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const body = await request.json();
    const { pickId, pickIds, actorId = 'command-center-operator', reason } = body;

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'approve': {
        if (!pickId) {
          return NextResponse.json({ error: 'pickId is required' }, { status: 400 });
        }

        // Update workflow_stage to approved
        const { error } = await supabase
          .from('unified_picks')
          .update({
            workflow_stage: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: actorId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pickId)
          .eq('workflow_stage', 'pending_review');

        if (error) {
          console.error('❌ Error approving pick:', error);
          return NextResponse.json(
            { error: `Failed to approve pick: ${error.message}` },
            { status: 500 }
          );
        }

        console.log(`✅ Pick ${pickId} approved by ${actorId}`);

        return NextResponse.json({
          success: true,
          message: 'Pick approved successfully',
          pickId,
          approvedBy: actorId,
          approvedAt: new Date().toISOString()
        });
      }

      case 'reject': {
        if (!pickId) {
          return NextResponse.json({ error: 'pickId is required' }, { status: 400 });
        }

        // Update workflow_stage to rejected
        const { error } = await supabase
          .from('unified_picks')
          .update({
            workflow_stage: 'rejected',
            rejected_at: new Date().toISOString(),
            rejected_by: actorId,
            rejected_reason: reason || 'Manual rejection',
            updated_at: new Date().toISOString(),
          })
          .eq('id', pickId)
          .eq('workflow_stage', 'pending_review');

        if (error) {
          console.error('❌ Error rejecting pick:', error);
          return NextResponse.json(
            { error: `Failed to reject pick: ${error.message}` },
            { status: 500 }
          );
        }

        console.log(`✅ Pick ${pickId} rejected by ${actorId}: ${reason}`);

        return NextResponse.json({
          success: true,
          message: 'Pick rejected successfully',
          pickId,
          rejectedBy: actorId,
          rejectedAt: new Date().toISOString(),
          reason: reason || 'Manual rejection'
        });
      }

      case 'bulk': {
        if (!pickIds || !Array.isArray(pickIds)) {
          return NextResponse.json({ error: 'pickIds array is required' }, { status: 400 });
        }

        const bulkAction = body.bulkAction; // 'approve' or 'reject'

        if (bulkAction === 'approve') {
          const { error } = await supabase
            .from('unified_picks')
            .update({
              workflow_stage: 'approved',
              approved_at: new Date().toISOString(),
              approved_by: actorId,
              updated_at: new Date().toISOString(),
            })
            .in('id', pickIds)
            .eq('workflow_stage', 'pending_review');

          if (error) {
            console.error('❌ Error bulk approving picks:', error);
            return NextResponse.json(
              { error: `Failed to bulk approve picks: ${error.message}` },
              { status: 500 }
            );
          }
        } else if (bulkAction === 'reject') {
          const { error } = await supabase
            .from('unified_picks')
            .update({
              workflow_stage: 'rejected',
              rejected_at: new Date().toISOString(),
              rejected_by: actorId,
              rejected_reason: reason || 'Bulk rejection',
              updated_at: new Date().toISOString(),
            })
            .in('id', pickIds)
            .eq('workflow_stage', 'pending_review');

          if (error) {
            console.error('❌ Error bulk rejecting picks:', error);
            return NextResponse.json(
              { error: `Failed to bulk reject picks: ${error.message}` },
              { status: 500 }
            );
          }
        } else {
          return NextResponse.json({ error: 'Invalid bulkAction' }, { status: 400 });
        }

        console.log(`✅ Bulk ${bulkAction}ed ${pickIds.length} picks by ${actorId}`);

        return NextResponse.json({
          success: true,
          message: `${pickIds.length} picks ${bulkAction}ed successfully`,
          pickIds,
          action: bulkAction,
          actorId,
          timestamp: new Date().toISOString()
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Approval POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}