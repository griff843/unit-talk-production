/**
 * @fileoverview System Freeze toggle API endpoint
 * RBAC-protected endpoint for freezing/unfreezing system publishing
 */

import { NextRequest, NextResponse } from 'next/server';
import { RBACService, Permission } from '@/lib/rbac';
import { UnitTalkTracing } from '@/lib/telemetry';
import { supabase } from '@/lib/supabase';

// =============================================================================
// FREEZE CONFIGURATION
// =============================================================================

interface FreezeConfig {
  enabled: boolean;
  freeze_publishing: boolean;
  enable_shadow_mode: boolean;
  allow_grading: boolean;
  emergency_override?: boolean;
  reason?: string;
  estimated_duration?: string;
  activated_by?: string;
  activated_at?: Date;
  scheduled_end?: Date;
}

const DEFAULT_FREEZE_CONFIG: FreezeConfig = {
  enabled: false,
  freeze_publishing: true, // Stop all publishing
  enable_shadow_mode: true, // Auto-enable shadow mode
  allow_grading: true, // Continue grading for analysis
  emergency_override: false,
};

// =============================================================================
// FREEZE OPERATIONS
// =============================================================================

class FreezeService {
  /**
   * Get current freeze status
   */
  static async getStatus(): Promise<FreezeConfig> {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'system_freeze')
        .single();

      if (error || !data) {
        return DEFAULT_FREEZE_CONFIG;
      }

      return {
        ...DEFAULT_FREEZE_CONFIG,
        ...JSON.parse(data.config_value as string),
      };
    } catch (error) {
      console.error('Error fetching freeze status:', error);
      return DEFAULT_FREEZE_CONFIG;
    }
  }

  /**
   * Update freeze configuration
   */
  static async updateConfig(config: Partial<FreezeConfig>, actor: string): Promise<FreezeConfig> {
    const currentConfig = await this.getStatus();
    const newConfig = {
      ...currentConfig,
      ...config,
      activated_by: config.enabled ? actor : undefined,
      activated_at: config.enabled ? new Date() : undefined,
    };

    // Update in database
    const { error } = await supabase.from('system_config').upsert({
      config_key: 'system_freeze',
      config_value: JSON.stringify(newConfig),
      updated_at: new Date().toISOString(),
      updated_by: actor,
    });

    if (error) {
      throw new Error(`Failed to update freeze status: ${error.message}`);
    }

    // Apply freeze restrictions
    if (config.enabled) {
      await this.applyFreezeRestrictions(newConfig);
    } else {
      await this.removeFreezeRestrictions();
    }

    // Record system metric
    await this.recordFreezeMetric(newConfig.enabled);

    return newConfig;
  }

  /**
   * Apply freeze restrictions across the system
   */
  private static async applyFreezeRestrictions(config: FreezeConfig): Promise<void> {
    try {
      // Update system-wide freeze configuration
      const freezeSettings = {
        publishing_frozen: config.freeze_publishing,
        shadow_mode_enabled: config.enable_shadow_mode,
        grading_allowed: config.allow_grading,
        emergency_override: config.emergency_override,
        applied_at: new Date().toISOString(),
      };

      // Store freeze settings for agents to read
      const { error: configError } = await supabase.from('system_config').upsert({
        config_key: 'freeze_restrictions',
        config_value: JSON.stringify(freezeSettings),
        updated_at: new Date().toISOString(),
      });

      if (configError) {
        console.error('Error applying freeze restrictions:', configError);
      }

      // Auto-enable shadow mode if configured
      if (config.enable_shadow_mode) {
        await this.enableShadowMode();
      }

      // Update all active picks to frozen state (but allow grading)
      if (config.freeze_publishing) {
        const { error: picksError } = await supabase
          .from('unified_picks')
          .update({
            frozen: true,
            frozen_at: new Date().toISOString(),
            frozen_reason: 'System freeze activated',
          })
          .eq('published', false)
          .eq('workflow_stage', 'approved');

        if (picksError) {
          console.error('Error freezing picks:', picksError);
        }
      }
    } catch (error) {
      console.error('Error in applyFreezeRestrictions:', error);
      throw error;
    }
  }

  /**
   * Remove freeze restrictions
   */
  private static async removeFreezeRestrictions(): Promise<void> {
    try {
      // Clear freeze restrictions
      const { error: configError } = await supabase
        .from('system_config')
        .delete()
        .eq('config_key', 'freeze_restrictions');

      if (configError) {
        console.error('Error removing freeze restrictions:', configError);
      }

      // Unfreeze previously frozen picks
      const { error: picksError } = await supabase
        .from('unified_picks')
        .update({
          frozen: false,
          frozen_at: null,
          frozen_reason: null,
          unfrozen_at: new Date().toISOString(),
        })
        .eq('frozen', true)
        .eq('frozen_reason', 'System freeze activated');

      if (picksError) {
        console.error('Error unfreezing picks:', picksError);
      }
    } catch (error) {
      console.error('Error in removeFreezeRestrictions:', error);
      throw error;
    }
  }

  /**
   * Enable shadow mode automatically
   */
  private static async enableShadowMode(): Promise<void> {
    try {
      const { error } = await supabase.from('system_config').upsert({
        config_key: 'shadow_mode',
        config_value: JSON.stringify({
          enabled: true,
          reason: 'Auto-enabled by system freeze',
          enabled_at: new Date().toISOString(),
        }),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Error enabling shadow mode:', error);
      }
    } catch (error) {
      console.error('Error in enableShadowMode:', error);
    }
  }

  /**
   * Record freeze metric for monitoring
   */
  private static async recordFreezeMetric(enabled: boolean): Promise<void> {
    try {
      const { error } = await supabase.from('system_metrics').insert({
        metric: 'system_freeze_status',
        value: enabled ? 1 : 0,
        labels: JSON.stringify({
          action: enabled ? 'frozen' : 'unfrozen',
          timestamp: new Date().toISOString(),
        }),
        source: 'admin_control',
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Error recording freeze metric:', error);
      }
    } catch (error) {
      console.error('Error in recordFreezeMetric:', error);
    }
  }

  /**
   * Get freeze impact statistics
   */
  static async getFreezeImpactStats(): Promise<{
    frozen_picks: number;
    queued_picks: number;
    shadow_mode_active: boolean;
  }> {
    try {
      // Count frozen picks
      const { count: frozenCount } = await supabase
        .from('unified_picks')
        .select('*', { count: 'exact', head: true })
        .eq('frozen', true);

      // Count queued picks
      const { count: queuedCount } = await supabase
        .from('unified_picks')
        .select('*', { count: 'exact', head: true })
        .in('workflow_stage', ['draft', 'pending_review', 'approved'])
        .eq('published', false);

      // Check shadow mode status
      const { data: shadowData } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'shadow_mode')
        .single();

      const shadowModeActive = shadowData
        ? JSON.parse(shadowData.config_value as string).enabled
        : false;

      return {
        frozen_picks: frozenCount || 0,
        queued_picks: queuedCount || 0,
        shadow_mode_active: shadowModeActive,
      };
    } catch (error) {
      console.error('Error getting freeze impact stats:', error);
      return {
        frozen_picks: 0,
        queued_picks: 0,
        shadow_mode_active: false,
      };
    }
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/freeze
 * Get current freeze status and impact
 */
export async function GET(request: NextRequest) {
  const span = UnitTalkTracing.startAgentSpan('admin', 'get_freeze_status');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';

    // Check permissions
    await RBACService.requirePermission(userId, Permission.VIEW_DASHBOARD);

    const [status, impactStats] = await Promise.all([
      FreezeService.getStatus(),
      FreezeService.getFreezeImpactStats(),
    ]);

    UnitTalkTracing.recordSuccess(span);

    return NextResponse.json({
      success: true,
      data: {
        status,
        impact: impactStats,
      },
    });
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        code: 'FREEZE_GET_ERROR',
      },
      { status: 500 }
    );
  } finally {
    span.end();
  }
}

/**
 * POST /api/admin/freeze
 * Enable or disable system freeze
 */
export async function POST(request: NextRequest) {
  const span = UnitTalkTracing.startAgentSpan('admin', 'toggle_freeze');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';

    // Require admin permissions for system freeze
    await RBACService.requirePermission(userId, Permission.FREEZE_SYSTEM);

    const body = await request.json();
    const { enable, reason, estimated_duration, scheduled_end, emergency_override } = body;

    if (typeof enable !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: enable (boolean)',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    // Get current state for audit
    const previousState = await FreezeService.getStatus();

    // Update freeze configuration
    const newConfig = await FreezeService.updateConfig(
      {
        enabled: enable,
        reason: reason || (enable ? 'Manual freeze activation' : 'Manual freeze deactivation'),
        estimated_duration,
        scheduled_end: scheduled_end ? new Date(scheduled_end) : undefined,
        emergency_override: emergency_override || false,
      },
      userId
    );

    // Get impact stats after change
    const impactStats = await FreezeService.getFreezeImpactStats();

    // Log audit event
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: enable ? 'ENABLE_SYSTEM_FREEZE' : 'DISABLE_SYSTEM_FREEZE',
      resource_type: 'system',
      resource_id: 'system_freeze',
      payload: {
        enabled: enable,
        reason,
        estimated_duration,
        emergency_override,
        impact_stats: impactStats,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
      previous_state: previousState,
      new_state: newConfig,
      status: 'success',
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    UnitTalkTracing.addBusinessContext(span, {
      userId,
    });

    UnitTalkTracing.recordSuccess(span, {
      itemsProcessed: 1,
    });

    return NextResponse.json({
      success: true,
      data: {
        status: newConfig,
        impact: impactStats,
      },
      message: `System ${enable ? 'freeze enabled' : 'freeze disabled'} successfully`,
    });
  } catch (error) {
    const errorMessage = (error as Error).message || 'Unknown error';

    UnitTalkTracing.recordError(span, error as Error);

    // Log failed attempt
    const userId = request.headers.get('x-user-id') || 'anonymous';
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: 'SYSTEM_FREEZE_TOGGLE_FAILED',
      resource_type: 'system',
      resource_id: 'system_freeze',
      payload: { error: errorMessage },
      status: 'failure',
      error_message: errorMessage,
    });

    const statusCode = errorMessage.includes('Access denied') ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'FREEZE_ERROR',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}
