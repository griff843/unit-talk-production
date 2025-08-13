import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

const ReplayRequestSchema = z.object({
  workflowId: z.string().optional(),
  allFailedSinceMinutes: z.number().min(1).max(1440).optional(), // Max 24 hours
  reason: z.string().optional(),
}).refine(data => data.workflowId || data.allFailedSinceMinutes, {
  message: "Either workflowId or allFailedSinceMinutes must be provided"
});

// Utility function to check user permissions
async function checkUserPermissions(supabase: any, userId: string, requiredRole: string) {
  const { data, error } = await supabase
    .rpc('user_has_permission', {
      user_uuid: userId,
      required_role: requiredRole
    });

  if (error) {
    console.error('Failed to check user permissions:', error);
    return false;
  }

  return data === true;
}

// Mock Temporal SDK functions - replace with actual Temporal SDK when available
async function triggerWorkflowReplay(workflowId: string): Promise<{ success: boolean; message: string }> {
  try {
    // TODO: Replace with actual Temporal SDK call
    // const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS });
    // const client = new WorkflowHandle(connection, workflowId);
    // await client.signal('replay');
    
    console.log(`Triggering replay for workflow: ${workflowId}`);
    
    // For now, simulate success
    return {
      success: true,
      message: `Replay triggered for workflow ${workflowId}`,
    };
  } catch (error) {
    console.error('Error triggering workflow replay:', error);
    return {
      success: false,
      message: `Failed to replay workflow ${workflowId}: ${error}`,
    };
  }
}

async function triggerBulkReplay(sinceMinutes: number): Promise<{ success: boolean; message: string; count: number }> {
  try {
    // TODO: Replace with actual Temporal SDK call to get failed workflows
    // const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS });
    // const client = new WorkflowService(connection);
    // const failedWorkflows = await client.listWorkflows({
    //   query: `WorkflowStatus = 'Failed' AND StartTime > '${new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString()}'`
    // });
    
    console.log(`Triggering bulk replay for failed workflows in last ${sinceMinutes} minutes`);
    
    // For now, simulate finding and replaying some workflows
    const mockFailedCount = Math.floor(Math.random() * 10) + 1;
    
    return {
      success: true,
      message: `Bulk replay triggered for ${mockFailedCount} failed workflows`,
      count: mockFailedCount,
    };
  } catch (error) {
    console.error('Error triggering bulk replay:', error);
    return {
      success: false,
      message: `Failed to trigger bulk replay: ${error}`,
      count: 0,
    };
  }
}

// POST /api/ops/replay - Trigger workflow replay
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { workflowId, allFailedSinceMinutes, reason } = ReplayRequestSchema.parse(body);

    // Check permissions - ops or admin can trigger replays
    const hasPermission = await checkUserPermissions(supabase, user.id, 'ops');
    if (!hasPermission) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Required role: ops or admin' 
      }, { status: 403 });
    }

    let replayResult;
    let auditTarget;
    let auditMeta;

    if (workflowId) {
      // Single workflow replay
      replayResult = await triggerWorkflowReplay(workflowId);
      auditTarget = `workflow_${workflowId}`;
      auditMeta = {
        workflow_id: workflowId,
        type: 'single_workflow',
        reason,
        timestamp: new Date().toISOString(),
      };
    } else if (allFailedSinceMinutes) {
      // Bulk replay
      replayResult = await triggerBulkReplay(allFailedSinceMinutes);
      auditTarget = 'bulk_replay';
      auditMeta = {
        since_minutes: allFailedSinceMinutes,
        type: 'bulk_replay',
        reason,
        workflows_count: (replayResult as any).count || 0,
        timestamp: new Date().toISOString(),
      };
    } else {
      return NextResponse.json({ error: 'Invalid replay request' }, { status: 400 });
    }

    // Log audit event for replay action
    await supabase
      .from('app_audit_log')
      .insert({
        actor: user.email || user.id,
        action: 'workflow_replay_triggered',
        target: auditTarget,
        meta: JSON.stringify(auditMeta),
        user_id: user.id,
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for'),
      });

    // Create incident record for significant replay actions
    if (allFailedSinceMinutes && allFailedSinceMinutes > 60) {
      await supabase
        .from('app_incidents')
        .insert({
          severity: 'warning',
          source: 'manual',
          title: 'Bulk Workflow Replay Triggered',
          details: {
            triggered_by: user.email || user.id,
            since_minutes: allFailedSinceMinutes,
            reason,
            timestamp: new Date().toISOString(),
          },
        });
    }

    if (replayResult.success) {
      return NextResponse.json({
        success: true,
        message: replayResult.message,
        audit_logged: true,
        ...(allFailedSinceMinutes ? { workflows_replayed: (replayResult as any).count } : {}),
      });
    } else {
      return NextResponse.json({
        success: false,
        message: replayResult.message,
        audit_logged: true,
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Replay POST error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request format',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/ops/replay/status - Get replay status and history
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has viewer permissions (minimum required)
    const hasPermission = await checkUserPermissions(supabase, user.id, 'viewer');
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get recent replay history from audit log
    const { data: replayHistory, error: historyError } = await supabase
      .from('app_audit_log')
      .select('*')
      .eq('action', 'workflow_replay_triggered')
      .order('occurred_at', { ascending: false })
      .limit(50);

    if (historyError) {
      console.error('Failed to fetch replay history:', historyError);
      return NextResponse.json({ error: 'Failed to fetch replay history' }, { status: 500 });
    }

    // Get current system status
    const { data: systemConfig, error: configError } = await supabase
      .from('app_system_config')
      .select('key, value')
      .in('key', ['SAFE_MODE', 'SYSTEM_FREEZE']);

    if (configError) {
      console.error('Failed to fetch system config:', configError);
      return NextResponse.json({ error: 'Failed to fetch system status' }, { status: 500 });
    }

    const config = systemConfig?.reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {});

    return NextResponse.json({
      replay_enabled: !config?.SYSTEM_FREEZE && !config?.SAFE_MODE,
      recent_replays: replayHistory?.map((entry: any) => ({
        id: entry.id,
        timestamp: entry.occurred_at,
        actor: entry.actor,
        target: entry.target,
        details: entry.meta ? JSON.parse(entry.meta) : null,
      })) || [],
      system_status: {
        safe_mode: config?.SAFE_MODE || false,
        system_freeze: config?.SYSTEM_FREEZE || false,
      },
    });

  } catch (error) {
    console.error('Replay status GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}