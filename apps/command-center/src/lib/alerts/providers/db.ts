/**
 * Database Alert Provider - Phase 3
 *
 * Writes alerts to alert_events table in Supabase for history and tracking.
 */

import { createClient } from '@supabase/supabase-js';
import type { Alert, AlertEvent } from '../../slo/types';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured for alert DB writes');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function writeAlertToDB(alert: Alert): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    const alertEvent: Omit<AlertEvent, 'id'> = {
      fingerprint: alert.fingerprint,
      slo_name: alert.slo_name,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      current_value: alert.current_value,
      threshold: alert.threshold,
      data_source: alert.data_source,
      metadata: alert.metadata || {},
      acknowledged: false,
      resolved: false,
      created_at: alert.created_at,
    };

    const { error } = await supabase.from('alert_events').insert(alertEvent);

    if (error) {
      // If table doesn't exist, log warning but don't fail
      if (error.code === '42P01') {
        console.warn('[DB] alert_events table does not exist - run migration first');
        return;
      }
      throw error;
    }

    console.log(`[DB] Alert written to database: ${alert.title}`);
  } catch (error) {
    console.error('[DB] Failed to write alert to database:', error);
    throw error;
  }
}

export async function getRecentAlerts(limit: number = 50): Promise<AlertEvent[]> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('alert_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === '42P01') {
        console.warn('[DB] alert_events table does not exist - returning empty array');
        return [];
      }
      throw error;
    }

    return (data || []) as AlertEvent[];
  } catch (error) {
    console.error('[DB] Failed to fetch recent alerts:', error);
    return [];
  }
}

export async function acknowledgeAlert(
  alertId: string,
  acknowledgedBy: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('alert_events')
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: acknowledgedBy,
    })
    .eq('id', alertId);

  if (error) throw error;
}

export async function resolveAlert(alertId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('alert_events')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', alertId);

  if (error) throw error;
}
