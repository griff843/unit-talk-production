#!/usr/bin/env tsx

/**
 * Apply Critical Database Migrations
 * 
 * Applies the critical migrations identified in the production readiness bundle:
 * 1. Add missing 'published' column to unified_picks (CRITICAL)
 * 2. Add professional grading columns to raw_props (ENHANCEMENT)
 */

import 'dotenv/config';
import { createLogger } from '../utils/logger';
import { requireSupabase } from '../utils/supabaseUtils';

const logger = createLogger('critical-migrations');

interface MigrationResult {
  migration: string;
  success: boolean;
  error?: string;
  rowsAffected?: number;
}

class CriticalMigrationApplicator {
  private results: MigrationResult[] = [];

  async applyMigrations(): Promise<void> {
    logger.info('🚀 Applying Critical Database Migrations');
    logger.info('═'.repeat(50));

    try {
      await this.applyCriticalUnifiedPicksColumn();
      await this.applyProfessionalGradingColumns();
      await this.generateReport();
      
    } catch (error) {
      logger.error('❌ Migration application failed:', error);
      process.exit(1);
    }
  }

  private async applyCriticalUnifiedPicksColumn(): Promise<void> {
    logger.info('🔥 CRITICAL: Adding published column to unified_picks table');
    
    const sql = `
      ALTER TABLE unified_picks 
      ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
    `;

    try {
      // Supabase doesn't support ALTER TABLE directly via client
      // We need to check if column exists first
      const supabaseClient = requireSupabase();
      const { data: columns, error: schemaError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'unified_picks')
        .eq('column_name', 'published');

      if (schemaError) {
        logger.warn('⚠️  Could not check schema directly, proceeding with test query');
      }

      // Test if column exists by trying to select it
      const supabaseClient = requireSupabase();
      const { error: testError } = await supabase
        .from('unified_picks')
        .select('published')
        .limit(1);

      if (testError && testError.message.includes('column "published" does not exist')) {
        logger.info('📋 Column does not exist, will need manual application via Supabase dashboard');
        this.results.push({
          migration: 'Add published column to unified_picks',
          success: false,
          error: 'Column does not exist - requires manual application via Supabase SQL Editor'
        });
      } else if (!testError) {
        logger.info('✅ Column already exists');
        this.results.push({
          migration: 'Add published column to unified_picks',
          success: true
        });
      } else {
        logger.error('❌ Unexpected error checking column:', testError);
        this.results.push({
          migration: 'Add published column to unified_picks',
          success: false,
          error: testError.message
        });
      }

      // Output the SQL for manual application
      logger.info('📝 SQL to run manually in Supabase SQL Editor:');
      logger.info(sql.trim());

    } catch (error) {
      logger.error('❌ Failed to apply critical migration:', error);
      this.results.push({
        migration: 'Add published column to unified_picks',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async applyProfessionalGradingColumns(): Promise<void> {
    logger.info('⚡ ENHANCEMENT: Adding professional grading columns to raw_props table');
    
    const columns = [
      'processed_at',
      'pro_attempts', 
      'processing_error',
      'professional_score',
      'kelly_fraction',
      'clv_tracking_id'
    ];

    const sql = `
      ALTER TABLE raw_props 
      ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS pro_attempts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS processing_error TEXT,
      ADD COLUMN IF NOT EXISTS professional_score DECIMAL(4,3),
      ADD COLUMN IF NOT EXISTS kelly_fraction DECIMAL(6,5),
      ADD COLUMN IF NOT EXISTS clv_tracking_id UUID;
    `;

    try {
      // Test each column individually
      const columnResults = [];
      
      for (const column of columns) {
        try {
          const supabaseClient = requireSupabase();
      const { error: testError } = await supabase
            .from('sports_game_odds')
            .select(column)
            .limit(1);

          if (testError && testError.message.includes(`column "${column}" does not exist`)) {
            columnResults.push({ column, exists: false });
          } else if (!testError) {
            columnResults.push({ column, exists: true });
          } else {
            columnResults.push({ column, exists: false, error: testError.message });
          }
        } catch (error) {
          columnResults.push({ column, exists: false, error: 'Test failed' });
        }
      }

      const missingColumns = columnResults.filter(c => !c.exists);
      const existingColumns = columnResults.filter(c => c.exists);

      logger.info(`📊 Professional grading columns status:`);
      logger.info(`   ✅ Existing: ${existingColumns.length}/${columns.length}`);
      logger.info(`   ❌ Missing: ${missingColumns.length}/${columns.length}`);

      if (missingColumns.length > 0) {
        logger.info('📝 SQL to run manually in Supabase SQL Editor:');
        logger.info(sql.trim());

        this.results.push({
          migration: 'Add professional grading columns to raw_props',
          success: false,
          error: `${missingColumns.length} columns missing - requires manual application via Supabase SQL Editor`
        });
      } else {
        logger.info('✅ All professional grading columns already exist');
        this.results.push({
          migration: 'Add professional grading columns to raw_props',
          success: true
        });
      }

    } catch (error) {
      logger.error('❌ Failed to check professional grading columns:', error);
      this.results.push({
        migration: 'Add professional grading columns to raw_props',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async generateReport(): Promise<void> {
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    logger.info('');
    logger.info('═'.repeat(60));
    logger.info('    CRITICAL MIGRATIONS APPLICATION REPORT');
    logger.info('═'.repeat(60));
    logger.info(`📊 Total Migrations: ${total}`);
    logger.info(`✅ Applied: ${successful}`);
    logger.info(`❌ Pending Manual Application: ${failed}`);
    logger.info('');

    if (failed > 0) {
      logger.warn('⚠️  MANUAL APPLICATION REQUIRED:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          logger.warn(`   • ${r.migration}: ${r.error}`);
        });
      logger.info('');
      logger.warn('🔧 NEXT STEPS:');
      logger.warn('   1. Open Supabase Dashboard');
      logger.warn('   2. Navigate to SQL Editor');
      logger.warn('   3. Copy and run the SQL statements shown above');
      logger.warn('   4. Re-run shadow mode validation tests');
    }

    if (successful > 0) {
      logger.info('✅ SUCCESSFULLY APPLIED:');
      this.results
        .filter(r => r.success)
        .forEach(r => logger.info(`   • ${r.migration}`));
      logger.info('');
    }

    // Critical assessment
    const criticalPassed = this.results.find(r => r.migration.includes('published'))?.success || false;
    
    logger.info('🎯 PRODUCTION READINESS IMPACT:');
    if (criticalPassed) {
      logger.info('   ✅ CRITICAL ISSUE RESOLVED - Deployment readiness improved');
      logger.info('   🚀 Re-run production readiness bundle to get updated score');
    } else {
      logger.error('   ❌ CRITICAL ISSUE PERSISTS - published column still missing');
      logger.error('   🛑 Manual application required before deployment');
    }

    logger.info('═'.repeat(60));
  }
}

async function main(): Promise<void> {
  const applicator = new CriticalMigrationApplicator();
  await applicator.applyMigrations();
}

if (require.main === module) {
  main().catch(error => {
    logger.error('❌ Migration application execution failed:', error);
    process.exit(1);
  });
}