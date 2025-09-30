import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient } from './supabaseClient';
import crypto from 'crypto';

export interface AlertData {
  unified_id: string;
  type: 'steam' | 'injury' | 'hedge' | 'middle' | 'line_movement' | 'arbitrage';
  signal_strength: number; // 0.0 to 1.0
  metadata?: Record<string, any>;
  org_id?: string;
}

export interface CooldownConfig {
  steam: number;      // minutes
  injury: number;     // minutes
  hedge: number;      // minutes
  middle: number;     // minutes
  line_movement: number; // minutes
  arbitrage: number;  // minutes
}

/**
 * Professional Alert System with Cooldown Prevention
 *
 * Prevents alert spam while ensuring critical signals reach users.
 * Uses hashing to detect duplicate alerts and time-based cooldowns.
 */
export class AlertSystem {
  private supabase: SupabaseClient;

  // Default cooldown periods (minutes)
  private defaultCooldowns: CooldownConfig = {
    steam: 15,        // Steam moves are rare, moderate cooldown
    injury: 60,       // Injury news spreads quickly, longer cooldown
    hedge: 5,         // Hedge opportunities are time-sensitive
    middle: 10,       // Middle opportunities need quick action
    line_movement: 2, // Line movements happen frequently, short cooldown
    arbitrage: 3      // Arbitrage opportunities are fleeting
  };

  constructor(
    supabase?: SupabaseClient,
    customCooldowns?: Partial<CooldownConfig>
  ) {
    this.supabase = supabase || supabaseClient;
    if (customCooldowns) {
      this.defaultCooldowns = { ...this.defaultCooldowns, ...customCooldowns };
    }
  }

  /**
   * Queue alert with cooldown protection
   */
  async queueAlert(alertData: AlertData): Promise<{
    success: boolean;
    queued: boolean;
    reason?: string;
    alertId?: string;
    cooldownUntil?: Date;
  }> {
    try {
      const orgId = alertData.org_id || '00000000-0000-0000-0000-000000000000';
      const alertHash = this.generateAlertHash(alertData);
      const cooldownMinutes = this.defaultCooldowns[alertData.type];
      const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);

      // Check if similar alert exists within cooldown
      const { data: existingAlert } = await this.supabase
        .from('alerts_queue')
        .select('id, last_sent_hash, cooldown_until, sent_at')
        .eq('unified_id', alertData.unified_id)
        .eq('type', alertData.type)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Check for duplicate hash (exact same alert)
      if (existingAlert?.last_sent_hash === alertHash) {
        return {
          success: true,
          queued: false,
          reason: 'Duplicate alert detected'
        };
      }

      // Check cooldown period
      if (existingAlert?.cooldown_until && new Date() < new Date(existingAlert.cooldown_until)) {
        return {
          success: true,
          queued: false,
          reason: 'Alert type in cooldown period',
          cooldownUntil: new Date(existingAlert.cooldown_until)
        };
      }

      // Queue the alert
      const { data: newAlert, error } = await this.supabase
        .from('alerts_queue')
        .insert({
          unified_id: alertData.unified_id,
          type: alertData.type,
          signal_strength: Math.max(0, Math.min(1, alertData.signal_strength)),
          cooldown_until: cooldownUntil.toISOString(),
          last_sent_hash: alertHash,
          org_id: orgId,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error queueing alert:', error);
        return {
          success: false,
          queued: false,
          reason: `Database error: ${error.message}`
        };
      }

      return {
        success: true,
        queued: true,
        alertId: newAlert.id,
        cooldownUntil
      };

    } catch (error) {
      console.error('Alert system error:', error);
      return {
        success: false,
        queued: false,
        reason: error.message
      };
    }
  }

  /**
   * Get pending alerts ready to send
   */
  async getPendingAlerts(
    orgId: string = '00000000-0000-0000-0000-000000000000',
    limit: number = 50
  ): Promise<{
    alerts: Array<{
      id: string;
      unified_id: string;
      type: string;
      signal_strength: number;
      created_at: string;
      pick_data?: any;
    }>;
    count: number;
  }> {
    try {
      const { data: alerts, error } = await this.supabase
        .from('alerts_queue')
        .select(`
          id,
          unified_id,
          type,
          signal_strength,
          created_at,
          unified_picks!unified_picks_id_fkey(
            id,
            sport,
            prediction,
            confidence,
            tier,
            score,
            user_id
          )
        `)
        .eq('org_id', orgId)
        .is('sent_at', null)
        .order('signal_strength', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return {
        alerts: alerts?.map(alert => ({
          id: alert.id,
          unified_id: alert.unified_id,
          type: alert.type,
          signal_strength: alert.signal_strength,
          created_at: alert.created_at,
          pick_data: alert.unified_picks
        })) || [],
        count: alerts?.length || 0
      };
    } catch (error) {
      console.error('Error fetching pending alerts:', error);
      return { alerts: [], count: 0 };
    }
  }

  /**
   * Mark alert as sent
   */
  async markAlertSent(
    alertId: string,
    orgId: string = '00000000-0000-0000-0000-000000000000'
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('alerts_queue')
        .update({
          sent_at: new Date().toISOString()
        })
        .eq('id', alertId)
        .eq('org_id', orgId);

      if (error) {
        console.error('Error marking alert as sent:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAlertSent:', error);
      return false;
    }
  }

  /**
   * Clean expired alerts (maintenance)
   */
  async cleanExpiredAlerts(
    daysOld: number = 7,
    orgId: string = '00000000-0000-0000-0000-000000000000'
  ): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const { data: deletedAlerts, error } = await this.supabase
        .from('alerts_queue')
        .delete()
        .eq('org_id', orgId)
        .not('sent_at', 'is', null)
        .lt('sent_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        console.error('Error cleaning expired alerts:', error);
        return 0;
      }

      return deletedAlerts?.length || 0;
    } catch (error) {
      console.error('Error in cleanExpiredAlerts:', error);
      return 0;
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(
    orgId: string = '00000000-0000-0000-0000-000000000000',
    hours: number = 24
  ): Promise<{
    total: number;
    by_type: Record<string, number>;
    pending: number;
    sent: number;
    avg_signal_strength: number;
  }> {
    try {
      const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      const { data: alerts, error } = await this.supabase
        .from('alerts_queue')
        .select('type, signal_strength, sent_at')
        .eq('org_id', orgId)
        .gte('created_at', cutoffDate.toISOString());

      if (error) throw error;

      const stats = {
        total: alerts?.length || 0,
        by_type: {} as Record<string, number>,
        pending: 0,
        sent: 0,
        avg_signal_strength: 0
      };

      if (!alerts || alerts.length === 0) {
        return stats;
      }

      let totalSignalStrength = 0;

      for (const alert of alerts) {
        // Count by type
        stats.by_type[alert.type] = (stats.by_type[alert.type] || 0) + 1;

        // Count pending/sent
        if (alert.sent_at) {
          stats.sent++;
        } else {
          stats.pending++;
        }

        // Sum signal strength
        totalSignalStrength += alert.signal_strength || 0;
      }

      stats.avg_signal_strength = totalSignalStrength / alerts.length;

      return stats;
    } catch (error) {
      console.error('Error getting alert stats:', error);
      return {
        total: 0,
        by_type: {},
        pending: 0,
        sent: 0,
        avg_signal_strength: 0
      };
    }
  }

  /**
   * Generate hash for alert deduplication
   */
  private generateAlertHash(alertData: AlertData): string {
    const hashInput = JSON.stringify({
      unified_id: alertData.unified_id,
      type: alertData.type,
      signal_strength: Math.round(alertData.signal_strength * 100), // Round to avoid tiny differences
      metadata: alertData.metadata || {}
    });

    return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  /**
   * Update cooldown configuration
   */
  updateCooldowns(newCooldowns: Partial<CooldownConfig>): void {
    this.defaultCooldowns = { ...this.defaultCooldowns, ...newCooldowns };
  }

  /**
   * Get current cooldown configuration
   */
  getCooldownConfig(): CooldownConfig {
    return { ...this.defaultCooldowns };
  }
}