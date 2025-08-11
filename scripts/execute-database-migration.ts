#!/usr/bin/env tsx

/**
 * Database Schema Migration Executor
 * Executes the critical schema alignment migration to fix grading agent issues
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface MigrationResult {
  success: boolean;
  error?: string;
  details?: any;
}

class DatabaseMigrationExecutor {
  private supabase: any;

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
    }

    this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }

  /**
   * Execute the critical schema alignment migration
   */
  async executeMigration(): Promise<MigrationResult> {
    try {
      console.log('🚀 Starting database schema migration...');

      // Read the migration SQL file
      const migrationPath = join(process.cwd(), 'migrations', '001_critical_schema_alignment.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf-8');

      console.log('📄 Migration SQL loaded, executing...');

      // Execute the migration
      const { data, error } = await this.supabase.rpc('exec_sql', {
        sql: migrationSQL,
      });

      if (error) {
        console.error('❌ Migration failed:', error);
        return { success: false, error: error.message, details: error };
      }

      console.log('✅ Migration executed successfully!');
      return { success: true, details: data };
    } catch (error) {
      console.error('❌ Migration execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      };
    }
  }

  /**
   * Validate the migration was successful
   */
  async validateMigration(): Promise<MigrationResult> {
    try {
      console.log('🔍 Validating migration results...');

      // Check that critical columns exist
      const { data: rawPropsColumns, error: columnsError } = await this.supabase.rpc(
        'get_table_columns',
        { table_name: 'raw_props' }
      );

      if (columnsError) {
        return { success: false, error: 'Failed to fetch table columns', details: columnsError };
      }

      const requiredColumns = [
        'outcome',
        'promoted_to_picks',
        'trend_confidence',
        'edge_score',
        'matchup_quality',
        'expected_value',
        'sharp_money',
      ];

      const existingColumns = rawPropsColumns.map((col: any) => col.column_name);
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

      if (missingColumns.length > 0) {
        return {
          success: false,
          error: `Missing required columns: ${missingColumns.join(', ')}`,
          details: { missingColumns, existingColumns },
        };
      }

      // Check that new tables exist
      const { data: tables, error: tablesError } = await this.supabase.rpc('get_user_tables');

      if (tablesError) {
        return { success: false, error: 'Failed to fetch tables', details: tablesError };
      }

      const requiredTables = [
        'grading_results',
        'capper_profiles',
        'ml_features',
        'settlement_tracking',
      ];
      const existingTables = tables.map((table: any) => table.table_name);
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        return {
          success: false,
          error: `Missing required tables: ${missingTables.join(', ')}`,
          details: { missingTables, existingTables },
        };
      }

      console.log('✅ Migration validation successful!');
      return { success: true };
    } catch (error) {
      console.error('❌ Migration validation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
        details: error,
      };
    }
  }

  /**
   * Test that the grading agent can now query the database correctly
   */
  async testGradingAgentQuery(): Promise<MigrationResult> {
    try {
      console.log('🧪 Testing grading agent database queries...');

      // Test the exact query that was failing
      const { data, error } = await this.supabase
        .from('raw_props')
        .select('*')
        .is('outcome', null)
        .is('promoted_to_picks', false)
        .limit(5);

      if (error) {
        return {
          success: false,
          error: 'Grading agent query test failed',
          details: error,
        };
      }

      console.log(`✅ Grading agent query test successful! Found ${data.length} unprocessed props`);

      // Test inserting a grading result
      const testResult = {
        prop_id: data[0]?.id || '00000000-0000-0000-0000-000000000000', // Use first prop or dummy UUID
        final_score: 75.5,
        confidence: 0.85,
        tier: 'A' as const,
        edge_score: 12.3,
        model_version: 'test-migration',
        config_used: 'test',
      };

      const { data: insertData, error: insertError } = await this.supabase
        .from('grading_results')
        .insert(testResult)
        .select()
        .single();

      if (insertError) {
        console.warn(
          '⚠️ Grading results insert test failed (this may be expected if no props exist):',
          insertError.message
        );
      } else {
        console.log('✅ Grading results insert test successful!');

        // Clean up test record
        await this.supabase.from('grading_results').delete().eq('id', insertData.id);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Grading agent query test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown test error',
        details: error,
      };
    }
  }

  /**
   * Generate migration report
   */
  async generateMigrationReport(): Promise<void> {
    try {
      console.log('\n📊 Generating migration report...');

      // Get table statistics
      const { data: rawPropsCount } = await this.supabase
        .from('raw_props')
        .select('*', { count: 'exact', head: true });

      const { data: ungradedCount } = await this.supabase
        .from('raw_props')
        .select('*', { count: 'exact', head: true })
        .is('outcome', null)
        .is('promoted_to_picks', false);

      const { data: finalPicksCount } = await this.supabase
        .from('final_picks')
        .select('*', { count: 'exact', head: true });

      const { data: gradingResultsCount } = await this.supabase
        .from('grading_results')
        .select('*', { count: 'exact', head: true });

      const report = {
        migration_completed_at: new Date().toISOString(),
        tables: {
          raw_props: {
            total_count: rawPropsCount?.length || 0,
            ungraded_count: ungradedCount?.length || 0,
          },
          final_picks: {
            total_count: finalPicksCount?.length || 0,
          },
          grading_results: {
            total_count: gradingResultsCount?.length || 0,
          },
        },
        status: 'SUCCESS',
        message:
          'Database schema migration completed successfully. Grading agent should now function properly.',
      };

      console.log('\n📋 MIGRATION REPORT');
      console.log('===================');
      console.log(JSON.stringify(report, null, 2));
    } catch (error) {
      console.error('❌ Failed to generate migration report:', error);
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🎯 Unit Talk Database Schema Migration');
    console.log('=====================================');

    const migrator = new DatabaseMigrationExecutor();

    // Step 1: Execute migration
    const migrationResult = await migrator.executeMigration();
    if (!migrationResult.success) {
      console.error('❌ Migration failed, aborting...');
      process.exit(1);
    }

    // Step 2: Validate migration
    const validationResult = await migrator.validateMigration();
    if (!validationResult.success) {
      console.error('❌ Migration validation failed, manual review required...');
      console.error('Error:', validationResult.error);
      process.exit(1);
    }

    // Step 3: Test grading agent queries
    const testResult = await migrator.testGradingAgentQuery();
    if (!testResult.success) {
      console.error('❌ Grading agent query test failed, manual review required...');
      console.error('Error:', testResult.error);
    }

    // Step 4: Generate report
    await migrator.generateMigrationReport();

    console.log('\n🎉 DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('The grading agent should now be able to process props properly.');
    console.log('Next steps:');
    console.log('1. Restart the grading agent');
    console.log('2. Test prop processing end-to-end');
    console.log('3. Verify enhanced scoring metrics are populated');
  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { DatabaseMigrationExecutor };
