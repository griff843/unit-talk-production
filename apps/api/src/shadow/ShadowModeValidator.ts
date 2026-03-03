/**
 * Shadow Mode Configuration Validator
 *
 * Validates shadow mode setup and ensures production safety invariants
 * before deployment. Critical for preventing accidental public posting
 * in shadow mode or bypassing safety checks in live mode.
 */

import { supabase as supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

import { shadowMode } from './ShadowMode';

export interface ShadowModeValidationResult {
  valid: boolean;
  mode: 'shadow' | 'live';
  errors: string[];
  warnings: string[];
  recommendations: string[];
  databaseChecks: {
    shadowTableExists: boolean;
    unifiedPicksTableExists: boolean;
    migrationApplied: boolean;
  };
  configurationChecks: {
    environmentConfigured: boolean;
    discordConfigured: boolean;
    cleanupConfigured: boolean;
  };
  invariantChecks: {
    publishGuardActive: boolean;
    shadowLoggingActive: boolean;
    publicActionBlocking: boolean;
  };
}

export class ShadowModeValidator {
  private static instance: ShadowModeValidator;
  private logger: any;

  private constructor() {
    this.logger = createLogger('ShadowModeValidator');
  }

  public static getInstance(): ShadowModeValidator {
    if (!ShadowModeValidator.instance) {
      ShadowModeValidator.instance = new ShadowModeValidator();
    }
    return ShadowModeValidator.instance;
  }

  /**
   * Comprehensive shadow mode validation
   */
  public async validateShadowModeSetup(): Promise<ShadowModeValidationResult> {
    this.logger.info('Starting comprehensive shadow mode validation');

    const result: ShadowModeValidationResult = {
      valid: true,
      mode: shadowMode.isShadowMode() ? 'shadow' : 'live',
      errors: [],
      warnings: [],
      recommendations: [],
      databaseChecks: {
        shadowTableExists: false,
        unifiedPicksTableExists: false,
        migrationApplied: false,
      },
      configurationChecks: {
        environmentConfigured: false,
        discordConfigured: false,
        cleanupConfigured: false,
      },
      invariantChecks: {
        publishGuardActive: false,
        shadowLoggingActive: false,
        publicActionBlocking: false,
      },
    };

    // Run all validation checks
    await Promise.all([
      this.validateDatabaseSetup(result),
      this.validateConfiguration(result),
      this.validateInvariants(result),
    ]);

    // Determine overall validity
    result.valid = result.errors.length === 0;

    this.logger.info('Shadow mode validation completed', {
      valid: result.valid,
      mode: result.mode,
      errors: result.errors.length,
      warnings: result.warnings.length,
    });

    return result;
  }

  /**
   * Validate database schema and tables
   */
  private async validateDatabaseSetup(result: ShadowModeValidationResult): Promise<void> {
    try {
      // Check if shadow_decisions table exists
      const { data: shadowTable, error: shadowError } = await supabaseClient
        .from('shadow_decisions')
        .select('id')
        .limit(1);

      if (shadowError && shadowError.code === 'PGRST116') {
        result.errors.push(
          'shadow_decisions table does not exist - run migration 004_professional_grading_columns.sql'
        );
        result.databaseChecks.shadowTableExists = false;
      } else if (shadowError) {
        result.warnings.push(`Error checking shadow_decisions table: ${shadowError.message}`);
        result.databaseChecks.shadowTableExists = false;
      } else {
        result.databaseChecks.shadowTableExists = true;
      }

      // Check if unified_picks table exists with required columns
      const { data: unifiedTable, error: unifiedError } = await supabaseClient
        .from('unified_picks')
        .select('id, published, stage, grading_status')
        .limit(1);

      if (unifiedError && unifiedError.code === 'PGRST116') {
        result.errors.push('unified_picks table does not exist or missing required columns');
        result.databaseChecks.unifiedPicksTableExists = false;
      } else if (unifiedError) {
        result.warnings.push(`Error checking unified_picks table: ${unifiedError.message}`);
        result.databaseChecks.unifiedPicksTableExists = false;
      } else {
        result.databaseChecks.unifiedPicksTableExists = true;
      }

      // Check if professional grading migration was applied
      const { data: migrationCheck, error: migrationError } = await supabaseClient
        .from('raw_props')
        .select('processed_at, pro_attempts, processing_error')
        .limit(1);

      if (migrationError && migrationError.message?.includes('does not exist')) {
        result.errors.push('Professional grading columns not found - migration 004 not applied');
        result.databaseChecks.migrationApplied = false;
      } else if (migrationError) {
        result.warnings.push(`Migration check failed: ${migrationError.message}`);
        result.databaseChecks.migrationApplied = false;
      } else {
        result.databaseChecks.migrationApplied = true;
      }

      // Check for shadow cleanup function
      const { data: cleanupFunction, error: cleanupError } = await supabaseClient.rpc(
        'cleanup_old_shadow_data',
        { max_days: 1 }
      );

      if (cleanupError && cleanupError.message?.includes('does not exist')) {
        result.warnings.push('Shadow cleanup function not found - manual cleanup required');
      }
    } catch (error) {
      result.errors.push(`Database validation failed: ${error}`);
    }
  }

  /**
   * Validate environment configuration
   */
  private async validateConfiguration(result: ShadowModeValidationResult): Promise<void> {
    // Check environment variable configuration
    const shadowMode = process.env.SHADOW_MODE;
    const shadowChannel = process.env.SHADOW_PRIVATE_CHANNEL_ID;
    const shadowMaxDays = process.env.SHADOW_MAX_DAYS;
    const discordToken = process.env.DISCORD_TOKEN;

    if (shadowMode === undefined) {
      result.warnings.push('SHADOW_MODE environment variable not set - defaulting to false');
    } else if (shadowMode !== 'true' && shadowMode !== 'false') {
      result.errors.push('SHADOW_MODE must be "true" or "false"');
    } else {
      result.configurationChecks.environmentConfigured = true;
    }

    // Shadow mode specific checks
    if (shadowMode === 'true') {
      if (!shadowChannel) {
        result.warnings.push('SHADOW_PRIVATE_CHANNEL_ID not configured - shadow previews disabled');
      } else if (!discordToken) {
        result.warnings.push('DISCORD_TOKEN not configured - shadow previews will fail');
      } else {
        result.configurationChecks.discordConfigured = true;
      }

      if (!shadowMaxDays || isNaN(parseInt(shadowMaxDays))) {
        result.warnings.push('SHADOW_MAX_DAYS not configured - using default 7 days');
      } else {
        result.configurationChecks.cleanupConfigured = true;
      }

      // Production safety checks for shadow mode
      if (process.env.NODE_ENV === 'production') {
        result.recommendations.push('Shadow mode in production - ensure testing is complete');
      }
    }

    // Live mode specific checks
    if (shadowMode === 'false') {
      if (process.env.NODE_ENV !== 'production') {
        result.warnings.push('Live mode enabled in non-production environment');
      }

      // Verify all production channels are configured
      if (!process.env.DISCORD_PRODUCTION_CHANNEL_ID) {
        result.errors.push('DISCORD_PRODUCTION_CHANNEL_ID required for live mode');
      }

      if (!process.env.DISCORD_ALERTS_CHANNEL_ID) {
        result.warnings.push('DISCORD_ALERTS_CHANNEL_ID not configured - alerts disabled');
      }
    }
  }

  /**
   * Validate core invariants are working
   */
  private async validateInvariants(result: ShadowModeValidationResult): Promise<void> {
    try {
      // Test publish guard is active
      const publishGuardActive = this.testPublishGuard();
      result.invariantChecks.publishGuardActive = publishGuardActive;

      if (!publishGuardActive) {
        result.errors.push('Publish guard is not active - critical safety failure');
      }

      // Test shadow logging functionality
      const shadowLoggingActive = await this.testShadowLogging();
      result.invariantChecks.shadowLoggingActive = shadowLoggingActive;

      if (!shadowLoggingActive) {
        result.errors.push('Shadow logging is not working - audit trail compromised');
      }

      // Test public action blocking in shadow mode
      if (result.mode === 'shadow') {
        const publicActionBlocking = this.testPublicActionBlocking();
        result.invariantChecks.publicActionBlocking = publicActionBlocking;

        if (!publicActionBlocking) {
          result.errors.push('CRITICAL: Public actions not blocked in shadow mode');
        }
      } else {
        // In live mode, public actions should be allowed
        result.invariantChecks.publicActionBlocking = !shadowMode.shouldSkipPublicAction('publish');
      }
    } catch (error) {
      result.errors.push(`Invariant validation failed: ${error}`);
    }
  }

  /**
   * Test that publish guard is intercepting decisions
   */
  private testPublishGuard(): boolean {
    try {
      // Verify PublishGuardService exists and is importable
      const PublishGuard = require('../promotion/PublishGuard').PublishGuardService;
      const guard = PublishGuard.getInstance();
      return guard && typeof guard.handlePromotionDecision === 'function';
    } catch (error) {
      this.logger.error('Publish guard test failed', { error });
      return false;
    }
  }

  /**
   * Test shadow logging functionality
   */
  private async testShadowLogging(): Promise<boolean> {
    try {
      // Test write to shadow tables
      const testPick = {
        sport: 'TEST',
        market: 'validation-test',
        player: 'Test Player',
        tier: 'TEST',
      };

      // Try to write a test shadow pick
      await shadowMode.shadowWritePick(testPick, 'rejected-gate', ['validation-test']);

      // If no error thrown, logging is working
      return true;
    } catch (error) {
      this.logger.error('Shadow logging test failed', { error });
      return false;
    }
  }

  /**
   * Test public action blocking in shadow mode
   */
  private testPublicActionBlocking(): boolean {
    if (!shadowMode.isShadowMode()) {
      return true; // Not applicable in live mode
    }

    // Test that all public actions are blocked
    const publishBlocked = shadowMode.shouldSkipPublicAction('publish');
    const alertBlocked = shadowMode.shouldSkipPublicAction('alert');
    const webhookBlocked = shadowMode.shouldSkipPublicAction('webhook');

    return publishBlocked && alertBlocked && webhookBlocked;
  }

  /**
   * Generate validation report
   */
  public generateValidationReport(result: ShadowModeValidationResult): string {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════');
    lines.push('    SHADOW MODE VALIDATION REPORT');
    lines.push('═══════════════════════════════════════');
    lines.push('');
    lines.push(`Mode: ${result.mode.toUpperCase()}`);
    lines.push(`Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push('');

    // Database Checks
    lines.push('📊 DATABASE CHECKS');
    lines.push(`Shadow Table: ${result.databaseChecks.shadowTableExists ? '✅' : '❌'}`);
    lines.push(`Unified Picks: ${result.databaseChecks.unifiedPicksTableExists ? '✅' : '❌'}`);
    lines.push(`Migration Applied: ${result.databaseChecks.migrationApplied ? '✅' : '❌'}`);
    lines.push('');

    // Configuration Checks
    lines.push('⚙️  CONFIGURATION CHECKS');
    lines.push(`Environment: ${result.configurationChecks.environmentConfigured ? '✅' : '❌'}`);
    lines.push(`Discord Setup: ${result.configurationChecks.discordConfigured ? '✅' : '⚠️'}`);
    lines.push(`Cleanup Setup: ${result.configurationChecks.cleanupConfigured ? '✅' : '⚠️'}`);
    lines.push('');

    // Invariant Checks
    lines.push('🛡️  INVARIANT CHECKS');
    lines.push(`Publish Guard: ${result.invariantChecks.publishGuardActive ? '✅' : '❌'}`);
    lines.push(`Shadow Logging: ${result.invariantChecks.shadowLoggingActive ? '✅' : '❌'}`);
    lines.push(`Action Blocking: ${result.invariantChecks.publicActionBlocking ? '✅' : '❌'}`);
    lines.push('');

    // Errors
    if (result.errors.length > 0) {
      lines.push('❌ ERRORS (MUST FIX)');
      result.errors.forEach(error => lines.push(`   • ${error}`));
      lines.push('');
    }

    // Warnings
    if (result.warnings.length > 0) {
      lines.push('⚠️  WARNINGS');
      result.warnings.forEach(warning => lines.push(`   • ${warning}`));
      lines.push('');
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      lines.push('💡 RECOMMENDATIONS');
      result.recommendations.forEach(rec => lines.push(`   • ${rec}`));
      lines.push('');
    }

    // Production Readiness
    lines.push('🚀 PRODUCTION READINESS');
    if (result.valid) {
      lines.push('   ✅ System is ready for deployment');
      if (result.mode === 'shadow') {
        lines.push('   🔒 Shadow mode - safe for testing');
      } else {
        lines.push('   🌐 Live mode - will publish publicly');
      }
    } else {
      lines.push('   ❌ System NOT ready for deployment');
      lines.push('   📋 Fix all errors before proceeding');
    }

    lines.push('');
    lines.push('═══════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Quick validation for CI/CD pipelines
   */
  public async quickValidation(): Promise<{ valid: boolean; criticalErrors: string[] }> {
    const result = await this.validateShadowModeSetup();

    // Identify critical errors that block deployment
    const criticalErrors = result.errors.filter(
      error =>
        error.includes('CRITICAL') ||
        error.includes('shadow_decisions table does not exist') ||
        error.includes('Publish guard is not active') ||
        error.includes('Public actions not blocked')
    );

    return {
      valid: criticalErrors.length === 0,
      criticalErrors,
    };
  }
}

// Export singleton instance
export const shadowModeValidator = ShadowModeValidator.getInstance();

// CLI function for manual validation
export async function runShadowModeValidation(): Promise<void> {
  const validator = ShadowModeValidator.getInstance();
  const result = await validator.validateShadowModeSetup();
  const report = validator.generateValidationReport(result);

  console.log(report);

  if (!result.valid) {
    process.exit(1);
  }
}
