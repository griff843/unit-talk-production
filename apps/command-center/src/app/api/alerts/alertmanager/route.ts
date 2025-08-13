import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createIncidentAutoSafeMode, writeAudit } from '@/server/systemConfig';
import { requirePermission, createUnauthorizedResponse } from '@/app/api/_lib/rbac';

// Alertmanager webhook payload schema
const AlertmanagerWebhookSchema = z.object({
  receiver: z.string(),
  status: z.enum(['firing', 'resolved']),
  alerts: z.array(z.object({
    status: z.enum(['firing', 'resolved']),
    labels: z.record(z.string()),
    annotations: z.record(z.string()),
    startsAt: z.string(),
    endsAt: z.string().optional(),
    generatorURL: z.string().optional(),
    fingerprint: z.string(),
  })),
  groupLabels: z.record(z.string()),
  commonLabels: z.record(z.string()),
  commonAnnotations: z.record(z.string()),
  externalURL: z.string(),
  version: z.string(),
  groupKey: z.string(),
  truncatedAlerts: z.number().optional(),
});

// Helper function to create Supabase client for server operations
function createServerClient() {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration for server operations');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Determine if alert should trigger safe mode
function shouldTriggerSafeMode(alert: any): boolean {
  const { labels, annotations } = alert;
  
  // Critical alerts that should trigger safe mode
  const criticalConditions = [
    // High error rates
    labels.alertname === 'HighErrorRate' && parseFloat(labels.error_rate || '0') > 0.1,
    
    // Database issues
    labels.alertname === 'DatabaseDown',
    labels.alertname === 'DatabaseHighLatency' && parseFloat(labels.latency || '0') > 5000,
    
    // Service unavailability
    labels.alertname === 'ServiceDown' && labels.service === 'api',
    labels.alertname === 'TemporalDown',
    
    // Memory/CPU issues
    labels.alertname === 'HighMemoryUsage' && parseFloat(labels.usage || '0') > 90,
    labels.alertname === 'HighCPUUsage' && parseFloat(labels.usage || '0') > 95,
    
    // Custom critical alerts
    labels.severity === 'critical',
    annotations.safe_mode === 'true',
    
    // Data integrity issues
    labels.alertname === 'DataCorruption',
    labels.alertname === 'PickValidationFailure',
  ];

  return criticalConditions.some(condition => condition);
}

// Create incident from alert using database function
async function createIncidentFromAlert(alert: any): Promise<number | null> {
  try {
    const { labels, annotations, status } = alert;
    
    // Determine severity
    let severity: 'warning' | 'critical' = 'warning';
    if (labels.severity === 'critical' || shouldTriggerSafeMode(alert)) {
      severity = 'critical';
    }

    // Use the database function to create incident and auto-trigger safe mode
    const result = await createIncidentAutoSafeMode({
      title: annotations.summary || labels.alertname || 'Unknown Alert',
      description: annotations.description || `Alert: ${labels.alertname}`,
      severity,
      source: 'alertmanager',
      actor: 'system/alertmanager',
      meta: {
        alert_name: labels.alertname,
        labels,
        annotations,
        alert_status: status,
        starts_at: alert.startsAt,
        ends_at: alert.endsAt,
        generator_url: alert.generatorURL,
        fingerprint: alert.fingerprint,
        received_at: new Date().toISOString(),
      },
    });

    if (!result.success) {
      console.error('Failed to create incident:', result.error);
      return null;
    }

    return result.incident_id || null;
  } catch (error) {
    console.error('Error creating incident from alert:', error);
    return null;
  }
}


// POST /api/alerts/alertmanager - Handle Alertmanager webhooks
export async function POST(request: NextRequest) {
  try {
    // Create Supabase client for resolving incidents
    const supabase = createServerClient();

    // Parse and validate the webhook payload
    const body = await request.json();
    const alertData = AlertmanagerWebhookSchema.parse(body);

    console.log(`Received Alertmanager webhook: ${alertData.alerts.length} alerts, status: ${alertData.status}`);

    const processedAlerts = [];
    const incidentsCreated = [];
    let safeModeTriggered = false;

    // Process each alert
    for (const alert of alertData.alerts) {
      const { labels, annotations, status } = alert;

      console.log(`Processing alert: ${labels.alertname} (${status})`);

      // Only process firing alerts for incident creation and safe mode
      if (status === 'firing') {
        // Create incident (auto-triggers safe mode for critical incidents)
        const incidentId = await createIncidentFromAlert(alert);
        if (incidentId) {
          incidentsCreated.push(incidentId);
          
          // Check if safe mode was triggered
          if (shouldTriggerSafeMode(alert)) {
            safeModeTriggered = true;
          }
        }
      }

      // Resolve incidents for resolved alerts
      if (status === 'resolved' && alert.fingerprint) {
        const { error: resolveError } = await supabase
          .from('app_incidents')
          .update({
            resolved_at: new Date().toISOString(),
            resolution_notes: 'Auto-resolved by Alertmanager',
            status: 'resolved',
          })
          .eq('source', 'alertmanager')
          .eq('status', 'open')
          .ilike('meta', `%${alert.fingerprint}%`);

        if (resolveError) {
          console.error('Failed to auto-resolve incident:', resolveError);
        }
      }

      processedAlerts.push({
        alertname: labels.alertname,
        status: status,
        fingerprint: alert.fingerprint,
        safe_mode_triggered: status === 'firing' && shouldTriggerSafeMode(alert),
      });
    }

    // Log overall webhook processing
    await writeAudit({
      actor: 'system/alertmanager',
      action: 'alertmanager_webhook_processed',
      target: 'alertmanager_integration',
      meta: {
        receiver: alertData.receiver,
        webhook_status: alertData.status,
        alerts_count: alertData.alerts.length,
        incidents_created: incidentsCreated.length,
        safe_mode_triggered: safeModeTriggered,
        processed_alerts: processedAlerts,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Alertmanager webhook processed successfully',
      processed: {
        alerts_count: alertData.alerts.length,
        incidents_created: incidentsCreated.length,
        safe_mode_triggered: safeModeTriggered,
        alerts: processedAlerts,
      },
    });

  } catch (error) {
    console.error('Alertmanager webhook error:', error);
    
    // Try to log the error if possible
    try {
      await writeAudit({
        actor: 'system/alertmanager',
        action: 'alertmanager_webhook_error',
        target: 'alertmanager_integration',
        meta: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid webhook payload',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Internal server error processing webhook' 
    }, { status: 500 });
  }
}

// GET /api/alerts/alertmanager - Get webhook configuration and status
export async function GET(request: NextRequest) {
  try {
    // Check user permissions
    const { success, user, error } = await requirePermission(request, 'read');
    
    if (!success || !user) {
      return createUnauthorizedResponse(error || 'Authentication required', 401);
    }

    // Create server client for data operations
    const supabase = createServerClient();

    // Get recent webhook activity
    const { data: recentActivity, error: activityError } = await supabase
      .from('app_audit_log')
      .select('*')
      .eq('actor', 'system/alertmanager')
      .order('occurred_at', { ascending: false })
      .limit(50);

    if (activityError) {
      console.error('Failed to fetch alertmanager activity:', activityError);
      return NextResponse.json({ error: 'Failed to fetch webhook activity' }, { status: 500 });
    }

    // Get current system status
    const { data: systemConfig, error: configError } = await supabase
      .from('app_system_config')
      .select('key, value')
      .eq('key', 'SAFE_MODE');

    const safeModeEnabled = systemConfig?.[0]?.value || false;

    return NextResponse.json({
      webhook_url: '/api/alerts/alertmanager',
      webhook_status: 'active',
      safe_mode_enabled: safeModeEnabled,
      recent_activity: recentActivity?.map((entry: any) => ({
        timestamp: entry.occurred_at,
        action: entry.action,
        details: entry.meta ? JSON.parse(entry.meta) : null,
      })) || [],
      configuration: {
        critical_alerts_trigger_safe_mode: true,
        auto_incident_creation: true,
        auto_resolution: true,
      },
    });

  } catch (error) {
    console.error('Alertmanager webhook GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}