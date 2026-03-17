/**
 * @fileoverview Safe Mode toggle API endpoint
 * RBAC-protected endpoint for enabling/disabling Safe Mode
 */

import { NextRequest, NextResponse } from 'next/server';

import { getOperatorIdentity, requireOperatorIdentity } from '@/lib/auth';
import { RBACService, Permission } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { UnitTalkTracing } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

// =============================================================================
// SAFE MODE CONFIGURATION
// =============================================================================

interface SafeModeConfig {
  enabled: boolean;
  force_s_tier_only: boolean;
  ev_minimum_boost: number; // Boost EV minimum by this percentage
  mute_teasers: boolean;
  mute_combos: boolean;
  max_exposure_reduction: number; // Reduce max exposure by this percentage
  emergency_contact?: string;
  reason?: string;
  activated_by?: string;
  activated_at?: Date;
}

const DEFAULT_SAFE_MODE_CONFIG: SafeModeConfig = {
  enabled: false,
  force_s_tier_only: true, // Force S-tier only picks
  ev_minimum_boost: 2.0, // +2% EV minimum boost
  mute_teasers: true, // Disable teaser recommendations
  mute_combos: true, // Disable combo recommendations
  max_exposure_reduction: 25.0, // 25% exposure reduction
};

// =============================================================================
// SAFE MODE OPERATIONS
// =============================================================================

class SafeModeService {
  /**
   * Get current safe mode status
   */
  static async getStatus(): Promise<SafeModeConfig> {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'safe_mode')
        .single();

      if (error || !data) {
        return DEFAULT_SAFE_MODE_CONFIG;
      }

      return {
        ...DEFAULT_SAFE_MODE_CONFIG,
        ...JSON.parse(data.config_value as string),
      };
    } catch (error) {
      console.error('Error fetching safe mode status:', error);
      return DEFAULT_SAFE_MODE_CONFIG;
    }
  }

  /**
   * Update safe mode configuration
   */
  static async updateConfig(
    config: Partial<SafeModeConfig>,
    actor: string
  ): Promise<SafeModeConfig> {
    const currentConfig = await this.getStatus();
    const newConfig = {
      ...currentConfig,
      ...config,
      activated_by: config.enabled ? actor : undefined,
      activated_at: config.enabled ? new Date() : undefined,
    };

    // Update in database
    const { error } = await supabase.from('system_config').upsert({
      config_key: 'safe_mode',
      config_value: JSON.stringify(newConfig),
      updated_at: new Date().toISOString(),
      updated_by: actor,
    });

    if (error) {
      throw new Error(`Failed to update safe mode: ${error.message}`);
    }

    // If enabling safe mode, apply immediate restrictions
    if (config.enabled) {
      await this.applyRestrictions(newConfig);
    }

    // Record system metric
    await this.recordSafeModeMetric(newConfig.enabled);

    return newConfig;
  }

  /**
   * Apply safe mode restrictions across the system
   */
  private static async applyRestrictions(config: SafeModeConfig): Promise<void> {
    // Update system-wide configuration that agents will pick up
    const restrictions = {
      force_s_tier: config.force_s_tier_only,
      ev_boost: config.ev_minimum_boost,
      disable_teasers: config.mute_teasers,
      disable_combos: config.mute_combos,
      exposure_reduction: config.max_exposure_reduction,
      applied_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('system_config').upsert({
      config_key: 'active_restrictions',
      config_value: JSON.stringify(restrictions),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error applying restrictions:', error);
    }
  }

  /**
   * Record safe mode metric for monitoring
   */
  private static async recordSafeModeMetric(enabled: boolean): Promise<void> {
    try {
      // Production schema: metric_name, metric_value, metadata
      const { error } = await supabase.from('system_metrics').insert({
        metric_name: 'safe_mode_status',
        metric_value: enabled ? 1 : 0,
        metadata: {
          action: enabled ? 'enabled' : 'disabled',
          timestamp: new Date().toISOString(),
          source: 'admin_control',
        },
      });

      if (error) {
        console.error('Error recording safe mode metric:', error);
      }
    } catch (error) {
      console.error('Error in recordSafeModeMetric:', error);
    }
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/safe-mode
 * Get current safe mode status
 */
export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const span = UnitTalkTracing.startAgentSpan('admin', 'get_safe_mode_status');

  try {
    const { userId } = getOperatorIdentity(request);

    // Check permissions
    await RBACService.requirePermission(userId, Permission.VIEW_DASHBOARD);

    const status = await SafeModeService.getStatus();

    UnitTalkTracing.recordSuccess(span);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        code: 'SAFE_MODE_GET_ERROR',
      },
      { status: 500 }
    );
  } finally {
    span.end();
  }
}

/**
 * POST /api/admin/safe-mode
 * Enable or disable safe mode
 */
export async function POST(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const span = UnitTalkTracing.startAgentSpan('admin', 'toggle_safe_mode');

  try {
    const { userId } = getOperatorIdentity(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';

    // Require admin permissions for safe mode
    await RBACService.requirePermission(userId, Permission.SAFE_MODE);

    const body = await request.json();
    const { enable, reason, emergency_contact } = body;

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
    const previousState = await SafeModeService.getStatus();

    // Update safe mode configuration
    const newConfig = await SafeModeService.updateConfig(
      {
        enabled: enable,
        reason: reason || (enable ? 'Manual activation' : 'Manual deactivation'),
        emergency_contact,
      },
      userId
    );

    // Log audit event
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: enable ? 'ENABLE_SAFE_MODE' : 'DISABLE_SAFE_MODE',
      resource_type: 'system',
      resource_id: 'safe_mode',
      payload: {
        enabled: enable,
        reason,
        emergency_contact,
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
      data: newConfig,
      message: `Safe mode ${enable ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    const errorMessage = (error as Error).message || 'Unknown error';

    UnitTalkTracing.recordError(span, error as Error);

    // Log failed attempt
    const { userId } = getOperatorIdentity(request);
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: 'SAFE_MODE_TOGGLE_FAILED',
      resource_type: 'system',
      resource_id: 'safe_mode',
      payload: { error: errorMessage },
      status: 'failure',
      error_message: errorMessage,
    });

    const statusCode = errorMessage.includes('Access denied') ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'SAFE_MODE_ERROR',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}
