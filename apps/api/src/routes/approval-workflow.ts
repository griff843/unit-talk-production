import express from 'express';
import { supabaseClient } from '../utils/supabaseUtils';
import { requireSupabase } from '../utils/supabaseUtils';

const router = express.Router();

/**
 * SaaS-Grade Manual Approval Workflow
 * Single-Writer Promoter Pattern with Audit Trail
 */

// Get pending picks for approval
router.get('/pending', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] || '00000000-0000-0000-0000-000000000000';

    const supabaseClient = requireSupabase();
      const { data: pendingPicks, error } = await supabaseClient
      .from('approval_queue')
      .select(`
        id,
        unified_id,
        status,
        reason,
        created_at,
        unified_picks!unified_picks_id_fkey(
          id,
          sport,
          prediction,
          confidence,
          tier,
          score,
          professional_score,
          devigged_edge,
          kelly_fraction,
          user_id,
          created_at
        )
      `)
      .eq('status', 'pending')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      count: pendingPicks?.length || 0,
      picks: pendingPicks || []
    });
  } catch (error) {
    console.error('Error fetching pending picks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending picks',
      message: error.message
    });
  }
});

// Approve a pick (Single-Writer Pattern)
router.post('/:approvalId/approve', async (req, res) => {
  const { approvalId } = req.params;
  const { actorId, reason = 'Manual approval' } = req.body;
  const orgId = req.headers['x-org-id'] || '00000000-0000-0000-0000-000000000000';

  if (!actorId) {
    return res.status(400).json({
      success: false,
      error: 'actorId required for audit trail'
    });
  }

  const client = supabaseClient;

  try {
    // Single atomic transaction - Single-Writer Pattern
    const { data: approval, error: fetchError } = await client
      .from('approval_queue')
      .select('id, unified_id, status')
      .eq('id', approvalId)
      .eq('org_id', orgId)
      .single();

    if (fetchError) throw fetchError;

    if (approval.status !== 'pending') {
      return res.status(409).json({
        success: false,
        error: `Pick already ${approval.status}`
      });
    }

    // Update approval_queue (Single Writer)
    const { error: updateError } = await client
      .from('approval_queue')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: actorId,
        reason: reason
      })
      .eq('id', approvalId)
      .eq('org_id', orgId);

    if (updateError) throw updateError;

    // Update unified_picks with promotion data
    const promotionHash = `${approval.unified_id}-${Date.now()}-${actorId}`;

    const { error: pickUpdateError } = await client
      .from('unified_picks')
      .update({
        stage: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: actorId,
        promoted_at: new Date().toISOString(),
        promoted_by: actorId,
        promoted_hash: promotionHash,
        published: true
      })
      .eq('id', approval.unified_id)
      .eq('org_id', orgId);

    if (pickUpdateError) throw pickUpdateError;

    res.json({
      success: true,
      message: 'Pick approved and promoted successfully',
      approvalId,
      unifiedId: approval.unified_id,
      promotionHash,
      approvedBy: actorId,
      approvedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error approving pick:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve pick',
      message: error.message
    });
  }
});

// Deny a pick
router.post('/:approvalId/deny', async (req, res) => {
  const { approvalId } = req.params;
  const { actorId, reason = 'Manual denial' } = req.body;
  const orgId = req.headers['x-org-id'] || '00000000-0000-0000-0000-000000000000';

  if (!actorId) {
    return res.status(400).json({
      success: false,
      error: 'actorId required for audit trail'
    });
  }

  try {
    // Check current status
    const supabaseClient = requireSupabase();
    const { data: approval, error: fetchError } = await supabaseClient
      .from('approval_queue')
      .select('id, unified_id, status')
      .eq('id', approvalId)
      .eq('org_id', orgId)
      .single();

    if (fetchError) throw fetchError;

    if (approval.status !== 'pending') {
      return res.status(409).json({
        success: false,
        error: `Pick already ${approval.status}`
      });
    }

    // Update approval_queue
    const { error: updateError } = await supabaseClient
      .from('approval_queue')
      .update({
        status: 'denied',
        denied_at: new Date().toISOString(),
        denied_by: actorId,
        reason: reason
      })
      .eq('id', approvalId)
      .eq('org_id', orgId);

    if (updateError) throw updateError;

    // Update unified_picks
    const { error: pickUpdateError } = await supabaseClient
      .from('unified_picks')
      .update({
        stage: 'denied',
        denied_at: new Date().toISOString(),
        denied_by: actorId,
        published: false
      })
      .eq('id', approval.unified_id)
      .eq('org_id', orgId);

    if (pickUpdateError) throw pickUpdateError;

    res.json({
      success: true,
      message: 'Pick denied successfully',
      approvalId,
      unifiedId: approval.unified_id,
      deniedBy: actorId,
      deniedAt: new Date().toISOString(),
      reason
    });

  } catch (error) {
    console.error('Error denying pick:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deny pick',
      message: error.message
    });
  }
});

// Get approval history/audit trail
router.get('/history', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] || '00000000-0000-0000-0000-000000000000';
    const limit = parseInt(req.query.limit as string) || 50;

    const supabaseClient = requireSupabase();
      const { data: history, error } = await supabaseClient
      .from('approval_queue')
      .select(`
        id,
        unified_id,
        status,
        reason,
        created_at,
        approved_at,
        approved_by,
        denied_at,
        denied_by,
        unified_picks!unified_picks_id_fkey(
          id,
          sport,
          prediction,
          tier,
          score,
          user_id
        )
      `)
      .eq('org_id', orgId)
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({
      success: true,
      count: history?.length || 0,
      history: history || []
    });
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch approval history',
      message: error.message
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] || '00000000-0000-0000-0000-000000000000';

    const supabaseClient = requireSupabase();
      const { data: stats, error } = await supabaseClient
      .from('approval_queue')
      .select('status')
      .eq('org_id', orgId);

    if (error) throw error;

    const counts = {
      pending: stats?.filter(s => s.status === 'pending').length || 0,
      approved: stats?.filter(s => s.status === 'approved').length || 0,
      denied: stats?.filter(s => s.status === 'denied').length || 0,
      total: stats?.length || 0
    };

    res.json({
      success: true,
      workflow: 'operational',
      stats: counts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking approval workflow health:', error);
    res.status(500).json({
      success: false,
      error: 'Approval workflow health check failed',
      message: error.message
    });
  }
});

export default router;