'use server';

import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase';

/**
 * Audit Trail API Endpoint
 * SPRINT-DEMO-MODE-REMOVAL: All mock data removed.
 * Fail-closed: If database unavailable, return explicit error.
 */

interface AuditEvent {
  id?: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  session_id?: string;
  timestamp: string;
  status: 'success' | 'failure' | 'warning';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

interface AuditQuery {
  user_id?: string;
  action?: string;
  resource?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  risk_level?: string;
  limit?: number;
  offset?: number;
}

// GET /api/audit - Get audit trail logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query: AuditQuery = {
      user_id: searchParams.get('user_id') || undefined,
      action: searchParams.get('action') || undefined,
      resource: searchParams.get('resource') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      status: searchParams.get('status') || undefined,
      risk_level: searchParams.get('risk_level') || undefined,
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const supabase = createClient();

    let supabaseQuery = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false });

    // Apply filters
    if (query.user_id) {
      supabaseQuery = supabaseQuery.eq('user_id', query.user_id);
    }
    if (query.action) {
      supabaseQuery = supabaseQuery.eq('action', query.action);
    }
    if (query.resource) {
      supabaseQuery = supabaseQuery.eq('resource', query.resource);
    }
    if (query.status) {
      supabaseQuery = supabaseQuery.eq('status', query.status);
    }
    if (query.risk_level) {
      supabaseQuery = supabaseQuery.eq('risk_level', query.risk_level);
    }
    if (query.start_date) {
      supabaseQuery = supabaseQuery.gte('timestamp', query.start_date);
    }
    if (query.end_date) {
      supabaseQuery = supabaseQuery.lte('timestamp', query.end_date);
    }

    // Apply pagination
    supabaseQuery = supabaseQuery.range(query.offset!, query.offset! + query.limit! - 1);

    const { data: auditLogs, error, count } = await supabaseQuery;

    if (error) {
      console.error('[CC] Audit logs query failed:', error.message);
      return NextResponse.json(
        { success: false, error: `Database query failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Get summary statistics
    const { data: summaryData, error: summaryError } = await supabase
      .from('audit_logs')
      .select('status, risk_level, action');

    if (summaryError) {
      console.error('[CC] Audit summary query failed:', summaryError.message);
      // Continue without summary - it's supplementary data
    }

    const summary = {
      total: summaryData?.length || 0,
      by_status: summaryData?.reduce(
        (acc: Record<string, number>, log: { status?: string }) => {
          if (log.status) {
            acc[log.status] = (acc[log.status] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>
      ),
      by_risk_level: summaryData?.reduce(
        (acc: Record<string, number>, log: { risk_level?: string }) => {
          if (log.risk_level) {
            acc[log.risk_level] = (acc[log.risk_level] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>
      ),
      by_action: summaryData?.reduce(
        (acc: Record<string, number>, log: { action?: string }) => {
          if (log.action) {
            acc[log.action] = (acc[log.action] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    return NextResponse.json({
      success: true,
      data: {
        logs: auditLogs || [],
        summary,
        pagination: {
          total: count || 0,
          limit: query.limit,
          offset: query.offset,
          has_more: (count || 0) > query.offset! + query.limit!,
        },
      },
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] Audit logs error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/audit - Create audit log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Extract client information
    const clientIP =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // Validate required fields
    const requiredFields = ['user_id', 'action', 'resource'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate action
    const validActions = [
      'login',
      'logout',
      'create',
      'read',
      'update',
      'delete',
      'execute',
      'configure',
      'restart',
      'stop',
      'start',
      'emergency_stop',
      'maintenance_mode',
      'export',
      'import',
    ];

    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Calculate risk level if not provided
    const riskLevel = body.risk_level || calculateRiskLevel(body.action, body.resource);

    const auditEvent: AuditEvent = {
      user_id: body.user_id,
      action: body.action,
      resource: body.resource,
      resource_id: body.resource_id,
      details: body.details || {},
      ip_address: clientIP,
      user_agent: userAgent,
      session_id: body.session_id,
      timestamp: new Date().toISOString(),
      status: body.status || 'success',
      risk_level: riskLevel,
    };

    const supabase = createClient();

    const { data, error } = await supabase
      .from('audit_logs')
      .insert({ ...auditEvent })
      .select()
      .single();

    if (error) {
      console.error('[CC] Audit log insert failed:', error.message);
      return NextResponse.json(
        { success: false, error: `Failed to create audit entry: ${error.message}` },
        { status: 500 }
      );
    }

    // Trigger alerts for high-risk events
    if (riskLevel === 'critical' || riskLevel === 'high') {
      await triggerSecurityAlert(supabase, auditEvent);
    }

    return NextResponse.json(
      {
        success: true,
        data: data,
        message: 'Audit entry created successfully',
        source: 'database',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[CC] Audit log POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function calculateRiskLevel(
  action: string,
  resource: string
): 'low' | 'medium' | 'high' | 'critical' {
  // High-risk actions
  if (['delete', 'emergency_stop', 'maintenance_mode'].includes(action)) {
    return 'critical';
  }

  // Medium-high risk actions
  if (['execute', 'restart', 'stop', 'configure'].includes(action)) {
    return 'high';
  }

  // Medium risk actions
  if (['create', 'update', 'export'].includes(action)) {
    return 'medium';
  }

  // Critical resources regardless of action
  if (['system', 'security', 'users', 'agents'].includes(resource)) {
    return action === 'read' ? 'medium' : 'high';
  }

  return 'low';
}

async function triggerSecurityAlert(
  supabase: ReturnType<typeof createClient>,
  auditEvent: AuditEvent
) {
  try {
    const alert = {
      type: 'suspicious_activity' as const,
      severity: (auditEvent.risk_level === 'critical' ? 'critical' : 'high') as
        | 'low'
        | 'medium'
        | 'high'
        | 'critical',
      description: `High-risk activity detected: ${auditEvent.action} on ${auditEvent.resource}`,
      ip_address: auditEvent.ip_address,
      user_id: auditEvent.user_id,
      metadata: {
        audit_event_id: auditEvent.id,
        action: auditEvent.action,
        resource: auditEvent.resource,
        timestamp: auditEvent.timestamp,
      },
    };

    const { error } = await supabase.from('security_events').insert(alert);

    if (error) {
      console.error('[CC] Failed to insert security alert:', error.message);
    }
  } catch (error) {
    console.error('[CC] Failed to trigger security alert:', error);
  }
}
