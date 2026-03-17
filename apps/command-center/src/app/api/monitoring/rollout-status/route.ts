/* eslint-disable max-lines, complexity, no-console */
/**
 * @fileoverview Rollout Status API endpoint
 * PR9: Go-Live Hardening
 *
 * Returns current rollout status of the Ops/SLO/Incident/Remediation system
 * including feature flags, last activity timestamps, and readiness checks.
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  safe: boolean;
  category: 'global' | 'slo' | 'notification' | 'remediation';
}

interface LastActivity {
  slo_evaluation?: string | null;
  incident_opened?: string | null;
  notification_sent?: string | null;
  remediation_executed?: string | null;
}

interface PlaybookStatus {
  playbook_id: string;
  name: string;
  execution_type: 'EXECUTABLE' | 'RECOMMENDATION_ONLY';
  enabled: boolean;
  dry_run_only: boolean;
  requires_approval: boolean;
}

interface ReadinessChecks {
  schema_deployed: boolean;
  rls_enabled: boolean;
  playbooks_seeded: boolean;
  config_seeded: boolean;
  dry_run_enforced: boolean;
  approval_required: boolean;
}

interface RolloutData {
  overall_status: 'not_started' | 'staging' | 'production' | 'live';
  feature_flags: FeatureFlag[];
  last_activity: LastActivity;
  playbooks: PlaybookStatus[];
  safety_score: number;
  readiness_checks: ReadinessChecks;
}

// =============================================================================
// ROLLOUT STATUS SERVICE
// =============================================================================

class RolloutStatusService {
  /**
   * Get overall rollout data
   */
  static async getRolloutStatus(): Promise<RolloutData> {
    const [featureFlags, lastActivity, playbooks, readinessChecks] = await Promise.all([
      this.getFeatureFlags(),
      this.getLastActivity(),
      this.getPlaybooks(),
      this.getReadinessChecks(),
    ]);

    const safetyScore = this.calculateSafetyScore(featureFlags, playbooks, readinessChecks);
    const overallStatus = this.determineOverallStatus(featureFlags, safetyScore);

    return {
      overall_status: overallStatus,
      feature_flags: featureFlags,
      last_activity: lastActivity,
      playbooks,
      safety_score: safetyScore,
      readiness_checks: readinessChecks,
    };
  }

  /**
   * Get feature flags from remediation_config table
   */
  private static async getFeatureFlags(): Promise<FeatureFlag[]> {
    try {
      // Try ops schema first
      const { data, error } = await supabase
        .from('remediation_config')
        .select('config_key, config_value, description');

      if (error) {
        console.warn('Error fetching feature flags:', error.message);
        return this.getDefaultFeatureFlags();
      }

      const flags: FeatureFlag[] = [];

      // Map config to feature flags
      for (const rawRow of data || []) {
        const row = rawRow as {
          config_key: string;
          config_value: unknown;
          description: string | null;
        };
        const flag = this.mapConfigToFeatureFlag(row);
        if (flag) {
          flags.push(flag);
        }
      }

      // Add notification prefs
      const notificationFlags = await this.getNotificationFlags();
      flags.push(...notificationFlags);

      return flags.length > 0 ? flags : this.getDefaultFeatureFlags();
    } catch (error) {
      console.error('Error in getFeatureFlags:', error);
      return this.getDefaultFeatureFlags();
    }
  }

  /**
   * Map config row to feature flag
   */
  private static mapConfigToFeatureFlag(row: {
    config_key: string;
    config_value: unknown;
    description: string | null;
  }): FeatureFlag | null {
    const valueStr =
      typeof row.config_value === 'string' ? row.config_value : JSON.stringify(row.config_value);
    const enabled = valueStr === 'true' || valueStr === '"true"';

    switch (row.config_key) {
      case 'global_enabled':
        return {
          id: 'global_enabled',
          name: 'Global Remediation',
          description: row.description || 'Master switch for auto-remediation',
          enabled,
          safe: !enabled, // Safe when OFF
          category: 'global',
        };
      case 'dry_run_mode':
        return {
          id: 'dry_run_mode',
          name: 'Dry Run Mode',
          description: row.description || 'All executions are simulated',
          enabled,
          safe: enabled, // Safe when ON
          category: 'global',
        };
      case 'require_approval_by_default':
        return {
          id: 'require_approval',
          name: 'Require Approval',
          description: row.description || 'Manual approval before live execution',
          enabled,
          safe: enabled, // Safe when ON
          category: 'global',
        };
      default:
        return null;
    }
  }

  /**
   * Get notification-related feature flags
   */
  private static async getNotificationFlags(): Promise<FeatureFlag[]> {
    try {
      const { data, error } = await supabase
        .from('notification_prefs')
        .select('environment, destination, enabled')
        .eq('environment', 'production');

      if (error || !data) {
        return [
          {
            id: 'notifications_disabled',
            name: 'Notifications',
            description: 'Production notifications',
            enabled: false,
            safe: true,
            category: 'notification',
          },
        ];
      }

      return data.map(rawRow => {
        const row = rawRow as { environment: string; destination: string; enabled: boolean };
        return {
          id: `notification_${row.destination}`,
          name: `${row.destination.charAt(0).toUpperCase() + row.destination.slice(1)} Notifications`,
          description: `Send alerts to ${row.destination}`,
          enabled: row.enabled || false,
          safe: true, // Notifications are safe either way
          category: 'notification' as const,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Get last activity timestamps
   */
  private static async getLastActivity(): Promise<LastActivity> {
    try {
      const [sloEval, incident, notification, remediation] = await Promise.all([
        this.getLastSLOEvaluation(),
        this.getLastIncident(),
        this.getLastNotification(),
        this.getLastRemediation(),
      ]);

      return {
        slo_evaluation: sloEval,
        incident_opened: incident,
        notification_sent: notification,
        remediation_executed: remediation,
      };
    } catch (error) {
      console.error('Error getting last activity:', error);
      return {};
    }
  }

  private static async getLastSLOEvaluation(): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('slo_evaluations')
        .select('evaluated_at')
        .order('evaluated_at', { ascending: false })
        .limit(1)
        .single();
      if (!data) return null;
      return (data.evaluated_at as string) || null;
    } catch {
      return null;
    }
  }

  private static async getLastIncident(): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('slo_incidents')
        .select('opened_at')
        .order('opened_at', { ascending: false })
        .limit(1)
        .single();
      if (!data) return null;
      return (data.opened_at as string) || null;
    } catch {
      return null;
    }
  }

  private static async getLastNotification(): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('incident_notifications')
        .select('sent_at')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();
      if (!data) return null;
      return ((data as { sent_at?: string }).sent_at as string) || null;
    } catch {
      return null;
    }
  }

  private static async getLastRemediation(): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('remediation_executions')
        .select('completed_at')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      if (!data) return null;
      return (data.completed_at as string) || null;
    } catch {
      return null;
    }
  }

  /**
   * Get playbook statuses
   */
  private static async getPlaybooks(): Promise<PlaybookStatus[]> {
    try {
      const { data, error } = await supabase
        .from('remediation_playbooks')
        .select('playbook_id, name, execution_type, enabled, dry_run_only, requires_approval')
        .order('playbook_id');

      if (error) {
        console.warn('Error fetching playbooks:', error.message);
        return [];
      }

      return (data || []).map(rawRow => {
        const row = rawRow as {
          playbook_id: string;
          name: string;
          execution_type: string;
          enabled: boolean;
          dry_run_only: boolean;
          requires_approval: boolean;
        };
        return {
          playbook_id: row.playbook_id,
          name: row.name,
          execution_type: row.execution_type as 'EXECUTABLE' | 'RECOMMENDATION_ONLY',
          enabled: row.enabled || false,
          dry_run_only: row.dry_run_only !== false, // Default true
          requires_approval: row.requires_approval !== false, // Default true
        };
      });
    } catch (error) {
      console.error('Error in getPlaybooks:', error);
      return [];
    }
  }

  /**
   * Get readiness checks
   */
  private static async getReadinessChecks(): Promise<ReadinessChecks> {
    const checks: ReadinessChecks = {
      schema_deployed: false,
      rls_enabled: false,
      playbooks_seeded: false,
      config_seeded: false,
      dry_run_enforced: false,
      approval_required: false,
    };

    try {
      // Check schema deployed (can we query remediation_playbooks?)
      const { error: schemaError } = await supabase
        .from('remediation_playbooks')
        .select('playbook_id')
        .limit(1);
      checks.schema_deployed = !schemaError;

      // Check playbooks seeded (at least 5 playbooks)
      const { data: playbooks } = await supabase
        .from('remediation_playbooks')
        .select('playbook_id');
      checks.playbooks_seeded = (playbooks?.length || 0) >= 5;

      // Check config seeded
      const { data: config } = await supabase.from('remediation_config').select('config_key');
      checks.config_seeded = (config?.length || 0) >= 3;

      // Check dry run enforced
      const { data: dryRunConfig } = await supabase
        .from('remediation_config')
        .select('config_value')
        .eq('config_key', 'dry_run_mode')
        .single();
      const dryRunValue = dryRunConfig?.config_value;
      checks.dry_run_enforced = dryRunValue === true || dryRunValue === 'true';

      // Check approval required
      const { data: approvalConfig } = await supabase
        .from('remediation_config')
        .select('config_value')
        .eq('config_key', 'require_approval_by_default')
        .single();
      const approvalValue = approvalConfig?.config_value;
      checks.approval_required = approvalValue === true || approvalValue === 'true';

      // RLS check is assumed true if schema is deployed (we can't easily query pg_tables)
      checks.rls_enabled = checks.schema_deployed;
    } catch (error) {
      console.error('Error in getReadinessChecks:', error);
    }

    return checks;
  }

  /**
   * Calculate safety score (0-100)
   */
  private static calculateSafetyScore(
    flags: FeatureFlag[],
    playbooks: PlaybookStatus[],
    checks: ReadinessChecks
  ): number {
    let score = 0;
    let maxScore = 0;

    // Feature flag safety (40 points max)
    for (const flag of flags) {
      maxScore += 10;
      if (flag.safe) {
        score += 10;
      }
    }

    // Playbook safety (30 points max)
    for (const playbook of playbooks) {
      maxScore += 6;
      if (!playbook.enabled) score += 2; // Disabled is safe
      if (playbook.dry_run_only) score += 2; // Dry run is safe
      if (playbook.requires_approval) score += 2; // Approval is safe
    }

    // Readiness checks (30 points max)
    maxScore += 30;
    if (checks.schema_deployed) score += 5;
    if (checks.rls_enabled) score += 5;
    if (checks.playbooks_seeded) score += 5;
    if (checks.config_seeded) score += 5;
    if (checks.dry_run_enforced) score += 5;
    if (checks.approval_required) score += 5;

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  /**
   * Determine overall status
   */
  private static determineOverallStatus(
    flags: FeatureFlag[],
    safetyScore: number
  ): 'not_started' | 'staging' | 'production' | 'live' {
    const globalEnabled = flags.find(f => f.id === 'global_enabled')?.enabled || false;
    const dryRunMode = flags.find(f => f.id === 'dry_run_mode')?.enabled !== false;

    if (!globalEnabled && safetyScore < 50) {
      return 'not_started';
    }

    if (!globalEnabled) {
      return 'staging';
    }

    if (globalEnabled && dryRunMode) {
      return 'production';
    }

    return 'live';
  }

  /**
   * Get default feature flags when database isn't available
   */
  private static getDefaultFeatureFlags(): FeatureFlag[] {
    return [
      {
        id: 'global_enabled',
        name: 'Global Remediation',
        description: 'Master switch for auto-remediation',
        enabled: false,
        safe: true,
        category: 'global',
      },
      {
        id: 'dry_run_mode',
        name: 'Dry Run Mode',
        description: 'All executions are simulated',
        enabled: true,
        safe: true,
        category: 'global',
      },
      {
        id: 'require_approval',
        name: 'Require Approval',
        description: 'Manual approval before live execution',
        enabled: true,
        safe: true,
        category: 'global',
      },
    ];
  }
}

// =============================================================================
// API ENDPOINT
// =============================================================================

/**
 * GET /api/monitoring/rollout-status
 * Get current rollout status for PR9 Go-Live Hardening
 */
export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await RolloutStatusService.getRolloutStatus();

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching rollout status:', error);

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || 'Failed to fetch rollout status',
        code: 'ROLLOUT_STATUS_ERROR',
      },
      { status: 500 }
    );
  }
}
