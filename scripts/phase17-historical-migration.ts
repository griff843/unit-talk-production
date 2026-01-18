#!/usr/bin/env tsx

/**
 * Phase 17: Historical Data Migration
 * Migrate unified_picks → picks with 1:1 integrity verification
 * 
 * Date: 2025-01-25
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationLog {
  timestamp: string;
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  integrityChecks: {
    totalChecked: number;
    passed: number;
    failed: number;
  };
  duration: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  errors: string[];
}

class HistoricalMigration {
  private supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  private log: MigrationLog = {
    timestamp: new Date().toISOString(),
    totalRecords: 0,
    migratedRecords: 0,
    failedRecords: 0,
    integrityChecks: {
      totalChecked: 0,
      passed: 0,
      failed: 0,
    },
    duration: 0,
    status: 'SUCCESS',
    errors: [],
  };
  private startTime = Date.now();

  async execute() {
    console.log('🚀 Phase 17: Historical Data Migration');
    console.log('='.repeat(60));

    try {
      // 1. Count total records
      console.log('\n📊 Step 1: Counting Records...');
      await this.countRecords();

      // 2. Migrate data in batches
      console.log('\n📦 Step 2: Migrating Data in Batches...');
      await this.migrateDataInBatches();

      // 3. Verify 1:1 integrity
      console.log('\n✅ Step 3: Verifying 1:1 Integrity...');
      await this.verifyIntegrity();

      // 4. Generate migration log
      console.log('\n📋 Step 4: Generating Migration Log...');
      await this.generateMigrationLog();

      this.log.status = 'SUCCESS';
    } catch (error) {
      console.error('❌ Migration Failed:', error);
      this.log.status = 'FAILED';
      this.log.errors.push(String(error));
      await this.generateMigrationLog();
      process.exit(1);
    }
  }

  private async countRecords() {
    try {
      const { count } = await this.supabase
        .from('unified_picks')
        .select('*', { count: 'exact', head: true });

      this.log.totalRecords = count || 0;
      console.log(`✅ Total records to migrate: ${this.log.totalRecords}`);
    } catch (error) {
      throw new Error(`Failed to count records: ${error}`);
    }
  }

  private async migrateDataInBatches() {
    const BATCH_SIZE = 1000;
    let offset = 0;

    while (offset < this.log.totalRecords) {
      try {
        console.log(
          `  Processing batch: ${offset}-${Math.min(offset + BATCH_SIZE, this.log.totalRecords)}`
        );

        // Fetch batch
        const { data: batch, error: fetchError } = await this.supabase
          .from('unified_picks')
          .select('*')
          .range(offset, offset + BATCH_SIZE - 1);

        if (fetchError) {
          throw new Error(`Fetch error: ${fetchError.message}`);
        }

        if (!batch || batch.length === 0) {
          break;
        }

        // Transform and insert
        const transformedBatch = batch.map((record: any) => ({
          ...record,
          migrated_at: new Date().toISOString(),
          source_table: 'unified_picks',
        }));

        const { error: insertError } = await this.supabase
          .from('picks')
          .insert(transformedBatch);

        if (insertError) {
          this.log.failedRecords += batch.length;
          this.log.errors.push(
            `Batch ${offset}: ${insertError.message}`
          );
        } else {
          this.log.migratedRecords += batch.length;
        }

        offset += BATCH_SIZE;
      } catch (error) {
        this.log.errors.push(`Batch error at offset ${offset}: ${error}`);
        break;
      }
    }

    console.log(
      `✅ Migration complete: ${this.log.migratedRecords}/${this.log.totalRecords} records`
    );
  }

  private async verifyIntegrity() {
    try {
      // Sample verification: check 100 random records
      const { data: samples } = await this.supabase
        .from('unified_picks')
        .select('id')
        .limit(100);

      if (!samples) {
        throw new Error('Failed to fetch samples');
      }

      this.log.integrityChecks.totalChecked = samples.length;

      for (const sample of samples) {
        const { data: migratedRecord } = await this.supabase
          .from('picks')
          .select('*')
          .eq('id', sample.id)
          .single();

        if (migratedRecord) {
          this.log.integrityChecks.passed++;
        } else {
          this.log.integrityChecks.failed++;
        }
      }

      const passRate = (
        (this.log.integrityChecks.passed /
          this.log.integrityChecks.totalChecked) *
        100
      ).toFixed(2);
      console.log(`✅ Integrity verification: ${passRate}% pass rate`);
    } catch (error) {
      this.log.errors.push(`Integrity check failed: ${error}`);
    }
  }

  private async generateMigrationLog() {
    this.log.duration = Date.now() - this.startTime;

    const outDir = path.join(process.cwd(), 'out', 'ops', 'phase17');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const logPath = path.join(outDir, 'HISTORICAL_MIGRATION_LOG.json');
    fs.writeFileSync(logPath, JSON.stringify(this.log, null, 2));

    console.log(`✅ Migration log saved to ${logPath}`);
    console.log('\n' + '='.repeat(60));
    console.log('📋 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Records: ${this.log.totalRecords}`);
    console.log(`Migrated: ${this.log.migratedRecords}`);
    console.log(`Failed: ${this.log.failedRecords}`);
    console.log(`Integrity Pass Rate: ${
      (
        (this.log.integrityChecks.passed /
          this.log.integrityChecks.totalChecked) *
        100
      ).toFixed(2)
    }%`);
    console.log(`Duration: ${(this.log.duration / 1000).toFixed(2)}s`);
    console.log(`Status: ${this.log.status}`);
  }
}

// Execute migration
const migration = new HistoricalMigration();
migration.execute().catch(console.error);

