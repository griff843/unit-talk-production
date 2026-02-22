import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Fail-closed - no hardcoded fallbacks
 * SPRINT-ARCHITECTURE-HARDENING-002A: Lazy client initialization
 */
let _supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_supabaseClient) return _supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'SPRINT-110A: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required'
    );
  }

  _supabaseClient = createClient(supabaseUrl, supabaseKey);
  return _supabaseClient;
}

export async function POST(request: NextRequest) {
  try {
    const alertData = await request.json();

    console.log('🚨 STORING CRITICAL API ALERT:', alertData);

    // Store alert in database
    const { data, error } = await getSupabase()
      .from('api_alerts')
      .insert([
        {
          alert_id: alertData.id,
          provider: alertData.provider,
          alert_type: alertData.alertType,
          message: alertData.message,
          severity: alertData.severity,
          details: alertData.details,
          created_at: alertData.timestamp,
          resolved: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Failed to store API alert:', error);
      // Try alternative storage method
      const { error: logError } = await getSupabase()
        .from('system_logs')
        .insert([
          {
            level: 'error',
            message: `API Alert: ${alertData.message}`,
            metadata: alertData,
            source: 'api_health_monitor',
            created_at: new Date().toISOString(),
          },
        ]);

      if (logError) {
        console.error('Failed to store in system_logs:', logError);
      }
    }

    // Broadcast to all connected Command Center clients via Supabase Realtime
    const channel = getSupabase().channel('command_center_alerts');
    await channel.send({
      type: 'broadcast',
      event: 'critical_api_alert',
      payload: alertData,
    });

    // Also send to realtime notifications table for persistent alerts
    await getSupabase()
      .from('realtime_notifications')
      .insert([
        {
          channel: 'command_center',
          event_type: 'critical_api_alert',
          severity: alertData.severity,
          title: `${alertData.provider} Critical Issue`,
          message: alertData.message,
          data: alertData.details,
          created_at: new Date().toISOString(),
        },
      ])
      .then(({ error }) => {
        if (error) console.warn('Failed to store realtime notification:', error);
      });

    return NextResponse.json({
      success: true,
      message: 'Alert stored and broadcast successfully',
      alertId: data?.alert_id || alertData.id,
    });
  } catch (error) {
    console.error('Critical error in alerts API:', error);

    // Log the critical alert even if database fails
    const fallbackAlert = {
      timestamp: new Date().toISOString(),
      error: 'Failed to store alert in database',
      originalAlert: await request.json().catch(() => 'Failed to parse request'),
      systemError: error instanceof Error ? error.message : String(error),
    };

    console.error('🚨🚨🚨 FALLBACK ALERT LOG 🚨🚨🚨:', fallbackAlert);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process alert',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeResolved = searchParams.get('resolved') === 'true';

    // Get active alerts for Command Center dashboard
    let query = getSupabase()
      .from('api_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!includeResolved) {
      query = query.eq('resolved', false);
    }

    const { data: alerts, error } = await query.limit(50);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      alerts: alerts || [],
      count: alerts?.length || 0,
    });
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch alerts',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { alertId, action, userId = 'system' } = await request.json();

    if (!alertId || !action) {
      return NextResponse.json(
        {
          success: false,
          error: 'alertId and action are required',
        },
        { status: 400 }
      );
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (action === 'acknowledge') {
      updates.acknowledged_by = userId;
      updates.acknowledged_at = new Date().toISOString();
    } else if (action === 'resolve') {
      updates.resolved = true;
      updates.resolved_by = userId;
      updates.resolved_at = new Date().toISOString();
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Use "acknowledge" or "resolve"',
        },
        { status: 400 }
      );
    }

    const { data, error } = await getSupabase()
      .from('api_alerts')
      .update(updates)
      .eq('alert_id', alertId)
      .select()
      .single();

    if (error) throw error;

    console.log(`Alert ${alertId} ${action}d by ${userId}`);

    return NextResponse.json({
      success: true,
      message: `Alert ${action}d successfully`,
      alert: data,
    });
  } catch (error) {
    console.error('Failed to update alert:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update alert',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
