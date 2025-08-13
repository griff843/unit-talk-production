import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

const TestAlertSchema = z.object({
  alertType: z.enum(['critical_error', 'database_down', 'high_latency', 'memory_exhaustion', 'custom']),
  customAlertName: z.string().optional(),
  severity: z.enum(['warning', 'critical']).default('critical'),
  reason: z.string().optional(),
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

// Generate test alert payload based on type
function generateTestAlert(alertType: string, customAlertName?: string, severity: string = 'critical') {
  const baseAlert = {
    status: 'firing' as const,
    startsAt: new Date().toISOString(),
    generatorURL: 'http://localhost:9090/graph',
    fingerprint: `test_${Date.now()}`,
  };

  switch (alertType) {
    case 'critical_error':
      return {
        ...baseAlert,
        labels: {
          alertname: 'HighErrorRate',
          severity: 'critical',
          service: 'api',
          error_rate: '0.15',
        },
        annotations: {
          summary: 'High error rate detected in API service',
          description: 'Error rate is 15% over the last 5 minutes',
          safe_mode: 'true',
        },
      };

    case 'database_down':
      return {
        ...baseAlert,
        labels: {
          alertname: 'DatabaseDown',
          severity: 'critical',
          instance: 'postgres-primary',
        },
        annotations: {
          summary: 'Primary database is down',
          description: 'PostgreSQL primary instance is not responding',
          safe_mode: 'true',
        },
      };

    case 'high_latency':
      return {
        ...baseAlert,
        labels: {
          alertname: 'DatabaseHighLatency',
          severity: 'critical',
          latency: '8000',
          instance: 'postgres-primary',
        },
        annotations: {
          summary: 'Database latency is critically high',
          description: 'Database response time is 8000ms, well above threshold',
        },
      };

    case 'memory_exhaustion':
      return {
        ...baseAlert,
        labels: {
          alertname: 'HighMemoryUsage',
          severity: 'critical',
          usage: '95',
          instance: 'api-server-1',
        },
        annotations: {
          summary: 'Memory usage critically high',
          description: 'Memory usage is at 95% on API server',
        },
      };

    case 'custom':
      return {
        ...baseAlert,
        labels: {
          alertname: customAlertName || 'CustomTestAlert',
          severity,
          test: 'true',
        },
        annotations: {
          summary: `Custom test alert: ${customAlertName || 'Test Alert'}`,
          description: 'This is a test alert generated from Command Center',
          safe_mode: severity === 'critical' ? 'true' : 'false',
        },
      };

    default:
      throw new Error(`Unknown alert type: ${alertType}`);
  }
}

// POST /api/ops/test/safemode-from-alert - Simulate critical alert triggering safe mode
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
    const { alertType, customAlertName, severity, reason } = TestAlertSchema.parse(body);

    // Check permissions - only admin can trigger test alerts in non-dev environments
    const hasPermission = await checkUserPermissions(supabase, user.id, 'admin');
    if (!hasPermission) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Required role: admin' 
      }, { status: 403 });
    }

    // Additional safety check - ensure this is not production
    const environment = process.env.NODE_ENV || 'development';
    if (environment === 'production' && !process.env.ALLOW_TEST_ALERTS) {
      return NextResponse.json({ 
        error: 'Test alerts are not allowed in production environment' 
      }, { status: 403 });
    }

    // Generate test alert
    const testAlert = generateTestAlert(alertType, customAlertName, severity);

    // Create the alertmanager webhook payload
    const webhookPayload = {
      receiver: 'command-center-test',
      status: 'firing',
      alerts: [testAlert],
      groupLabels: testAlert.labels,
      commonLabels: testAlert.labels,
      commonAnnotations: testAlert.annotations,
      externalURL: 'http://localhost:9093',
      version: '0.25.0',
      groupKey: `test_group_${Date.now()}`,
    };

    // Log the test alert trigger
    await supabase
      .from('app_audit_log')
      .insert({
        actor: user.email || user.id,
        action: 'test_alert_triggered',
        target: `test_alert_${alertType}`,
        meta: JSON.stringify({
          alert_type: alertType,
          custom_alert_name: customAlertName,
          severity,
          reason,
          test_payload: webhookPayload,
          timestamp: new Date().toISOString(),
        }),
        user_id: user.id,
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for'),
      });

    // Simulate the alertmanager webhook by calling our own endpoint
    try {
      const webhookUrl = `${request.nextUrl.origin}/api/alerts/alertmanager`;
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CommandCenter-TestAlert/1.0',
        },
        body: JSON.stringify(webhookPayload),
      });

      const webhookResult = await webhookResponse.json();

      return NextResponse.json({
        success: true,
        message: 'Test alert triggered successfully',
        test_alert: {
          type: alertType,
          alert_name: testAlert.labels.alertname,
          severity: testAlert.labels.severity,
          safe_mode_trigger: testAlert.annotations.safe_mode === 'true',
        },
        webhook_result: webhookResult,
        environment,
        audit_logged: true,
      });

    } catch (webhookError) {
      console.error('Error calling alertmanager webhook:', webhookError);
      
      return NextResponse.json({
        success: false,
        message: 'Test alert created but webhook failed',
        error: webhookError instanceof Error ? webhookError.message : 'Unknown webhook error',
        test_alert: {
          type: alertType,
          alert_name: testAlert.labels.alertname,
          severity: testAlert.labels.severity,
        },
        audit_logged: true,
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Test alert error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request format',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/ops/test/safemode-from-alert - Get test alert configuration
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const hasPermission = await checkUserPermissions(supabase, user.id, 'admin');
    if (!hasPermission) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Required role: admin' 
      }, { status: 403 });
    }

    const environment = process.env.NODE_ENV || 'development';
    const testAlertsAllowed = environment !== 'production' || process.env.ALLOW_TEST_ALERTS === 'true';

    // Get recent test alerts
    const { data: recentTests, error: testsError } = await supabase
      .from('app_audit_log')
      .select('*')
      .eq('action', 'test_alert_triggered')
      .order('occurred_at', { ascending: false })
      .limit(10);

    if (testsError) {
      console.error('Failed to fetch recent test alerts:', testsError);
    }

    return NextResponse.json({
      test_alerts_enabled: testAlertsAllowed,
      environment,
      available_alert_types: [
        { 
          type: 'critical_error', 
          description: 'High error rate alert that triggers safe mode',
          triggers_safe_mode: true,
        },
        { 
          type: 'database_down', 
          description: 'Database unavailability alert',
          triggers_safe_mode: true,
        },
        { 
          type: 'high_latency', 
          description: 'High database latency alert',
          triggers_safe_mode: true,
        },
        { 
          type: 'memory_exhaustion', 
          description: 'High memory usage alert',
          triggers_safe_mode: true,
        },
        { 
          type: 'custom', 
          description: 'Custom alert (specify alertName and severity)',
          triggers_safe_mode: 'configurable',
        },
      ],
      recent_test_alerts: recentTests?.map((entry: any) => ({
        timestamp: entry.occurred_at,
        actor: entry.actor,
        details: entry.meta ? JSON.parse(entry.meta) : null,
      })) || [],
      permissions: {
        can_trigger_test_alerts: hasPermission && testAlertsAllowed,
      },
    });

  } catch (error) {
    console.error('Test alert GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}