import { NextRequest, NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';

/**
 * Audit Trail API Endpoint
 * Comprehensive audit logging and compliance tracking for production systems
 */

interface AuditEvent {
  id?: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id?: string;
  details?: Record<string, any>;
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

    console.log('📋 GET /api/audit', query);

    try {
      let supabaseQuery = supabase
        .from('audit_logs')
        .select('*')
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

      if (error) throw error;

      // Get summary statistics
      const summaryQuery = supabase.from('audit_logs').select('status, risk_level, action');

      // Apply same filters for summary
      if (query.user_id) summaryQuery.eq('user_id', query.user_id);
      if (query.start_date) summaryQuery.gte('timestamp', query.start_date);
      if (query.end_date) summaryQuery.lte('timestamp', query.end_date);

      const { data: summaryData } = await summaryQuery;

      const summary = {
        total: summaryData?.length || 0,
        by_status: summaryData?.reduce((acc: any, log: any) => {
          acc[log.status] = (acc[log.status] || 0) + 1;
          return acc;
        }, {}),
        by_risk_level: summaryData?.reduce((acc: any, log: any) => {
          acc[log.risk_level] = (acc[log.risk_level] || 0) + 1;
          return acc;
        }, {}),
        by_action: summaryData?.reduce((acc: any, log: any) => {
          acc[log.action] = (acc[log.action] || 0) + 1;
          return acc;
        }, {}),
      };

      return NextResponse.json({
        success: true,
        data: {
          logs: auditLogs,
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
      console.log('⚠️ Database unavailable, using mock audit data');

      const mockAuditLogs = generateMockAuditLogs(query);

      return NextResponse.json({
        success: true,
        data: {
          logs: mockAuditLogs.slice(query.offset!, query.offset! + query.limit!),
          summary: {
            total: mockAuditLogs.length,
            by_status: { success: 45, failure: 8, warning: 12 },
            by_risk_level: { low: 32, medium: 18, high: 12, critical: 3 },
            by_action: { login: 15, logout: 12, create: 8, update: 20, delete: 5 },
          },
          pagination: {
            total: mockAuditLogs.length,
            limit: query.limit,
            offset: query.offset,
            has_more: mockAuditLogs.length > query.offset! + query.limit!,
          },
        },
        source: 'mock',
      });
    }
  } catch (error) {
    console.error('❌ GET /api/audit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
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
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate action and resource
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
        {
          success: false,
          error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Calculate risk level if not provided
    const riskLevel =
      body.risk_level || calculateRiskLevel(body.action, body.resource, body.details);

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

    console.log('📝 POST /api/audit - Creating audit entry:', {
      action: auditEvent.action,
      resource: auditEvent.resource,
      user_id: auditEvent.user_id,
      risk_level: auditEvent.risk_level,
    });

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert({ ...auditEvent })
        .select()
        .single();

      if (error) throw error;

      // Trigger alerts for high-risk events
      if (riskLevel === 'critical' || riskLevel === 'high') {
        await triggerSecurityAlert(auditEvent);
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
      console.log('⚠️ Database unavailable, logging audit event locally');

      // In production, this would write to local logs, queue for retry, etc.
      console.log('🗂️ Audit Event (Local):', auditEvent);

      return NextResponse.json(
        {
          success: true,
          data: { ...auditEvent, id: `local-${Date.now()}` },
          message: 'Audit entry logged locally (database unavailable)',
          source: 'local',
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('❌ POST /api/audit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Helper functions
function calculateRiskLevel(
  action: string,
  resource: string,
  details?: any
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

async function triggerSecurityAlert(auditEvent: AuditEvent) {
  try {
    // Production schema: type (enum), severity (enum), description, ip_address, user_id, metadata
    const alert = {
      type: 'suspicious_activity' as const, // Map security_audit to production enum
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

    await supabase.from('security_events').insert(alert);

    // In production, this would also send notifications via email, Slack, etc.
    console.log('🚨 Security alert triggered for audit event:', auditEvent.id);
  } catch (error) {
    console.error('❌ Failed to trigger security alert:', error);
  }
}

function generateMockAuditLogs(query: AuditQuery): AuditEvent[] {
  const actions = ['login', 'logout', 'create', 'update', 'delete', 'execute'];
  const resources = ['users', 'agents', 'system', 'analytics', 'security'];
  const statuses: ('success' | 'failure' | 'warning')[] = [
    'success',
    'success',
    'success',
    'failure',
    'warning',
  ];
  const riskLevels: ('low' | 'medium' | 'high' | 'critical')[] = [
    'low',
    'low',
    'medium',
    'medium',
    'high',
    'critical',
  ];
  const users = ['admin-1', 'operator-2', 'viewer-3', 'admin-4'];

  const logs: AuditEvent[] = [];

  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(Date.now() - i * 60000).toISOString();

    logs.push({
      id: `mock-${i}`,
      user_id: users[Math.floor(Math.random() * users.length)],
      action: actions[Math.floor(Math.random() * actions.length)],
      resource: resources[Math.floor(Math.random() * resources.length)],
      resource_id: `resource-${Math.floor(Math.random() * 1000)}`,
      details: { mock: true, index: i },
      ip_address: `192.168.1.${Math.floor(Math.random() * 255)}`,
      user_agent: 'Unit Talk Command Center/1.0',
      timestamp,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      risk_level: riskLevels[Math.floor(Math.random() * riskLevels.length)],
    });
  }

  return logs;
}
