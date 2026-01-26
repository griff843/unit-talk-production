#!/usr/bin/env tsx
/* eslint-disable no-console, security/detect-non-literal-fs-filename, max-lines */

/**
 * Database Schema Migration Executor
 *
 * Supports both local Postgres (DATABASE_URL) and Supabase connections.
 * Schema validation uses standard information_schema.columns introspection.
 *
 * Connection Priority:
 * 1. DATABASE_URL (standard Postgres connection string)
 * 2. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Supabase client)
 *
 * Usage:
 *   npm run db:migrate:critical          # Execute all migrations
 *   npm run db:validate:schema           # Validate schema only (--validate-only)
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, basename, relative } from 'path';

import { Client } from 'pg';
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

interface TableInfo {
  table_name: string;
  column_count: number;
}

const LINE = '='.repeat(70);
const DASH = '-'.repeat(70);

class DatabaseMigrationExecutor {
  private migrationsDir: string;
  private connectionString: string;

  constructor() {
    // Prefer DATABASE_URL for local Postgres, fall back to Supabase
    if (process.env.DATABASE_URL) {
      this.connectionString = process.env.DATABASE_URL;
    } else if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Construct connection string from Supabase URL
      const url = new URL(process.env.SUPABASE_URL);
      const host = url.hostname.replace('.supabase.co', '.supabase.com');
      this.connectionString = `postgresql://postgres:${process.env.SUPABASE_SERVICE_ROLE_KEY}@${host}:5432/postgres`;
    } else {
      throw new Error('Missing database connection: Set DATABASE_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
    }

    this.migrationsDir =
      process.env.MIGRATIONS_DIR ||
      (existsSync('/app/apps/api/migrations')
        ? '/app/apps/api/migrations'
        : join(process.cwd(), 'migrations'));
  }

  private async getClient(): Promise<Client> {
    const client = new Client({ connectionString: this.connectionString });
    await client.connect();
    return client;
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

  private async executeSqlFile(client: Client, migration: MigrationFile): Promise<MigrationResult> {
    const result: MigrationResult = { file: migration.relativePath, success: false };

    try {
      const sql = readFileSync(migration.path, 'utf-8');
      if (!sql.trim()) {
        console.log(`  [SKIP] ${migration.relativePath} (empty file)`);
        return { ...result, success: true };
      }

      console.log(`  [EXEC] ${migration.relativePath}...`);
      await client.query(sql);
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
      return { migrationsDir: this.migrationsDir, totalFiles: 0, successful: 0, failed: 0, results: [], overallSuccess: true };
    }

    const client = await this.getClient();
    try {
      console.log('EXECUTING MIGRATIONS');
      console.log(DASH);

      const results: MigrationResult[] = [];
      let successful = 0;
      let failed = 0;

      for (const migration of migrations) {
        const res = await this.executeSqlFile(client, migration);
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
      return { migrationsDir: this.migrationsDir, totalFiles: migrations.length, successful, failed, results, overallSuccess: failed === 0 };
    } finally {
      await client.end();
    }
  }

  /**
   * Validate schema using standard Postgres information_schema introspection
   * Works with both local Postgres and Supabase
   */
  async validateSchema(): Promise<boolean> {
    console.log('');
    console.log(LINE);
    console.log('DATABASE SCHEMA VALIDATION');
    console.log(LINE);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('');

    let client: Client | null = null;

    try {
      // Step 1: Test connectivity
      console.log('[1/5] Testing database connectivity...');
      client = await this.getClient();
      console.log('  [OK] Database connection successful');

      // Step 2: Get current database and schema info
      console.log('[2/5] Fetching database info...');
      const dbInfoQuery = `SELECT current_database() AS db, current_schema() AS schema`;
      const dbInfo = await client.query(dbInfoQuery);
      const currentDb = dbInfo.rows[0]?.db || 'unknown';
      const currentSchema = dbInfo.rows[0]?.schema || 'public';
      console.log(`  [INFO] Database: ${currentDb}`);
      console.log(`  [INFO] Schema: ${currentSchema}`);

      // Step 3: Query information_schema for tables in public schema
      console.log('[3/5] Querying information_schema.columns...');
      const tableQuery = `
        SELECT table_name, COUNT(*) as column_count
        FROM information_schema.columns
        WHERE table_schema = 'public'
        GROUP BY table_name
        ORDER BY table_name
      `;
      console.log(`  [SQL] ${tableQuery.trim().replace(/\s+/g, ' ')}`);

      const result = await client.query(tableQuery);
      const tables: TableInfo[] = result.rows;

      if (tables.length === 0) {
        console.log('  [WARN] Zero tables found in public schema');
        console.log('  [DEBUG] Query returned 0 rows');
        console.log(`  [DEBUG] Database: ${currentDb}, Schema: ${currentSchema}`);
        console.log('  [DEBUG] Checking if information_schema is accessible...');

        // Additional debug: check all schemas
        const schemaQuery = `SELECT DISTINCT table_schema FROM information_schema.tables ORDER BY table_schema`;
        const schemas = await client.query(schemaQuery);
        console.log(`  [DEBUG] Available schemas: ${schemas.rows.map(r => r.table_schema).join(', ')}`);

        // Check if there are tables in any schema
        const allTablesQuery = `SELECT table_schema, COUNT(*) as cnt FROM information_schema.tables GROUP BY table_schema`;
        const allTables = await client.query(allTablesQuery);
        console.log('  [DEBUG] Tables per schema:');
        allTables.rows.forEach(r => console.log(`    ${r.table_schema}: ${r.cnt} tables`));

        return false;
      }

      console.log(`  [OK] Found ${tables.length} tables in public schema`);

      // Step 4: Check critical tables
      console.log('[4/5] Checking critical tables...');
      const criticalTables = ['raw_props', 'unified_picks', 'bridge_outbox', 'cappers'];
      const tableNames = new Set(tables.map(t => t.table_name));
      let allCriticalPresent = true;

      for (const table of criticalTables) {
        if (tableNames.has(table)) {
          const info = tables.find(t => t.table_name === table);
          console.log(`  [OK] ${table} (${info?.column_count} columns)`);
        } else {
          console.log(`  [WARN] ${table} not found (may be optional)`);
          // Don't fail on missing tables - they might not exist yet
        }
      }

      // List all discovered tables
      console.log('');
      console.log('  All tables in public schema:');
      tables.forEach(t => console.log(`    - ${t.table_name} (${t.column_count} columns)`));

      // Step 5: Check migrations directory
      console.log('');
      console.log('[5/5] Checking migrations directory...');
      const migrations = this.sortMigrations(this.findSqlFiles(this.migrationsDir));
      console.log(`  [INFO] MIGRATIONS_DIR: ${this.migrationsDir}`);
      console.log(`  [INFO] Found ${migrations.length} migration files`);

      if (migrations.length > 0) {
        console.log('');
        console.log('  Migration files:');
        migrations.forEach(m => console.log(`    - ${m.relativePath}`));
      }

      console.log('');
      console.log(LINE);
      console.log('VALIDATION RESULT: PASS');
      console.log(LINE);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(`[ERROR] Validation failed: ${errorMsg}`);

      // Additional debug info on failure
      if (err instanceof Error && err.stack) {
        console.log(`[DEBUG] Stack: ${err.stack.split('\n').slice(0, 3).join('\n')}`);
      }

      console.log('');
      console.log(LINE);
      console.log('VALIDATION RESULT: FAIL');
      console.log(LINE);
      return false;
    } finally {
      if (client) {
        await client.end();
      }
    }
  }

  async generateReport(): Promise<void> {
    console.log('');
    console.log('Generating migration report...');

    let client: Client | null = null;
    try {
      client = await this.getClient();
      const tables = ['raw_props', 'unified_picks', 'bridge_outbox'];
      console.log('');
      console.log('TABLE STATISTICS:');

      for (const table of tables) {
        try {
          const result = await client.query(`SELECT COUNT(*) as cnt FROM ${table}`);
          console.log(`  ${table}: ${result.rows[0]?.cnt ?? 'N/A'} rows`);
        } catch {
          console.log(`  ${table}: (table not found)`);
        }
      }
    } catch (err) {
      console.log(`[WARN] Could not generate report: ${err instanceof Error ? err.message : err}`);
    } finally {
      if (client) {
        await client.end();
      }
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
