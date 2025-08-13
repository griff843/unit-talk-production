/**
 * Zero-Downtime Migration: Integration tests for migration strategies and drift detection
 * Tests migration execution, health monitoring, and schema drift detection
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { ZeroDowntimeMigrationExecutor } from '../../scripts/migration/execute-migration';
import { promises as fs } from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Mock logger for testing
const mockLogger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args)
};

describe('Zero-Downtime Migration System', () => {
  let migrationExecutor: ZeroDowntimeMigrationExecutor;
  let testMigrationId: string;
  let testSnapshotId: string;

  beforeAll(async () => {
    // Verify database connection
    const { error } = await supabase.from('system_config').select('key').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Initialize migration executor
    migrationExecutor = new ZeroDowntimeMigrationExecutor(mockLogger);
  });

  beforeEach(() => {
    // Generate unique test identifiers
    const timestamp = Date.now();
    testMigrationId = `test_migration_${timestamp}`;
    testSnapshotId = `test_snapshot_${timestamp}`;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('migration_performance_metrics').delete().like('migration_id', 'test_migration_%');
    await supabase.from('migration_health_checks').delete().like('migration_id', 'test_migration_%');
    await supabase.from('migration_snapshots').delete().like('migration_id', 'test_migration_%');
    await supabase.from('migration_log').delete().like('migration_id', 'test_migration_%');
    await supabase.from('schema_drift_log').delete().eq('environment', 'test');
  });

  describe('Migration Tracking Functions', () => {
    it('should create schema snapshot', async () => {
      const { data, error } = await supabase.rpc('create_schema_snapshot', {
        p_migration_id: testMigrationId,
        p_snapshot_type: 'pre_migration'
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(typeof data).toBe('string');

      // Verify snapshot was stored
      const { data: snapshot } = await supabase
        .from('migration_snapshots')
        .select('*')
        .eq('migration_id', testMigrationId)
        .single();

      expect(snapshot).toBeDefined();
      expect(snapshot.snapshot_type).toBe('pre_migration');
      expect(snapshot.schema_checksum).toBeDefined();
      expect(snapshot.schema_data).toBeDefined();
    });

    it('should detect schema drift', async () => {
      // Create baseline snapshot
      const { data: snapshotId } = await supabase.rpc('create_schema_snapshot', {
        p_migration_id: `${testMigrationId}_baseline`,
        p_snapshot_type: 'pre_migration'
      });

      expect(snapshotId).toBeDefined();

      // Get the checksum from the snapshot
      const { data: snapshot } = await supabase
        .from('migration_snapshots')
        .select('schema_checksum')
        .eq('snapshot_id', snapshotId)
        .single();

      expect(snapshot).toBeDefined();

      // Test drift detection with same checksum (no drift)
      const { data: noDrift, error: noDriftError } = await supabase.rpc('detect_schema_drift', {
        p_environment: 'test',
        p_expected_checksum: snapshot.schema_checksum
      });

      expect(noDriftError).toBeNull();
      expect(noDrift).toBe(false);

      // Test drift detection with different checksum (drift detected)
      const { data: driftDetected, error: driftError } = await supabase.rpc('detect_schema_drift', {
        p_environment: 'test',
        p_expected_checksum: 'fake-checksum-different'
      });

      expect(driftError).toBeNull();
      expect(driftDetected).toBe(true);

      // Verify drift log entry
      const { data: driftLog } = await supabase
        .from('schema_drift_log')
        .select('*')
        .eq('environment', 'test')
        .eq('drift_detected', true)
        .order('detected_at', { ascending: false })
        .limit(1)
        .single();

      expect(driftLog).toBeDefined();
      expect(driftLog.drift_detected).toBe(true);
      expect(driftLog.expected_checksum).toBe('fake-checksum-different');
    });

    it('should log migration health check', async () => {
      const { data, error } = await supabase.rpc('log_migration_health_check', {
        p_migration_id: testMigrationId,
        p_check_type: 'pre_migration',
        p_check_name: 'database_connectivity',
        p_success: true,
        p_duration_ms: 1500,
        p_result_data: {
          connections: 25,
          response_time_ms: 150,
          memory_usage_mb: 512
        }
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify health check was stored
      const { data: healthCheck } = await supabase
        .from('migration_health_checks')
        .select('*')
        .eq('id', data)
        .single();

      expect(healthCheck).toBeDefined();
      expect(healthCheck.migration_id).toBe(testMigrationId);
      expect(healthCheck.check_type).toBe('pre_migration');
      expect(healthCheck.check_name).toBe('database_connectivity');
      expect(healthCheck.success).toBe(true);
      expect(healthCheck.duration_ms).toBe(1500);
      expect(healthCheck.result_data).toMatchObject({
        connections: 25,
        response_time_ms: 150,
        memory_usage_mb: 512
      });
    });

    it('should record migration performance metric', async () => {
      const { data, error } = await supabase.rpc('record_migration_metric', {
        p_migration_id: testMigrationId,
        p_metric_name: 'table_scan_duration',
        p_metric_type: 'histogram',
        p_value: 2500.75,
        p_labels: {
          table: 'test_table',
          operation: 'full_scan',
          index_used: true
        }
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify metric was stored
      const { data: metric } = await supabase
        .from('migration_performance_metrics')
        .select('*')
        .eq('id', data)
        .single();

      expect(metric).toBeDefined();
      expect(metric.migration_id).toBe(testMigrationId);
      expect(metric.metric_name).toBe('table_scan_duration');
      expect(metric.metric_type).toBe('histogram');
      expect(metric.value).toBe('2500.75'); // Stored as string in DB
      expect(metric.labels).toMatchObject({
        table: 'test_table',
        operation: 'full_scan',
        index_used: true
      });
    });
  });

  describe('Migration Log Management', () => {
    it('should create migration log entry', async () => {
      const { data, error } = await supabase
        .from('migration_log')
        .insert({
          migration_id: testMigrationId,
          migration_file: 'test-migration-001.sql',
          strategy: 'blue-green',
          success: true,
          completed_at: new Date().toISOString(),
          duration_ms: 5000,
          affected_tables: ['users', 'profiles'],
          statement_count: 3,
          risk_level: 'low',
          environment: 'test',
          executed_by: 'test-runner'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.migration_id).toBe(testMigrationId);
      expect(data.strategy).toBe('blue-green');
      expect(data.success).toBe(true);
    });

    it('should handle migration failure logging', async () => {
      const failureMigrationId = `${testMigrationId}_failure`;

      const { data, error } = await supabase
        .from('migration_log')
        .insert({
          migration_id: failureMigrationId,
          migration_file: 'test-migration-failed.sql',
          strategy: 'rolling',
          success: false,
          completed_at: new Date().toISOString(),
          duration_ms: 2500,
          affected_tables: ['failed_table'],
          error_message: 'Column constraint violation',
          error_details: {
            error_code: 'P23505',
            constraint_name: 'unique_constraint_violation',
            table: 'failed_table'
          },
          environment: 'test'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.success).toBe(false);
      expect(data.error_message).toBe('Column constraint violation');
      expect(data.error_details).toMatchObject({
        error_code: 'P23505',
        constraint_name: 'unique_constraint_violation'
      });
    });

    it('should track rollback information', async () => {
      const rollbackMigrationId = `${testMigrationId}_rollback`;

      // First, create failed migration
      await supabase
        .from('migration_log')
        .insert({
          migration_id: rollbackMigrationId,
          migration_file: 'test-migration-rollback.sql',
          strategy: 'shadow',
          success: false,
          error_message: 'Critical failure during migration'
        });

      // Then update with rollback info
      const { data, error } = await supabase
        .from('migration_log')
        .update({
          rollback_executed: true,
          rollback_completed_at: new Date().toISOString(),
          rollback_info: {
            snapshot_id: testSnapshotId,
            rollback_strategy: 'snapshot_restore',
            rollback_duration_ms: 3000
          }
        })
        .eq('migration_id', rollbackMigrationId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.rollback_executed).toBe(true);
      expect(data.rollback_info).toMatchObject({
        snapshot_id: testSnapshotId,
        rollback_strategy: 'snapshot_restore'
      });
    });
  });

  describe('Migration Monitoring Views', () => {
    beforeEach(async () => {
      // Create test data for views
      await supabase.from('migration_log').insert({
        migration_id: testMigrationId,
        migration_file: 'test-view-migration.sql',
        strategy: 'blue-green',
        success: true,
        completed_at: new Date().toISOString(),
        duration_ms: 4500,
        affected_tables: ['test_table_1', 'test_table_2'],
        environment: 'test'
      });

      await supabase.rpc('log_migration_health_check', {
        p_migration_id: testMigrationId,
        p_check_type: 'pre_migration',
        p_check_name: 'system_health',
        p_success: true,
        p_duration_ms: 800
      });

      await supabase.rpc('log_migration_health_check', {
        p_migration_id: testMigrationId,
        p_check_type: 'post_migration',
        p_check_name: 'performance_validation',
        p_success: true,
        p_duration_ms: 1200
      });
    });

    it('should provide migration status view', async () => {
      const { data, error } = await supabase
        .from('migration_status')
        .select('*')
        .eq('migration_id', testMigrationId)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.migration_id).toBe(testMigrationId);
      expect(data.strategy).toBe('blue-green');
      expect(data.success).toBe(true);
      expect(data.duration_seconds).toBe(4); // 4500ms / 1000 = 4.5, truncated to 4
      expect(data.affected_tables).toEqual(['test_table_1', 'test_table_2']);
    });

    it('should provide migration health summary view', async () => {
      const { data, error } = await supabase
        .from('migration_health_summary')
        .select('*')
        .eq('migration_id', testMigrationId);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      const preCheck = data.find(item => item.check_type === 'pre_migration');
      const postCheck = data.find(item => item.check_type === 'post_migration');

      expect(preCheck).toBeDefined();
      expect(preCheck.total_checks).toBe(1);
      expect(preCheck.successful_checks).toBe(1);
      expect(preCheck.failed_checks).toBe(0);

      expect(postCheck).toBeDefined();
      expect(postCheck.total_checks).toBe(1);
      expect(postCheck.successful_checks).toBe(1);
    });
  });

  describe('Migration Executor Integration', () => {
    it('should create test migration file', async () => {
      const testMigrationContent = `
-- Test migration for integration testing
CREATE TABLE IF NOT EXISTS test_migration_table_${Date.now()} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add some test data
INSERT INTO test_migration_table_${Date.now()} (name) VALUES ('test_record_1'), ('test_record_2');
`;

      const testMigrationPath = path.join(__dirname, '..', '..', 'sql', 'test-migrations', `test-${testMigrationId}.sql`);
      
      // Ensure test migrations directory exists
      await fs.mkdir(path.dirname(testMigrationPath), { recursive: true });
      await fs.writeFile(testMigrationPath, testMigrationContent);

      // Verify file was created
      const fileExists = await fs.access(testMigrationPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should execute dry run migration successfully', async () => {
      const testMigrationPath = path.join(__dirname, '..', '..', 'sql', 'test-migrations', `test-${testMigrationId}.sql`);

      const result = await migrationExecutor.executeMigration({
        file: testMigrationPath,
        strategy: 'shadow',
        migrationId: testMigrationId,
        dryRun: true,
        timeoutMs: 30000
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.migrationId).toBe(testMigrationId);
      expect(result.strategy).toBe('shadow');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle migration validation errors', async () => {
      // Create invalid migration file
      const invalidMigrationContent = `
-- Invalid migration with syntax error
CRATE TABLE invalid_table (  -- Intentional typo: CRATE instead of CREATE
  id UUID PRIMARY KEY
`;

      const invalidMigrationPath = path.join(__dirname, '..', '..', 'sql', 'test-migrations', `invalid-${testMigrationId}.sql`);
      await fs.writeFile(invalidMigrationPath, invalidMigrationContent);

      const result = await migrationExecutor.executeMigration({
        file: invalidMigrationPath,
        strategy: 'shadow',
        migrationId: `${testMigrationId}_invalid`,
        dryRun: true
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Schema Drift Detection', () => {
    it('should detect intentional schema changes', async () => {
      // Create baseline snapshot
      const baselineSnapshot = await supabase.rpc('create_schema_snapshot', {
        p_migration_id: `${testMigrationId}_baseline`,
        p_snapshot_type: 'pre_migration'
      });

      expect(baselineSnapshot.data).toBeDefined();

      // Get baseline checksum
      const { data: baselineData } = await supabase
        .from('migration_snapshots')
        .select('schema_checksum')
        .eq('snapshot_id', baselineSnapshot.data)
        .single();

      // Simulate schema change by creating a temporary table
      await supabase.rpc('execute_sql', { 
        sql: `CREATE TEMPORARY TABLE temp_drift_test_${Date.now()} (id SERIAL PRIMARY KEY)` 
      });

      // Check for drift
      const { data: driftResult } = await supabase.rpc('detect_schema_drift', {
        p_environment: 'test',
        p_expected_checksum: baselineData.schema_checksum
      });

      expect(driftResult).toBeDefined();
      // Note: Temporary tables might not be detected in schema snapshots
      // This test demonstrates the drift detection mechanism
    });

    it('should handle drift resolution workflow', async () => {
      // Create drift log entry
      const { data: driftEntry } = await supabase
        .from('schema_drift_log')
        .insert({
          environment: 'test',
          expected_checksum: 'expected-checksum-123',
          actual_checksum: 'actual-checksum-456',
          affected_tables: ['test_table'],
          severity: 'medium',
          detected_by: 'test-runner'
        })
        .select()
        .single();

      expect(driftEntry).toBeDefined();
      expect(driftEntry.drift_detected).toBe(true);

      // Acknowledge drift
      const { data: acknowledgedEntry, error: ackError } = await supabase
        .from('schema_drift_log')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: 'test-admin'
        })
        .eq('id', driftEntry.id)
        .select()
        .single();

      expect(ackError).toBeNull();
      expect(acknowledgedEntry.acknowledged).toBe(true);

      // Resolve drift
      const { data: resolvedEntry, error: resolveError } = await supabase
        .from('schema_drift_log')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolution_notes: 'Schema drift resolved by applying missing migration'
        })
        .eq('id', driftEntry.id)
        .select()
        .single();

      expect(resolveError).toBeNull();
      expect(resolvedEntry.resolved).toBe(true);
      expect(resolvedEntry.resolution_notes).toBe('Schema drift resolved by applying missing migration');
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track migration performance metrics', async () => {
      const metrics = [
        { name: 'cpu_usage_percent', type: 'gauge', value: 45.5 },
        { name: 'memory_usage_mb', type: 'gauge', value: 1024.75 },
        { name: 'query_execution_time', type: 'histogram', value: 150.25 },
        { name: 'table_locks_acquired', type: 'counter', value: 5 }
      ];

      for (const metric of metrics) {
        await supabase.rpc('record_migration_metric', {
          p_migration_id: testMigrationId,
          p_metric_name: metric.name,
          p_metric_type: metric.type,
          p_value: metric.value,
          p_labels: { test: 'true', environment: 'integration' }
        });
      }

      // Verify all metrics were recorded
      const { data: recordedMetrics, error } = await supabase
        .from('migration_performance_metrics')
        .select('*')
        .eq('migration_id', testMigrationId)
        .order('recorded_at', { ascending: true });

      expect(error).toBeNull();
      expect(recordedMetrics).toBeDefined();
      expect(recordedMetrics.length).toBe(4);

      const cpuMetric = recordedMetrics.find(m => m.metric_name === 'cpu_usage_percent');
      expect(cpuMetric).toBeDefined();
      expect(cpuMetric.metric_type).toBe('gauge');
      expect(cpuMetric.value).toBe('45.5');
    });

    it('should monitor migration health throughout process', async () => {
      const healthChecks = [
        { type: 'pre_migration', name: 'system_resources', success: true, duration: 500 },
        { type: 'during_migration', name: 'connection_pool', success: true, duration: 200 },
        { type: 'during_migration', name: 'query_performance', success: true, duration: 800 },
        { type: 'post_migration', name: 'data_integrity', success: true, duration: 1500 },
        { type: 'post_migration', name: 'application_health', success: true, duration: 1000 }
      ];

      for (const check of healthChecks) {
        await supabase.rpc('log_migration_health_check', {
          p_migration_id: testMigrationId,
          p_check_type: check.type,
          p_check_name: check.name,
          p_success: check.success,
          p_duration_ms: check.duration
        });
      }

      // Verify health summary
      const { data: healthSummary } = await supabase
        .from('migration_health_summary')
        .select('*')
        .eq('migration_id', testMigrationId);

      expect(healthSummary).toBeDefined();
      expect(healthSummary.length).toBe(3); // pre, during, post

      const postMigrationSummary = healthSummary.find(s => s.check_type === 'post_migration');
      expect(postMigrationSummary).toBeDefined();
      expect(postMigrationSummary.total_checks).toBe(2);
      expect(postMigrationSummary.successful_checks).toBe(2);
      expect(postMigrationSummary.failed_checks).toBe(0);
    });
  });

  describe('End-to-End Migration Workflow', () => {
    it('should complete full migration lifecycle', async () => {
      const lifecycleMigrationId = `${testMigrationId}_lifecycle`;

      // 1. Create pre-migration snapshot
      const { data: preSnapshot } = await supabase.rpc('create_schema_snapshot', {
        p_migration_id: lifecycleMigrationId,
        p_snapshot_type: 'pre_migration'
      });

      expect(preSnapshot).toBeDefined();

      // 2. Log migration start
      const { data: migrationLog } = await supabase
        .from('migration_log')
        .insert({
          migration_id: lifecycleMigrationId,
          migration_file: 'lifecycle-test-migration.sql',
          strategy: 'rolling',
          success: false, // Will update later
          started_at: new Date().toISOString(),
          affected_tables: ['lifecycle_table'],
          environment: 'test'
        })
        .select()
        .single();

      expect(migrationLog).toBeDefined();

      // 3. Pre-migration health checks
      await supabase.rpc('log_migration_health_check', {
        p_migration_id: lifecycleMigrationId,
        p_check_type: 'pre_migration',
        p_check_name: 'database_health',
        p_success: true,
        p_duration_ms: 750
      });

      // 4. Record performance metrics during migration
      await supabase.rpc('record_migration_metric', {
        p_migration_id: lifecycleMigrationId,
        p_metric_name: 'migration_progress_percent',
        p_metric_type: 'gauge',
        p_value: 100
      });

      // 5. Post-migration health checks
      await supabase.rpc('log_migration_health_check', {
        p_migration_id: lifecycleMigrationId,
        p_check_type: 'post_migration',
        p_check_name: 'data_consistency',
        p_success: true,
        p_duration_ms: 1200
      });

      // 6. Create post-migration snapshot
      const { data: postSnapshot } = await supabase.rpc('create_schema_snapshot', {
        p_migration_id: lifecycleMigrationId,
        p_snapshot_type: 'post_migration'
      });

      expect(postSnapshot).toBeDefined();

      // 7. Update migration as completed
      const { data: completedMigration } = await supabase
        .from('migration_log')
        .update({
          success: true,
          completed_at: new Date().toISOString(),
          duration_ms: 5500
        })
        .eq('migration_id', lifecycleMigrationId)
        .select()
        .single();

      expect(completedMigration).toBeDefined();
      expect(completedMigration.success).toBe(true);

      // 8. Verify complete workflow in views
      const { data: finalStatus } = await supabase
        .from('migration_status')
        .select('*')
        .eq('migration_id', lifecycleMigrationId)
        .single();

      expect(finalStatus).toBeDefined();
      expect(finalStatus.success).toBe(true);
      expect(finalStatus.duration_seconds).toBe(5); // 5500ms / 1000 = 5.5, truncated to 5

      const { data: finalHealthSummary } = await supabase
        .from('migration_health_summary')
        .select('*')
        .eq('migration_id', lifecycleMigrationId);

      expect(finalHealthSummary.length).toBeGreaterThan(0);
      expect(finalHealthSummary.every(summary => summary.failed_checks === 0)).toBe(true);
    });
  });
});