import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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

// GET /api/ops/audit - Get audit log entries
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

    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
    const actor = url.searchParams.get('actor');
    const action = url.searchParams.get('action');
    const target = url.searchParams.get('target');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // Build query
    let query = supabase
      .from('app_audit_log')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (actor) {
      query = query.ilike('actor', `%${actor}%`);
    }

    if (action) {
      query = query.ilike('action', `%${action}%`);
    }

    if (target) {
      query = query.ilike('target', `%${target}%`);
    }

    if (startDate) {
      query = query.gte('occurred_at', startDate);
    }

    if (endDate) {
      query = query.lte('occurred_at', endDate);
    }

    const { data: auditLogs, error: logsError } = await query;

    if (logsError) {
      console.error('Failed to fetch audit logs:', logsError);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    // Log audit event for accessing audit logs
    await supabase
      .from('app_audit_log')
      .insert({
        actor: user.email || user.id,
        action: 'audit_log_accessed',
        target: 'audit_log_system',
        meta: JSON.stringify({
          timestamp: new Date().toISOString(),
          filters: { actor, action, target, startDate, endDate },
          count: auditLogs?.length || 0,
        }),
        user_id: user.id,
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for'),
      });

    return NextResponse.json({ 
      logs: auditLogs || [],
      total: auditLogs?.length || 0,
      filters: { actor, action, target, startDate, endDate, limit },
    });

  } catch (error) {
    console.error('Audit logs GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}