import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

const RollbackRequestSchema = z.object({
  environment: z.enum(['staging', 'prod']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  confirm: z.boolean().refine(val => val === true, 'Confirmation required'),
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

// Mock GitHub API function - replace with actual GitHub API when credentials available
async function triggerGitHubRollback(environment: string, actor: string, reason: string): Promise<{ success: boolean; message: string; workflowId?: string }> {
  try {
    // TODO: Replace with actual GitHub API call
    // const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    // const response = await octokit.rest.actions.createWorkflowDispatch({
    //   owner: 'griff843',
    //   repo: 'unit-talk-production',
    //   workflow_id: 'rollback.yml',
    //   ref: 'main',
    //   inputs: {
    //     environment: environment,
    //     reason: reason,
    //     triggered_by: actor,
    //   }
    // });
    
    console.log(`Triggering GitHub rollback for environment: ${environment}`);
    console.log(`Reason: ${reason}`);
    console.log(`Triggered by: ${actor}`);
    
    // For now, simulate success
    const mockWorkflowId = `rollback_${Date.now()}`;
    
    return {
      success: true,
      message: `Rollback workflow triggered for ${environment} environment`,
      workflowId: mockWorkflowId,
    };
  } catch (error) {
    console.error('Error triggering GitHub rollback:', error);
    return {
      success: false,
      message: `Failed to trigger rollback: ${error}`,
    };
  }
}

// POST /api/ops/rollback - Trigger deployment rollback
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
    const { environment, reason, confirm } = RollbackRequestSchema.parse(body);

    // Check permissions - only admin can trigger rollbacks
    const hasPermission = await checkUserPermissions(supabase, user.id, 'admin');
    if (!hasPermission) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Required role: admin' 
      }, { status: 403 });
    }

    // Additional safety check for production rollbacks
    if (environment === 'prod') {
      // Check if safe mode is enabled
      const { data: safeMode, error: safeModeError } = await supabase
        .from('app_system_config')
        .select('value')
        .eq('key', 'SAFE_MODE')
        .single();

      if (safeModeError || !safeMode) {
        return NextResponse.json({ 
          error: 'Cannot verify safe mode status. Rollback blocked.' 
        }, { status: 500 });
      }

      if (!safeMode.value) {
        return NextResponse.json({ 
          error: 'Production rollbacks require SAFE_MODE to be enabled first.' 
        }, { status: 403 });
      }
    }

    // Trigger the rollback
    const rollbackResult = await triggerGitHubRollback(environment, user.email || user.id, reason);

    // Log audit event for rollback action
    await supabase
      .from('app_audit_log')
      .insert({
        actor: user.email || user.id,
        action: 'deployment_rollback_triggered',
        target: `${environment}_deployment`,
        meta: JSON.stringify({
          environment,
          reason,
          workflow_id: rollbackResult.workflowId,
          timestamp: new Date().toISOString(),
          success: rollbackResult.success,
        }),
        user_id: user.id,
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for'),
      });

    // Create critical incident for production rollbacks
    if (environment === 'prod') {
      await supabase
        .from('app_incidents')
        .insert({
          severity: 'critical',
          source: 'manual',
          title: 'Production Deployment Rollback Triggered',
          details: {
            triggered_by: user.email || user.id,
            environment,
            reason,
            workflow_id: rollbackResult.workflowId,
            timestamp: new Date().toISOString(),
          },
        });
    }

    if (rollbackResult.success) {
      return NextResponse.json({
        success: true,
        message: rollbackResult.message,
        environment,
        workflow_id: rollbackResult.workflowId,
        audit_logged: true,
        incident_created: environment === 'prod',
      });
    } else {
      return NextResponse.json({
        success: false,
        message: rollbackResult.message,
        environment,
        audit_logged: true,
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Rollback POST error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request format',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/ops/rollback/status - Get rollback status and history
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

    // Get recent rollback history from audit log
    const { data: rollbackHistory, error: historyError } = await supabase
      .from('app_audit_log')
      .select('*')
      .eq('action', 'deployment_rollback_triggered')
      .order('occurred_at', { ascending: false })
      .limit(20);

    if (historyError) {
      console.error('Failed to fetch rollback history:', historyError);
      return NextResponse.json({ error: 'Failed to fetch rollback history' }, { status: 500 });
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

    // Check user role for rollback permissions
    const canRollbackStaging = await checkUserPermissions(supabase, user.id, 'ops');
    const canRollbackProd = await checkUserPermissions(supabase, user.id, 'admin');

    return NextResponse.json({
      permissions: {
        can_rollback_staging: canRollbackStaging && !config?.SYSTEM_FREEZE,
        can_rollback_prod: canRollbackProd && !config?.SYSTEM_FREEZE && config?.SAFE_MODE,
      },
      recent_rollbacks: rollbackHistory?.map((entry: any) => ({
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
      requirements: {
        staging: 'Ops or Admin role required',
        production: 'Admin role + Safe Mode enabled required',
      },
    });

  } catch (error) {
    console.error('Rollback status GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}