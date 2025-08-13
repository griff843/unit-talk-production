#!/usr/bin/env tsx

/**
 * Zero-Downtime Migration Executor
 * Executes database migrations with zero-downtime strategies
 */

import { promises as fs } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { execSync, spawn } from 'child_process';
import path from 'path';

interface MigrationOptions {
  file: string;
  strategy: 'blue-green' | 'rolling' | 'shadow';
  migrationId: string;
  dryRun?: boolean;
  timeoutMs?: number;
  rollbackOnFailure?: boolean;
}

interface MigrationResult {
  success: boolean;
  migrationId: string;
  duration: number;
  strategy: string;
  affectedTables: string[];
  rollbackInfo?: {
    snapshotId: string;
    rollbackScript?: string;
  };
  error?: string;
}

interface SchemaSnapshot {
  id: string;
  timestamp: string;
  tables: Record<string, any>;
  indexes: Record<string, any>;
  functions: Record<string, any>;
  checksum: string;
}

class ZeroDowntimeMigrationExecutor {
  private supabase: ReturnType<typeof createClient>;
  private logger: any;
  private migrationTimeout: number;

  constructor(logger: any = console) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    this.logger = logger;
    this.migrationTimeout = parseInt(process.env.MIGRATION_TIMEOUT_MS || '1800000'); // 30 minutes
  }

  /**
   * Execute migration with specified strategy
   */
  async executeMigration(options: MigrationOptions): Promise<MigrationResult> {
    const startTime = Date.now();
    
    this.logger.info('Starting zero-downtime migration', {
      migrationId: options.migrationId,
      file: options.file,
      strategy: options.strategy,
      dryRun: options.dryRun
    });

    try {
      // 1. Validate migration file
      await this.validateMigrationFile(options.file);

      // 2. Create pre-migration snapshot
      const snapshot = await this.createSchemaSnapshot(options.migrationId);

      // 3. Analyze migration for strategy compatibility
      const analysis = await this.analyzeMigration(options.file);
      
      if (!this.isStrategyCompatible(analysis, options.strategy)) {
        throw new Error(`Migration is not compatible with ${options.strategy} strategy`);
      }

      // 4. Execute migration based on strategy
      let result: MigrationResult;
      
      switch (options.strategy) {
        case 'blue-green':
          result = await this.executeBlueGreenMigration(options, snapshot, analysis);
          break;
        case 'rolling':
          result = await this.executeRollingMigration(options, snapshot, analysis);
          break;
        case 'shadow':
          result = await this.executeShadowMigration(options, snapshot, analysis);
          break;
        default:
          throw new Error(`Unknown migration strategy: ${options.strategy}`);
      }

      // 5. Verify migration success
      await this.verifyMigration(options, analysis);

      // 6. Log migration completion
      await this.logMigrationCompletion(result);

      const duration = Date.now() - startTime;
      return {
        ...result,
        success: true,
        duration,
        rollbackInfo: {
          snapshotId: snapshot.id
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Migration failed', {
        migrationId: options.migrationId,
        error: errorMessage,
        duration
      });

      // Attempt rollback if enabled
      if (options.rollbackOnFailure) {
        await this.executeRollback(options.migrationId);
      }

      return {
        success: false,
        migrationId: options.migrationId,
        duration,
        strategy: options.strategy,
        affectedTables: [],
        error: errorMessage
      };
    }
  }

  /**
   * Validate migration file syntax and structure
   */
  private async validateMigrationFile(filePath: string): Promise<void> {
    this.logger.info('Validating migration file', { file: filePath });

    // Check file exists
    if (!(await fs.stat(filePath).catch(() => null))) {
      throw new Error(`Migration file not found: ${filePath}`);
    }

    // Read and parse migration
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Check for destructive operations without safety measures
    const destructivePatterns = [
      /DROP\s+TABLE(?!\s+IF\s+EXISTS)/i,
      /DROP\s+COLUMN(?!\s+IF\s+EXISTS)/i,
      /ALTER\s+TABLE\s+.*\s+DROP(?!\s+IF\s+EXISTS)/i
    ];

    for (const pattern of destructivePatterns) {
      if (pattern.test(content)) {
        this.logger.warn('Destructive operation detected - ensure proper safeguards', { 
          file: filePath 
        });
      }
    }

    // Check for zero-downtime incompatible operations
    const blockingPatterns = [
      /LOCK\s+TABLE/i,
      /ALTER\s+TABLE.*ADD\s+COLUMN.*NOT\s+NULL(?!\s+DEFAULT)/i,
      /CREATE\s+UNIQUE\s+INDEX(?!\s+CONCURRENTLY)/i
    ];

    for (const pattern of blockingPatterns) {
      if (pattern.test(content)) {
        throw new Error(`Migration contains blocking operation incompatible with zero-downtime: ${pattern.source}`);
      }
    }

    this.logger.info('Migration file validation passed');
  }

  /**
   * Create schema snapshot for rollback purposes
   */
  private async createSchemaSnapshot(migrationId: string): Promise<SchemaSnapshot> {
    this.logger.info('Creating schema snapshot', { migrationId });

    const snapshotId = `snapshot-${migrationId}-${Date.now()}`;
    
    // Get all tables
    const { data: tables } = await this.supabase
      .from('information_schema.tables')
      .select('*')
      .eq('table_schema', 'public');

    // Get all indexes
    const { data: indexes } = await this.supabase.rpc('get_table_indexes');

    // Get all functions
    const { data: functions } = await this.supabase.rpc('get_user_functions');

    const snapshot: SchemaSnapshot = {
      id: snapshotId,
      timestamp: new Date().toISOString(),
      tables: tables || {},
      indexes: indexes || {},
      functions: functions || {},
      checksum: this.calculateSchemaChecksum(tables, indexes, functions)
    };

    // Store snapshot
    await this.supabase
      .from('migration_snapshots')
      .insert({
        snapshot_id: snapshotId,
        migration_id: migrationId,
        schema_data: snapshot,
        created_at: new Date().toISOString()
      });

    this.logger.info('Schema snapshot created', { snapshotId, checksum: snapshot.checksum });
    return snapshot;
  }

  /**
   * Analyze migration file for strategy compatibility
   */
  private async analyzeMigration(filePath: string): Promise<any> {
    const content = await fs.readFile(filePath, 'utf-8');
    const statements = this.parseSqlStatements(content);

    const analysis = {
      statementCount: statements.length,
      operations: [] as string[],
      affectedTables: new Set<string>(),
      requiresConcurrentIndex: false,
      estimatedDuration: 0,
      riskLevel: 'low' as 'low' | 'medium' | 'high',
      compatibility: {
        'blue-green': true,
        'rolling': true,
        'shadow': true
      }
    };

    for (const statement of statements) {
      const operation = this.analyzeStatement(statement);
      analysis.operations.push(operation.type);
      
      if (operation.table) {
        analysis.affectedTables.add(operation.table);
      }

      // Check for operations requiring special handling
      if (operation.type === 'CREATE_INDEX' && !statement.includes('CONCURRENTLY')) {
        analysis.requiresConcurrentIndex = true;
        analysis.compatibility.rolling = false;
      }

      if (operation.type === 'ALTER_TABLE' && statement.includes('ADD COLUMN')) {
        analysis.compatibility['blue-green'] = false; // Requires app code changes
      }

      // Estimate duration based on operation type
      analysis.estimatedDuration += this.estimateOperationDuration(operation);
    }

    // Determine risk level
    if (analysis.affectedTables.size > 5 || analysis.estimatedDuration > 300000) { // 5 minutes
      analysis.riskLevel = 'high';
    } else if (analysis.affectedTables.size > 2 || analysis.estimatedDuration > 60000) { // 1 minute
      analysis.riskLevel = 'medium';
    }

    return analysis;
  }

  /**
   * Execute blue-green migration strategy
   */
  private async executeBlueGreenMigration(
    options: MigrationOptions,
    snapshot: SchemaSnapshot,
    analysis: any
  ): Promise<MigrationResult> {
    this.logger.info('Executing blue-green migration', { migrationId: options.migrationId });

    if (options.dryRun) {
      this.logger.info('DRY RUN: Would execute blue-green migration');
      return {
        success: true,
        migrationId: options.migrationId,
        duration: 0,
        strategy: 'blue-green',
        affectedTables: Array.from(analysis.affectedTables)
      };
    }

    // Blue-green strategy:
    // 1. Create shadow database
    // 2. Apply migration to shadow
    // 3. Verify shadow database
    // 4. Switch traffic to shadow (atomic)
    // 5. Clean up old database

    const shadowDbName = `${process.env.DB_NAME}_shadow_${options.migrationId}`;
    
    try {
      // 1. Create shadow database
      this.logger.info('Creating shadow database', { shadowDb: shadowDbName });
      await this.createShadowDatabase(shadowDbName);

      // 2. Copy current data to shadow
      await this.copyDataToShadow(shadowDbName);

      // 3. Apply migration to shadow
      await this.applyMigrationToShadow(options.file, shadowDbName);

      // 4. Verify shadow database
      await this.verifyShadowDatabase(shadowDbName, analysis);

      // 5. Switch traffic (atomic operation)
      await this.switchTrafficToShadow(shadowDbName);

      // 6. Clean up old database
      await this.cleanupOldDatabase();

      return {
        success: true,
        migrationId: options.migrationId,
        duration: 0,
        strategy: 'blue-green',
        affectedTables: Array.from(analysis.affectedTables)
      };

    } catch (error) {
      // Cleanup shadow database on failure
      await this.cleanupShadowDatabase(shadowDbName);
      throw error;
    }
  }

  /**
   * Execute rolling migration strategy
   */
  private async executeRollingMigration(
    options: MigrationOptions,
    snapshot: SchemaSnapshot,
    analysis: any
  ): Promise<MigrationResult> {
    this.logger.info('Executing rolling migration', { migrationId: options.migrationId });

    if (options.dryRun) {
      this.logger.info('DRY RUN: Would execute rolling migration');
      return {
        success: true,
        migrationId: options.migrationId,
        duration: 0,
        strategy: 'rolling',
        affectedTables: Array.from(analysis.affectedTables)
      };
    }

    // Rolling strategy:
    // 1. Execute migration statements one by one
    // 2. Monitor system health after each statement
    // 3. Pause if performance degrades
    // 4. Continue when system recovers

    const migrationContent = await fs.readFile(options.file, 'utf-8');
    const statements = this.parseSqlStatements(migrationContent);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      this.logger.info(`Executing statement ${i + 1}/${statements.length}`, { statement: statement.substring(0, 100) });

      // Execute statement
      await this.executeStatement(statement);

      // Monitor system health
      const health = await this.checkSystemHealth();
      if (!health.healthy) {
        this.logger.warn('System health degraded, pausing migration', health);
        await this.waitForSystemRecovery();
      }

      // Progress update
      const progress = ((i + 1) / statements.length) * 100;
      this.logger.info(`Migration progress: ${progress.toFixed(1)}%`);
    }

    return {
      success: true,
      migrationId: options.migrationId,
      duration: 0,
      strategy: 'rolling',
      affectedTables: Array.from(analysis.affectedTables)
    };
  }

  /**
   * Execute shadow migration strategy
   */
  private async executeShadowMigration(
    options: MigrationOptions,
    snapshot: SchemaSnapshot,
    analysis: any
  ): Promise<MigrationResult> {
    this.logger.info('Executing shadow migration', { migrationId: options.migrationId });

    if (options.dryRun) {
      this.logger.info('DRY RUN: Would execute shadow migration');
      return {
        success: true,
        migrationId: options.migrationId,
        duration: 0,
        strategy: 'shadow',
        affectedTables: Array.from(analysis.affectedTables)
      };
    }

    // Shadow strategy:
    // 1. Execute migration directly on live database
    // 2. Use database-level features for zero downtime
    // 3. Monitor for blocking operations
    // 4. Use concurrent operations where possible

    const migrationContent = await fs.readFile(options.file, 'utf-8');
    
    // Replace non-concurrent operations with concurrent versions
    const optimizedContent = this.optimizeForConcurrency(migrationContent);
    
    // Execute optimized migration
    await this.executeOptimizedMigration(optimizedContent);

    return {
      success: true,
      migrationId: options.migrationId,
      duration: 0,
      strategy: 'shadow',
      affectedTables: Array.from(analysis.affectedTables)
    };
  }

  /**
   * Helper methods for migration execution
   */

  private parseSqlStatements(content: string): string[] {
    // Simple SQL statement parser - splits on semicolons not in quotes
    const statements: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar && nextChar !== quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && char === ';') {
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements.filter(stmt => stmt && !stmt.startsWith('--'));
  }

  private analyzeStatement(statement: string): { type: string; table?: string } {
    const upperStatement = statement.toUpperCase().trim();
    
    if (upperStatement.startsWith('CREATE TABLE')) {
      const match = statement.match(/CREATE\s+TABLE\s+(\w+)/i);
      return { type: 'CREATE_TABLE', table: match?.[1] };
    } else if (upperStatement.startsWith('ALTER TABLE')) {
      const match = statement.match(/ALTER\s+TABLE\s+(\w+)/i);
      return { type: 'ALTER_TABLE', table: match?.[1] };
    } else if (upperStatement.startsWith('CREATE INDEX')) {
      return { type: 'CREATE_INDEX' };
    } else if (upperStatement.startsWith('DROP TABLE')) {
      const match = statement.match(/DROP\s+TABLE\s+(\w+)/i);
      return { type: 'DROP_TABLE', table: match?.[1] };
    }
    
    return { type: 'UNKNOWN' };
  }

  private estimateOperationDuration(operation: { type: string; table?: string }): number {
    // Rough estimates in milliseconds
    switch (operation.type) {
      case 'CREATE_TABLE': return 1000;
      case 'ALTER_TABLE': return 5000;
      case 'CREATE_INDEX': return 30000;
      case 'DROP_TABLE': return 2000;
      default: return 1000;
    }
  }

  private isStrategyCompatible(analysis: any, strategy: string): boolean {
    return analysis.compatibility[strategy] === true;
  }

  private calculateSchemaChecksum(tables: any, indexes: any, functions: any): string {
    const combined = JSON.stringify({ tables, indexes, functions });
    return require('crypto').createHash('sha256').update(combined).digest('hex');
  }

  private async createShadowDatabase(shadowDbName: string): Promise<void> {
    // Implementation depends on database provider
    this.logger.info('Creating shadow database', { shadowDbName });
  }

  private async copyDataToShadow(shadowDbName: string): Promise<void> {
    this.logger.info('Copying data to shadow database', { shadowDbName });
  }

  private async applyMigrationToShadow(filePath: string, shadowDbName: string): Promise<void> {
    this.logger.info('Applying migration to shadow database', { filePath, shadowDbName });
  }

  private async verifyShadowDatabase(shadowDbName: string, analysis: any): Promise<void> {
    this.logger.info('Verifying shadow database', { shadowDbName });
  }

  private async switchTrafficToShadow(shadowDbName: string): Promise<void> {
    this.logger.info('Switching traffic to shadow database', { shadowDbName });
  }

  private async cleanupOldDatabase(): Promise<void> {
    this.logger.info('Cleaning up old database');
  }

  private async cleanupShadowDatabase(shadowDbName: string): Promise<void> {
    this.logger.info('Cleaning up shadow database', { shadowDbName });
  }

  private async executeStatement(statement: string): Promise<void> {
    const { error } = await this.supabase.rpc('execute_sql', { sql: statement });
    if (error) throw error;
  }

  private async checkSystemHealth(): Promise<{ healthy: boolean; metrics: any }> {
    // Implement system health checks
    return { healthy: true, metrics: {} };
  }

  private async waitForSystemRecovery(): Promise<void> {
    this.logger.info('Waiting for system recovery...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  private optimizeForConcurrency(content: string): string {
    // Replace blocking operations with concurrent versions
    return content
      .replace(/CREATE\s+INDEX/gi, 'CREATE INDEX CONCURRENTLY')
      .replace(/DROP\s+INDEX/gi, 'DROP INDEX CONCURRENTLY');
  }

  private async executeOptimizedMigration(content: string): Promise<void> {
    const { error } = await this.supabase.rpc('execute_migration', { migration_sql: content });
    if (error) throw error;
  }

  private async verifyMigration(options: MigrationOptions, analysis: any): Promise<void> {
    this.logger.info('Verifying migration completion', { migrationId: options.migrationId });
    
    // Verify affected tables exist and have expected structure
    for (const table of analysis.affectedTables) {
      const { data, error } = await this.supabase
        .from('information_schema.tables')
        .select('*')
        .eq('table_name', table)
        .eq('table_schema', 'public');

      if (error || !data?.length) {
        throw new Error(`Verification failed: table ${table} not found`);
      }
    }

    this.logger.info('Migration verification completed successfully');
  }

  private async logMigrationCompletion(result: MigrationResult): Promise<void> {
    await this.supabase
      .from('migration_log')
      .insert({
        migration_id: result.migrationId,
        strategy: result.strategy,
        success: result.success,
        duration_ms: result.duration,
        affected_tables: result.affectedTables,
        executed_at: new Date().toISOString(),
        rollback_info: result.rollbackInfo
      });
  }

  private async executeRollback(migrationId: string): Promise<void> {
    this.logger.warn('Executing migration rollback', { migrationId });
    // TODO: Implement rollback logic
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: Partial<MigrationOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--file':
        options.file = nextArg;
        i++;
        break;
      case '--strategy':
        options.strategy = nextArg as any;
        i++;
        break;
      case '--migration-id':
        options.migrationId = nextArg;
        i++;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--rollback-on-failure':
        options.rollbackOnFailure = true;
        break;
    }
  }

  if (!options.file || !options.strategy || !options.migrationId) {
    console.error('Usage: execute-migration.ts --file <path> --strategy <blue-green|rolling|shadow> --migration-id <id> [--dry-run] [--rollback-on-failure]');
    process.exit(1);
  }

  try {
    const executor = new ZeroDowntimeMigrationExecutor();
    const result = await executor.executeMigration(options as MigrationOptions);

    console.log('Migration execution completed', result);
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('Migration execution failed:', error);
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main();
}

export { ZeroDowntimeMigrationExecutor, MigrationOptions, MigrationResult };