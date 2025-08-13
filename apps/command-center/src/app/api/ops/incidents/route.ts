import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

const ResolveIncidentSchema = z.object({
  id: z.number(),
  resolution_notes: z.string().optional(),
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

// GET /api/ops/incidents - Get recent incidents
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
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const severity = url.searchParams.get('severity');
    const source = url.searchParams.get('source');
    const resolved = url.searchParams.get('resolved');

    // Build query
    let query = supabase
      .from('app_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (severity && ['warning', 'critical'].includes(severity)) {
      query = query.eq('severity', severity);
    }

    if (source) {
      query = query.eq('source', source);
    }

    if (resolved === 'true') {
      query = query.not('resolved_at', 'is', null);
    } else if (resolved === 'false') {
      query = query.is('resolved_at', null);
    }

    const { data: incidents, error: incidentsError } = await query;

    if (incidentsError) {
      console.error('Failed to fetch incidents:', incidentsError);
      return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
    }

    // Log audit event for incidents access
    await supabase
      .from('app_audit_log')
      .insert({
        actor: user.email || user.id,
        action: 'incidents_read',
        target: 'incident_list',
        meta: JSON.stringify({
          timestamp: new Date().toISOString(),
          filters: { severity, source, resolved },
          count: incidents?.length || 0,
        }),
        user_id: user.id,
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for'),
      });

    return NextResponse.json({ 
      incidents: incidents || [],
      total: incidents?.length || 0,
    });

  } catch (error) {
    console.error('Incidents GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/ops/incidents/resolve - Resolve an incident
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
    const { id, resolution_notes } = ResolveIncidentSchema.parse(body);

    // Check permissions - ops or admin can resolve incidents
    const hasPermission = await checkUserPermissions(supabase, user.id, 'ops');
    if (!hasPermission) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Required role: ops or admin' 
      }, { status: 403 });
    }

    // First, get the current incident to log what we're resolving
    const { data: incident, error: getError } = await supabase
      .from('app_incidents')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    if (incident.resolved_at) {
      return NextResponse.json({ error: 'Incident already resolved' }, { status: 400 });
    }

    // Resolve the incident
    const { error: updateError } = await supabase
      .from('app_incidents')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: user.email || user.id,
        details: {
          ...incident.details,
          resolution_notes,
          resolved_by: user.email || user.id,
          resolved_at: new Date().toISOString(),
        }
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to resolve incident:', updateError);
      return NextResponse.json({ error: 'Failed to resolve incident' }, { status: 500 });
    }

    // Log audit event for incident resolution
    await supabase
      .from('app_audit_log')
      .insert({
        actor: user.email || user.id,
        action: 'incident_resolved',
        target: `incident_${id}`,
        meta: JSON.stringify({
          incident_title: incident.title,
          incident_severity: incident.severity,
          resolution_notes,
          timestamp: new Date().toISOString(),
        }),
        user_id: user.id,
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for'),
      });

    return NextResponse.json({ 
      success: true, 
      incident_id: id,
      resolved_at: new Date().toISOString(),
      resolved_by: user.email || user.id,
    });

  } catch (error) {
    console.error('Incident resolve error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request format',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}