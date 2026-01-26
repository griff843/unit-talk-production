#!/usr/bin/env tsx
/* eslint-disable no-console, security/detect-non-literal-fs-filename, max-lines */

/**
 * Database Schema Migration Executor
 *
 * Deterministic migration discovery and execution:
 * 1. MIGRATIONS_DIR env var override (default: /app/apps/api/migrations)
 * 2. Recursively finds all *.sql under that directory
 * 3. Sort order: numeric prefix files first (e.g., 004_*.sql), then remaining alphabetically
 * 4. Executes in order with clear error reporting
 *
 * Usage:
 *   npm run db:migrate:critical          # Execute all migrations
 *   npm run db:validate:schema           # Validate schema only (--validate-only)
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, basename, relative } from 'path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

interface MigrationFile {
  path: string;
  relativePath: string;
  name: string;
  hasNumericPrefix: boolean;
  numericPrefix: number | null;
}

interface MigrationResult {
  file: string;
  success: boolean;
  error?: string;
}

interface ExecutionReport {
  migrationsDir: string;
  totalFiles: number;
  successful: number;
  failed: number;
  results: MigrationResult[];
  overallSuccess: boolean;
}

const LINE = '='.repeat(70);
const DASH = '-'.repeat(70);

class DatabaseMigrationExecutor {
  private supabase: ReturnType<typeof createClient>;
  private migrationsDir: string;

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    }

    this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Resolve migrations directory: env var > Docker path > local path
    this.migrationsDir =
      process.env.MIGRATIONS_DIR ||
      (existsSync('/app/apps/api/migrations')
        ? '/app/apps/api/migrations'
        : join(process.cwd(), 'migrations'));
  }

  private findSqlFiles(dir: string, baseDir: string = dir): MigrationFile[] {
    if (!existsSync(dir)) return [];

    const files: MigrationFile[] = [];
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        files.push(...this.findSqlFiles(fullPath, baseDir));
      } else if (entry.endsWith('.sql')) {
        const name = basename(entry, '.sql');
        const numericMatch = name.match(/^(\d+)_/);
        files.push({
          path: fullPath,
          relativePath: relative(baseDir, fullPath),
          name,
          hasNumericPrefix: numericMatch !== null,
          numericPrefix: numericMatch ? parseInt(numericMatch[1], 10) : null,
        });
      }
    }
    return files;
  }

  private sortMigrations(files: MigrationFile[]): MigrationFile[] {
    return files.sort((a, b) => {
      if (a.hasNumericPrefix && b.hasNumericPrefix) return a.numericPrefix! - b.numericPrefix!;
      if (a.hasNumericPrefix) return -1;
      if (b.hasNumericPrefix) return 1;
      return a.relativePath.localeCompare(b.relativePath);
    });
  }

  private printPreflight(migrations: MigrationFile[]): void {
    console.log(LINE);
    console.log('DATABASE MIGRATION EXECUTOR - PREFLIGHT');
    console.log(LINE);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`MIGRATIONS_DIR: ${this.migrationsDir}`);
    console.log(`Directory exists: ${existsSync(this.migrationsDir) ? 'YES' : 'NO'}`);
    console.log(`Total migration files: ${migrations.length}`);
    console.log('');
    console.log('Migration files to be executed (in order):');
    console.log(DASH);

    if (migrations.length === 0) {
      console.log('  (no migration files found)');
    } else {
      migrations.forEach((m, i) => {
        const prefix = m.hasNumericPrefix ? `[${m.numericPrefix}]` : '[alpha]';
        console.log(`  ${(i + 1).toString().padStart(3)}. ${prefix} ${m.relativePath}`);
      });
    }
    console.log(DASH);
    console.log('');
  }

  private async executeSqlFile(migration: MigrationFile): Promise<MigrationResult> {
    const result: MigrationResult = { file: migration.relativePath, success: false };

    try {
      const sql = readFileSync(migration.path, 'utf-8');
      if (!sql.trim()) {
        console.log(`  [SKIP] ${migration.relativePath} (empty file)`);
        return { ...result, success: true };
      }

      console.log(`  [EXEC] ${migration.relativePath}...`);
      const { error } = await this.supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.log(`  [INFO] exec_sql function not available`);
          console.log(`  [INFO] Execute manually in Supabase SQL Editor: ${migration.path}`);
          return { ...result, error: 'Manual execution required - exec_sql unavailable' };
        }
        throw new Error(error.message);
      }

      console.log(`  [OK] ${migration.relativePath}`);
      return { ...result, success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(`  [FAIL] ${migration.relativePath}: ${errorMsg}`);
      return { ...result, error: errorMsg };
    }
  }

  private printSummary(total: number, successful: number, failed: number): void {
    console.log('');
    console.log(LINE);
    console.log('EXECUTION SUMMARY');
    console.log(LINE);
    console.log(`Total files: ${total}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Overall: ${failed === 0 ? 'SUCCESS' : 'FAILED'}`);
    console.log(LINE);
  }

  async executeMigrations(): Promise<ExecutionReport> {
    console.log('');
    console.log(LINE);
    console.log('DATABASE MIGRATION EXECUTOR');
    console.log(LINE);

    const migrations = this.sortMigrations(this.findSqlFiles(this.migrationsDir));
    this.printPreflight(migrations);

    if (migrations.length === 0) {
      console.log('No migration files found. Nothing to execute.');
      return {
        migrationsDir: this.migrationsDir,
        totalFiles: 0,
        successful: 0,
        failed: 0,
        results: [],
        overallSuccess: true,
      };
    }

    console.log('EXECUTING MIGRATIONS');
    console.log(DASH);

    const results: MigrationResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const migration of migrations) {
      const res = await this.executeSqlFile(migration);
      results.push(res);
      if (res.success) {
        successful++;
      } else {
        failed++;
        console.log('');
        console.log('[ABORT] Migration failed. Stopping execution.');
        break;
      }
    }

    this.printSummary(migrations.length, successful, failed);
    return {
      migrationsDir: this.migrationsDir,
      totalFiles: migrations.length,
      successful,
      failed,
      results,
      overallSuccess: failed === 0,
    };
  }

  async validateSchema(): Promise<boolean> {
    console.log('');
    console.log(LINE);
    console.log('DATABASE SCHEMA VALIDATION');
    console.log(LINE);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('');

    try {
      console.log('[1/4] Testing database connectivity...');
      const { error: connError } = await this.supabase.from('raw_props').select('id').limit(1);
      if (connError && !connError.message.includes('does not exist')) {
        console.log(`  [FAIL] Database connection: ${connError.message}`);
        return false;
      }
      console.log('  [OK] Database connection successful');

      console.log('[2/4] Checking critical tables...');
      const criticalTables = ['raw_props', 'unified_picks', 'bridge_outbox', 'cappers'];
      for (const table of criticalTables) {
        const { error } = await this.supabase.from(table).select('*').limit(1);
        if (error?.message.includes('does not exist')) {
          console.log(`  [FAIL] Table missing: ${table}`);
          return false;
        }
        console.log(`  [OK] Table exists: ${table}`);
      }

      console.log('[3/4] Checking migrations directory...');
      const migrations = this.sortMigrations(this.findSqlFiles(this.migrationsDir));
      console.log(`  [INFO] MIGRATIONS_DIR: ${this.migrationsDir}`);
      console.log(`  [INFO] Found ${migrations.length} migration files`);

      console.log('[4/4] Migration files:');
      migrations.forEach(m => console.log(`  [FILE] ${m.relativePath}`));

      console.log('');
      console.log(LINE);
      console.log('VALIDATION RESULT: PASS');
      console.log(LINE);
      return true;
    } catch (err) {
      console.log(`[ERROR] Validation failed: ${err instanceof Error ? err.message : err}`);
      console.log('');
      console.log(LINE);
      console.log('VALIDATION RESULT: FAIL');
      console.log(LINE);
      return false;
    }
  }

  async generateReport(): Promise<void> {
    console.log('');
    console.log('Generating migration report...');
    try {
      const tables = ['raw_props', 'unified_picks', 'bridge_outbox'];
      console.log('');
      console.log('TABLE STATISTICS:');
      for (const table of tables) {
        const { count } = await this.supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        console.log(`  ${table}: ${count ?? 'N/A'} rows`);
      }
    } catch (err) {
      console.log(`[WARN] Could not generate report: ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function main(): Promise<void> {
  try {
    const executor = new DatabaseMigrationExecutor();

    if (process.argv.includes('--validate-only')) {
      const valid = await executor.validateSchema();
      process.exit(valid ? 0 : 1);
    }

    const report = await executor.executeMigrations();
    await executor.generateReport();

    if (!report.overallSuccess) {
      console.log('');
      console.log('[FAIL] Migration execution failed. See errors above.');
      process.exit(1);
    }

    console.log('');
    console.log('[SUCCESS] All migrations executed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('');
    console.error('[FATAL]', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DatabaseMigrationExecutor };
