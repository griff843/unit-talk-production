#!/usr/bin/env node
/**
 * Apply PostgREST Reload RPC Migration
 * Date: 2025-10-29
 * Purpose: Apply 20251029_pgrst_reload_rpc.sql migration and verify
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('POSTGREST RELOAD RPC MIGRATION');
  console.log('Date: 2025-10-29');
  console.log('Charter: v3.0 | Spec: v3.0');
  console.log('='.repeat(80));
  console.log('');

  // Load migration SQL
  const migrationPath = path.join(__dirname, '../../supabase/migrations/20251029_pgrst_reload_rpc.sql');
  
  if (!fs.existsSync(migrationPath)) {
    log.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  log.info(`Migration file loaded (${migrationSQL.length} bytes)`);

  // Mask DATABASE_DIRECT_URL for security
  const dbUrl = process.env.DATABASE_DIRECT_URL;
  if (!dbUrl) {
    log.error('DATABASE_DIRECT_URL not set in environment');
    process.exit(1);
  }
  
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
  log.info(`Database URL: ${maskedUrl}`);

  // Connect to database
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    log.info('Connecting to database...');
    await client.connect();
    log.success('Connected to database');

    // Get current database info
    const dbInfo = await client.query(`
      SELECT current_database() as database, current_user as "user"
    `);
    log.info(`Database: ${dbInfo.rows[0].database}, User: ${dbInfo.rows[0].user}`);

    // Check if RPC already exists
    log.info('Checking if pgrst_reload RPC already exists...');
    const preCheck = await client.query(`
      SELECT 
        EXISTS (
          SELECT 1 FROM pg_proc 
          WHERE proname = 'pgrst_reload' 
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        ) as rpc_exists,
        EXISTS (
          SELECT 1 FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename = 'schema_reload_log'
        ) as log_table_exists
    `);
    
    const { rpc_exists, log_table_exists } = preCheck.rows[0];
    log.info(`Before migration - pgrst_reload RPC: ${rpc_exists ? 'EXISTS' : 'NOT FOUND'}, schema_reload_log table: ${log_table_exists ? 'EXISTS' : 'NOT FOUND'}`);

    if (rpc_exists && log_table_exists) {
      log.warn('Migration already applied - RPC and log table exist');
      log.info('Skipping migration application (idempotent)');
    } else {
      // Apply migration
      log.info('Applying migration...');
      await client.query(migrationSQL);
      log.success('Migration applied successfully');
    }

    // Verify RPC exists and is callable
    log.info('Verifying RPC function...');
    const postCheck = await client.query(`
      SELECT 
        p.proname,
        pg_get_function_identity_arguments(p.oid) as args,
        p.prosecdef as is_security_definer,
        array_agg(DISTINCT pr.rolname) as granted_to
      FROM pg_proc p
      LEFT JOIN pg_proc_acl pa ON p.oid = pa.oid
      LEFT JOIN pg_roles pr ON pa.grantee = pr.oid
      WHERE p.proname = 'pgrst_reload'
      AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      GROUP BY p.oid, p.proname, p.prosecdef
    `);

    if (postCheck.rows.length === 0) {
      log.error('RPC function not found after migration');
      process.exit(1);
    }

    const rpcInfo = postCheck.rows[0];
    log.success(`RPC function verified: ${rpcInfo.proname}(${rpcInfo.args})`);
    log.info(`Security Definer: ${rpcInfo.is_security_definer}`);
    log.info(`Granted to: ${rpcInfo.granted_to ? rpcInfo.granted_to.join(', ') : 'N/A'}`);

    // Test RPC execution
    log.info('Testing RPC execution...');
    const testResult = await client.query(`
      SELECT * FROM public.pgrst_reload('apply-rpc-migration-script', 'post-migration verification test')
    `);

    if (testResult.rows.length > 0 && testResult.rows[0].success) {
      log.success(`RPC test passed: reload_id=${testResult.rows[0].reload_id}`);
      log.info(`Reloaded at: ${testResult.rows[0].reloaded_at}`);
    } else {
      log.error('RPC test failed - no success result returned');
      process.exit(1);
    }

    // Check reload log
    log.info('Checking schema_reload_log...');
    const logCheck = await client.query(`
      SELECT COUNT(*) as total_reloads,
             SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_reloads,
             MAX(reloaded_at) as last_reload
      FROM public.schema_reload_log
    `);

    const logStats = logCheck.rows[0];
    log.info(`Total reloads: ${logStats.total_reloads}, Successful: ${logStats.successful_reloads}, Last: ${logStats.last_reload}`);

    // Clean up test entry
    await client.query(`
      DELETE FROM public.schema_reload_log 
      WHERE triggered_by = 'apply-rpc-migration-script'
    `);
    log.info('Test log entry cleaned up');

    console.log('');
    console.log('='.repeat(80));
    log.success('RPC MIGRATION COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Trigger reload via RPC: node scripts/ops/trigger-rpc-reload.js');
    console.log('  2. Verify visibility: node scripts/ops/verify-pgrst-visible.ts');
    console.log('  3. Start services: ./dev.sh start');
    console.log('');

    // Write results to artifact
    const artifact = {
      timestamp: new Date().toISOString(),
      migration_file: '20251029_pgrst_reload_rpc.sql',
      status: 'SUCCESS',
      rpc_exists: true,
      log_table_exists: true,
      rpc_info: {
        name: rpcInfo.proname,
        args: rpcInfo.args,
        security_definer: rpcInfo.is_security_definer,
        granted_to: rpcInfo.granted_to
      },
      test_result: {
        success: testResult.rows[0].success,
        reload_id: testResult.rows[0].reload_id,
        reloaded_at: testResult.rows[0].reloaded_at
      },
      log_stats: logStats
    };

    const artifactPath = path.join(__dirname, '../../out/ops/cutover/metrics/100/STEP_RPC_MIGRATION.json');
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
    log.success(`Artifact written: ${artifactPath}`);

  } catch (err) {
    log.error(`Migration failed: ${err.message}`);
    console.error(err);
    
    // Write error artifact
    const errorArtifact = {
      timestamp: new Date().toISOString(),
      migration_file: '20251029_pgrst_reload_rpc.sql',
      status: 'FAILED',
      error: err.message,
      stack: err.stack
    };
    
    const artifactPath = path.join(__dirname, '../../out/ops/cutover/metrics/100/STEP_RPC_MIGRATION.json');
    fs.writeFileSync(artifactPath, JSON.stringify(errorArtifact, null, 2));
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

