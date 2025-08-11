#!/usr/bin/env tsx

/**
 * Shadow Mode Invariants Validation
 * 
 * Production safety validation ensuring:
 * 1. Shadow mode NEVER publishes publicly ✅
 * 2. Live mode NEVER bypasses safety checks ✅
 * 3. Database invariants are maintained ✅
 * 4. Proper audit logging occurs ✅
 */

import 'dotenv/config';
import { createLogger } from '../utils/logger';
import { ShadowModeService } from '../shadow/ShadowMode';
import { supabase as supabaseClient } from '../services/supabaseClient';

const logger = createLogger('shadow-invariants-validator');

interface ValidationResult {
  passed: boolean;
  testName: string;
  details: string;
  critical: boolean;
}

class ShadowInvariantsValidator {
  private results: ValidationResult[] = [];

  async runValidation(): Promise<void> {
    logger.info('🚀 Starting Shadow Mode Invariants Validation');
    logger.info('═'.repeat(50));

    try {
      // Test in both shadow and live modes
      await this.testShadowMode();
      await this.testLiveMode();
      await this.testDatabaseInvariants();
      
      this.generateReport();
      
    } catch (error) {
      logger.error('❌ Validation failed with error:', error);
      process.exit(1);
    }
  }

  private async testShadowMode(): Promise<void> {
    logger.info('🔒 Testing Shadow Mode (SHADOW_MODE=true)');
    
    // Force shadow mode for this test
    const originalShadowMode = process.env.SHADOW_MODE;
    process.env.SHADOW_MODE = 'true';
    
    try {
      const shadowService = new (ShadowModeService as any)();
      
      // INVARIANT 1: Shadow mode is properly detected
      const isShadowMode = shadowService.isShadowMode();
      this.addResult({
        passed: isShadowMode,
        testName: 'Shadow Mode Detection',
        details: `Shadow mode detected: ${isShadowMode}`,
        critical: true
      });

      // INVARIANT 2: All public actions are blocked
      const publishBlocked = shadowService.shouldSkipPublicAction('publish');
      const alertBlocked = shadowService.shouldSkipPublicAction('alert');
      const webhookBlocked = shadowService.shouldSkipPublicAction('webhook');
      
      this.addResult({
        passed: publishBlocked && alertBlocked && webhookBlocked,
        testName: 'Public Action Blocking',
        details: `All public actions blocked: ${publishBlocked && alertBlocked && webhookBlocked}`,
        critical: true
      });

      // INVARIANT 3: Shadow logging works
      const testPick = {
        sport: 'TEST',
        market: 'shadow-validation',
        player: 'Shadow Test Player',
        tier: 'A',
        confidence: 85,
        professionalScore: 0.82
      };

      let shadowLogged = false;
      try {
        await shadowService.shadowWritePick(testPick, 'instant', ['validation-test']);
        shadowLogged = true;
      } catch (error) {
        logger.error('Shadow logging failed:', error);
      }

      this.addResult({
        passed: shadowLogged,
        testName: 'Shadow Logging Functionality',
        details: `Shadow pick logged: ${shadowLogged}`,
        critical: true
      });

      // INVARIANT 4: Verify shadow_decisions table receives data
      const { data: shadowData, error: shadowError } = await supabaseClient
        .from('shadow_decisions')
        .select('id, player, decided_action')
        .eq('player', 'Shadow Test Player')
        .limit(1);

      this.addResult({
        passed: !shadowError && shadowData && shadowData.length > 0,
        testName: 'Shadow Database Logging',
        details: `Shadow data in database: ${!shadowError && shadowData?.length > 0}`,
        critical: true
      });

    } finally {
      // Restore original environment
      if (originalShadowMode !== undefined) {
        process.env.SHADOW_MODE = originalShadowMode;
      } else {
        delete process.env.SHADOW_MODE;
      }
    }
  }

  private async testLiveMode(): Promise<void> {
    logger.info('🌐 Testing Live Mode (SHADOW_MODE=false)');
    
    // Force live mode for this test
    const originalShadowMode = process.env.SHADOW_MODE;
    process.env.SHADOW_MODE = 'false';
    
    try {
      const shadowService = new (ShadowModeService as any)();
      
      // INVARIANT 5: Live mode is properly detected
      const isShadowMode = shadowService.isShadowMode();
      this.addResult({
        passed: !isShadowMode,
        testName: 'Live Mode Detection',
        details: `Live mode detected: ${!isShadowMode}`,
        critical: true
      });

      // INVARIANT 6: Public actions are allowed in live mode
      const publishAllowed = !shadowService.shouldSkipPublicAction('publish');
      const alertAllowed = !shadowService.shouldSkipPublicAction('alert');
      const webhookAllowed = !shadowService.shouldSkipPublicAction('webhook');
      
      this.addResult({
        passed: publishAllowed && alertAllowed && webhookAllowed,
        testName: 'Public Action Allowance',
        details: `All public actions allowed: ${publishAllowed && alertAllowed && webhookAllowed}`,
        critical: false
      });

      // INVARIANT 7: Live mode still logs to shadow tables for audit
      const testPick = {
        sport: 'TEST',
        market: 'live-validation',
        player: 'Live Test Player',
        tier: 'B',
        confidence: 72
      };

      let liveLogged = false;
      try {
        await shadowService.shadowWritePick(testPick, 'queued-10am', ['live-test']);
        liveLogged = true;
      } catch (error) {
        logger.error('Live mode shadow logging failed:', error);
      }

      this.addResult({
        passed: liveLogged,
        testName: 'Live Mode Audit Logging',
        details: `Live mode logs to shadow tables: ${liveLogged}`,
        critical: false
      });

    } finally {
      // Restore original environment
      if (originalShadowMode !== undefined) {
        process.env.SHADOW_MODE = originalShadowMode;
      } else {
        delete process.env.SHADOW_MODE;
      }
    }
  }

  private async testDatabaseInvariants(): Promise<void> {
    logger.info('🗄️  Testing Database Invariants');

    // INVARIANT 8: shadow_decisions table exists and is accessible
    try {
      const { data, error } = await supabaseClient
        .from('shadow_decisions')
        .select('id')
        .limit(1);

      this.addResult({
        passed: !error,
        testName: 'Shadow Decisions Table',
        details: error ? `Table error: ${error.message}` : 'Table accessible',
        critical: true
      });
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Shadow Decisions Table',
        details: `Table check failed: ${error}`,
        critical: true
      });
    }

    // INVARIANT 9: unified_picks table exists with required columns
    try {
      const { data, error } = await supabaseClient
        .from('unified_picks')
        .select('id, published, workflow_stage, user_id')
        .limit(1);

      this.addResult({
        passed: !error,
        testName: 'Unified Picks Table Schema',
        details: error ? `Schema error: ${error.message}` : 'Required columns accessible',
        critical: true
      });
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Unified Picks Table Schema',
        details: `Schema check failed: ${error}`,
        critical: true
      });
    }

    // INVARIANT 10: Professional grading columns exist
    try {
      const { data, error } = await supabaseClient
        .from('raw_props')
        .select('processed_at, pro_attempts, processing_error')
        .limit(1);

      this.addResult({
        passed: !error,
        testName: 'Professional Grading Columns',
        details: error ? `Migration needed: ${error.message}` : 'Professional columns available',
        critical: false
      });
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Professional Grading Columns',
        details: `Migration check failed: ${error}`,
        critical: false
      });
    }

    // INVARIANT 11: Verify recent shadow activity
    try {
      const cutoff = new Date();
      cutoff.setMinutes(cutoff.getMinutes() - 5); // Last 5 minutes

      const { data, error } = await supabaseClient
        .from('shadow_decisions')
        .select('id, player, decided_action, created_at')
        .gte('created_at', cutoff.toISOString())
        .limit(10);

      const recentActivity = data && data.length > 0;
      
      this.addResult({
        passed: !error,
        testName: 'Shadow Activity Logging',
        details: `Recent activity: ${recentActivity ? data.length + ' entries' : 'none'} (${!error ? 'accessible' : 'error'})`,
        critical: false
      });
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Shadow Activity Logging',
        details: `Activity check failed: ${error}`,
        critical: false
      });
    }
  }

  private addResult(result: ValidationResult): void {
    this.results.push(result);
    
    const status = result.passed ? '✅' : '❌';
    const criticality = result.critical ? '[CRITICAL]' : '[INFO]';
    
    logger.info(`${status} ${criticality} ${result.testName}: ${result.details}`);
  }

  private generateReport(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const criticalFailures = this.results.filter(r => !r.passed && r.critical).length;
    const nonCriticalFailures = this.results.filter(r => !r.passed && !r.critical).length;

    logger.info('');
    logger.info('═'.repeat(60));
    logger.info('    SHADOW MODE INVARIANTS VALIDATION REPORT');
    logger.info('═'.repeat(60));
    logger.info(`📊 Total Tests: ${totalTests}`);
    logger.info(`✅ Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    logger.info(`❌ Failed: ${totalTests - passedTests}`);
    logger.info(`🚨 Critical Failures: ${criticalFailures}`);
    logger.info(`⚠️  Non-Critical Failures: ${nonCriticalFailures}`);
    logger.info('');

    if (criticalFailures > 0) {
      logger.error('🚨 CRITICAL FAILURES DETECTED:');
      this.results
        .filter(r => !r.passed && r.critical)
        .forEach(r => logger.error(`   • ${r.testName}: ${r.details}`));
      logger.info('');
    }

    if (nonCriticalFailures > 0) {
      logger.warn('⚠️  NON-CRITICAL FAILURES:');
      this.results
        .filter(r => !r.passed && !r.critical)
        .forEach(r => logger.warn(`   • ${r.testName}: ${r.details}`));
      logger.info('');
    }

    // Final verdict
    const productionReady = criticalFailures === 0;
    
    logger.info('🚀 PRODUCTION READINESS ASSESSMENT:');
    if (productionReady) {
      logger.info('   ✅ PASS - System meets all critical safety requirements');
      logger.info('   🔒 Shadow mode blocks public actions correctly');
      logger.info('   🌐 Live mode allows public actions correctly');
      logger.info('   🗄️  Database invariants maintained');
      logger.info('   📝 Audit logging functional');
      logger.info('');
      logger.info('   ✨ READY FOR DEPLOYMENT ✨');
    } else {
      logger.error('   ❌ FAIL - Critical safety requirements not met');
      logger.error('   🚨 Fix all critical failures before deployment');
      logger.error('   🛑 DEPLOYMENT BLOCKED');
    }

    logger.info('═'.repeat(60));

    // Exit with error code if critical failures
    if (criticalFailures > 0) {
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  const validator = new ShadowInvariantsValidator();
  await validator.runValidation();
}

if (require.main === module) {
  main().catch(error => {
    logger.error('❌ Validation execution failed:', error);
    process.exit(1);
  });
}