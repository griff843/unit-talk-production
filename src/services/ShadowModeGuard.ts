/**
 * Shadow Mode Guard - Safeguards and validation for shadow publishing
 * Ensures shadow mode constraints are enforced and prevents accidental public posting
 */

import { createClient } from '@supabase/supabase-js';

export interface ShadowModeConfig {
  enabled: boolean;
  privateChannelId?: string;
  maxDaysRetention: number;
  allowPublicPosting: boolean;
  requireApprovalForPromotion: boolean;
}

export interface ShadowPublishRequest {
  contentType: 'pick' | 'recap' | 'alert';
  content: any;
  targetChannel?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ShadowValidationResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
  shadowChannelId?: string;
  requiresApproval?: boolean;
}

export class ShadowModeGuard {
  private supabase: ReturnType<typeof createClient>;
  private config: ShadowModeConfig;
  private logger: any;

  constructor(
    supabase: ReturnType<typeof createClient>,
    logger: any = console
  ) {
    this.supabase = supabase;
    this.logger = logger;
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): ShadowModeConfig {
    return {
      enabled: process.env.SHADOW_MODE === 'true',
      privateChannelId: process.env.SHADOW_PRIVATE_CHANNEL_ID,
      maxDaysRetention: parseInt(process.env.SHADOW_MAX_DAYS || '7', 10),
      allowPublicPosting: process.env.PUBLISH_TO_DISCORD === 'true',
      requireApprovalForPromotion: process.env.SHADOW_REQUIRE_APPROVAL === 'true'
    };
  }

  /**
   * Load current shadow mode configuration from database
   */
  async loadConfig(): Promise<ShadowModeConfig> {
    try {
      const { data: configs, error } = await this.supabase
        .from('system_config')
        .select('key, value')
        .in('key', [
          'SHADOW_MODE',
          'PUBLISH_TO_DISCORD', 
          'SHADOW_PRIVATE_CHANNEL_ID',
          'SHADOW_MAX_DAYS',
          'SHADOW_REQUIRE_APPROVAL'
        ]);

      if (error) {
        this.logger.warn('Failed to load shadow config from DB, using defaults', { error });
        return this.config;
      }

      const configMap = configs.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      this.config = {
        enabled: configMap.SHADOW_MODE === 'true',
        privateChannelId: configMap.SHADOW_PRIVATE_CHANNEL_ID,
        maxDaysRetention: parseInt(configMap.SHADOW_MAX_DAYS || '7', 10),
        allowPublicPosting: configMap.PUBLISH_TO_DISCORD === 'true',
        requireApprovalForPromotion: configMap.SHADOW_REQUIRE_APPROVAL === 'true'
      };

      this.logger.info('Shadow mode configuration loaded', { config: this.config });
      return this.config;

    } catch (error) {
      this.logger.error('Error loading shadow config', { error });
      return this.config;
    }
  }

  /**
   * Validate if a publish request is allowed under current shadow mode settings
   */
  async validatePublishRequest(request: ShadowPublishRequest): Promise<ShadowValidationResult> {
    await this.loadConfig();

    const warnings: string[] = [];
    let shadowChannelId: string | undefined;
    let requiresApproval = false;

    // Check if shadow mode is enabled
    if (!this.config.enabled) {
      // Shadow mode disabled - allow normal publishing
      if (!this.config.allowPublicPosting) {
        return {
          allowed: false,
          reason: 'Shadow mode disabled but public posting not allowed',
          warnings: ['PUBLISH_TO_DISCORD is false - no posting will occur']
        };
      }

      return {
        allowed: true,
        warnings: ['Shadow mode disabled - publishing to public channels']
      };
    }

    // Shadow mode enabled - validate constraints
    if (this.config.allowPublicPosting) {
      warnings.push('Shadow mode enabled but PUBLISH_TO_DISCORD is true - double check configuration');
    }

    // Determine shadow channel
    if (this.config.privateChannelId) {
      shadowChannelId = this.config.privateChannelId;
    } else {
      warnings.push('No shadow private channel configured - content will be logged only');
    }

    // Check if content requires approval
    if (this.config.requireApprovalForPromotion && request.contentType === 'pick') {
      requiresApproval = true;
      warnings.push('Pick promotion requires manual approval in shadow mode');
    }

    // Validate content safety
    const contentWarnings = await this.validateContentSafety(request);
    warnings.push(...contentWarnings);

    return {
      allowed: true,
      warnings,
      shadowChannelId,
      requiresApproval
    };
  }

  /**
   * Log shadow publish event for audit trail
   */
  async logShadowEvent(
    request: ShadowPublishRequest,
    validation: ShadowValidationResult,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const eventData = {
        content_type: request.contentType,
        target_channel: request.targetChannel,
        shadow_channel: validation.shadowChannelId,
        user_id: request.userId,
        warnings: validation.warnings,
        requires_approval: validation.requiresApproval,
        success,
        error,
        shadow_mode_enabled: this.config.enabled,
        public_posting_allowed: this.config.allowPublicPosting,
        metadata: request.metadata,
        created_at: new Date().toISOString()
      };

      await this.supabase
        .from('shadow_publish_log')
        .insert(eventData);

      // Also log to audit_log for compliance
      await this.supabase
        .from('audit_log')
        .insert({
          table_name: 'shadow_publish_log',
          operation: 'SHADOW_PUBLISH',
          details: eventData
        });

    } catch (logError) {
      this.logger.error('Failed to log shadow event', { logError, request });
    }
  }

  /**
   * Validate content for potential safety issues
   */
  private async validateContentSafety(request: ShadowPublishRequest): Promise<string[]> {
    const warnings: string[] = [];

    // Check for test data in production
    if (process.env.NODE_ENV === 'production') {
      const contentStr = JSON.stringify(request.content).toLowerCase();
      
      if (contentStr.includes('test') || contentStr.includes('dummy') || contentStr.includes('fake')) {
        warnings.push('Content contains test/dummy data in production environment');
      }
    }

    // Check for potentially sensitive information
    const sensitivePatterns = [
      /api[_-]?key/i,
      /password/i,
      /secret/i,
      /token/i,
      /\b[A-Za-z0-9]{32,}\b/, // Long alphanumeric strings (potential keys)
      /pk_[a-zA-Z0-9]+/, // API key patterns
      /sk_[a-zA-Z0-9]+/
    ];

    const contentStr = JSON.stringify(request.content);
    for (const pattern of sensitivePatterns) {
      if (pattern.test(contentStr)) {
        warnings.push(`Content may contain sensitive information matching pattern: ${pattern.source}`);
      }
    }

    return warnings;
  }

  /**
   * Check if shadow mode cleanup is needed
   */
  async checkCleanupNeeded(): Promise<{needed: boolean; oldRecords: number}> {
    if (!this.config.enabled) {
      return { needed: false, oldRecords: 0 };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxDaysRetention);

    try {
      const { count, error } = await this.supabase
        .from('shadow_publish_log')
        .select('id', { count: 'exact' })
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        this.logger.warn('Failed to check shadow cleanup needs', { error });
        return { needed: false, oldRecords: 0 };
      }

      return {
        needed: (count || 0) > 0,
        oldRecords: count || 0
      };

    } catch (error) {
      this.logger.error('Error checking cleanup needs', { error });
      return { needed: false, oldRecords: 0 };
    }
  }

  /**
   * Perform shadow mode data cleanup
   */
  async performCleanup(): Promise<{deleted: number; error?: string}> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxDaysRetention);

    try {
      const { count, error } = await this.supabase
        .from('shadow_publish_log')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        this.logger.error('Shadow cleanup failed', { error });
        return { deleted: 0, error: error.message };
      }

      this.logger.info('Shadow cleanup completed', { 
        deleted: count || 0, 
        cutoffDate: cutoffDate.toISOString() 
      });

      // Log cleanup event
      await this.supabase
        .from('audit_log')
        .insert({
          table_name: 'shadow_publish_log',
          operation: 'CLEANUP',
          details: {
            deleted_count: count || 0,
            cutoff_date: cutoffDate.toISOString(),
            retention_days: this.config.maxDaysRetention
          }
        });

      return { deleted: count || 0 };

    } catch (error) {
      this.logger.error('Shadow cleanup error', { error });
      return { deleted: 0, error: error.message };
    }
  }

  /**
   * Get current shadow mode status for monitoring
   */
  async getStatus(): Promise<{
    enabled: boolean;
    config: ShadowModeConfig;
    recentEvents: number;
    cleanupNeeded: boolean;
    oldRecords: number;
  }> {
    await this.loadConfig();

    // Count recent events (last 24 hours)
    const { count: recentEvents } = await this.supabase
      .from('shadow_publish_log')
      .select('id', { count: 'exact' })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Check cleanup needs
    const cleanup = await this.checkCleanupNeeded();

    return {
      enabled: this.config.enabled,
      config: this.config,
      recentEvents: recentEvents || 0,
      cleanupNeeded: cleanup.needed,
      oldRecords: cleanup.oldRecords
    };
  }

  /**
   * Emergency disable shadow mode (for critical production issues)
   */
  async emergencyDisable(reason: string, disabledBy?: string): Promise<boolean> {
    try {
      await this.supabase
        .from('system_config')
        .upsert([
          { key: 'SHADOW_MODE', value: 'false' },
          { key: 'PUBLISH_TO_DISCORD', value: 'true' }
        ]);

      // Log emergency action
      await this.supabase
        .from('audit_log')
        .insert({
          table_name: 'system_config',
          operation: 'EMERGENCY_DISABLE',
          details: {
            reason,
            disabled_by: disabledBy,
            timestamp: new Date().toISOString(),
            previous_shadow_mode: this.config.enabled,
            previous_publish_enabled: this.config.allowPublicPosting
          }
        });

      this.logger.warn('Shadow mode emergency disabled', { reason, disabledBy });

      // Reload config
      await this.loadConfig();

      return true;

    } catch (error) {
      this.logger.error('Failed to emergency disable shadow mode', { error });
      return false;
    }
  }
}

// Utility function for easy integration
export async function createShadowModeGuard(
  supabase: ReturnType<typeof createClient>,
  logger?: any
): Promise<ShadowModeGuard> {
  const guard = new ShadowModeGuard(supabase, logger);
  await guard.loadConfig();
  return guard;
}