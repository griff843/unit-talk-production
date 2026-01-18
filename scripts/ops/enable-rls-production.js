#!/usr/bin/env node
/**
 * Enable Production Security (RLS) via Direct PostgreSQL Connection
 * Date: 2025-10-30
 * 
 * Executes enable-production-security.sql against Supabase Cloud database
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  
  console.log('');
  console.log('='.repeat(80));
  console.log('🔒 PRODUCTION SECURITY ENABLEMENT (RLS)');
  console.log('='.repeat(80));
  console.log('');

  // Load SQL file
  const sqlPath = path.join(__dirname, 'enable-production-security.sql');
  
  if (!fs.existsSync(sqlPath)) {
    log.error(`SQL file not found: ${sqlPath}`);
    process.exit(1);
  }

  let sql = fs.readFileSync(sqlPath, 'utf8');
  
  // Remove psql-specific commands (\echo)
  sql = sql.replace(/\\echo[^\n]*/g, '-- (echo removed)');
  
  // Calculate SQL hash for attestation
  const sqlHash = crypto.createHash('sha256').update(sql).digest('hex');
  
  log.info(`SQL file loaded (${sql.length} bytes)`);
  log.info(`SQL SHA256: ${sqlHash.substring(0, 16)}...`);

  // Connect to database
  const client = new Client({
    connectionString: process.env.DATABASE_DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    log.info('Connecting to Supabase database...');
    await client.connect();
    log.success('Connected to database');

    // Get current database info
    const dbInfo = await client.query(`
      SELECT current_database() as database, current_user as "user"
    `);
    log.info(`Database: ${dbInfo.rows[0].database}, User: ${dbInfo.rows[0].user}`);

    // Check current RLS state
    log.info('Checking current RLS state...');
    const preCheck = await client.query(`
      SELECT 
        c.relname as table_name,
        c.relrowsecurity as rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relname IN ('picks', 'pick_publish', 'audit_log')
      ORDER BY c.relname
    `);
    
    log.info('Before RLS enablement:');
    preCheck.rows.forEach(row => {
      log.info(`  - ${row.table_name}: RLS ${row.rls_enabled ? 'ENABLED' : 'DISABLED'}`);
    });

    // Apply RLS enablement SQL
    log.info('Applying RLS enablement SQL...');
    await client.query(sql);
    log.success('RLS enablement SQL executed successfully');

    // Verify RLS is enabled
    log.info('Verifying RLS state...');
    const postCheck = await client.query(`
      SELECT 
        c.relname as table_name,
        c.relrowsecurity as rls_enabled,
        (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename=c.relname) as policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relname IN ('picks', 'pick_publish', 'audit_log')
      ORDER BY c.relname
    `);

    log.success('After RLS enablement:');
    let allEnabled = true;
    postCheck.rows.forEach(row => {
      const status = row.rls_enabled ? '✅ ENABLED' : '❌ DISABLED';
      log.info(`  - ${row.table_name}: ${status} (${row.policy_count} policies)`);
      if (!row.rls_enabled) allEnabled = false;
    });

    if (!allEnabled) {
      log.error('RLS enablement verification FAILED - not all tables have RLS enabled');
      process.exit(1);
    }

    // Check security functions
    log.info('Verifying security functions...');
    const funcCheck = await client.query(`
      SELECT 
        p.proname as function_name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' 
        AND p.proname IN ('log_audit_event', 'check_rate_limit', 'update_circuit_breaker', 'cleanup_rate_limits', 'cleanup_audit_logs')
      ORDER BY p.proname
    `);

    log.success(`Security functions created: ${funcCheck.rows.length}/5`);
    funcCheck.rows.forEach(row => {
      log.info(`  - ${row.function_name}`);
    });

    // Force PostgREST reload
    log.info('Forcing PostgREST schema reload...');
    await client.query(`SELECT pg_notify('pgrst', 'reload schema')`);
    log.success('PostgREST reload notification sent');

    // Generate attestation
    const attestation = {
      timestamp: new Date().toISOString(),
      operation: 'RLS_ENABLEMENT',
      status: 'SUCCESS',
      sql_file: 'enable-production-security.sql',
      sql_hash: sqlHash,
      database: dbInfo.rows[0].database,
      user: dbInfo.rows[0].user,
      tables_enabled: postCheck.rows.map(r => ({
        table: r.table_name,
        rls_enabled: r.rls_enabled,
        policy_count: parseInt(r.policy_count)
      })),
      functions_created: funcCheck.rows.map(r => r.function_name),
      verification: {
        all_tables_rls_enabled: allEnabled,
        total_policies: postCheck.rows.reduce((sum, r) => sum + parseInt(r.policy_count), 0),
        total_functions: funcCheck.rows.length
      }
    };

    // Save attestation
    const artifactsDir = path.join(__dirname, '../../out/ops/cutover/metrics/100');
    fs.mkdirSync(artifactsDir, { recursive: true });
    
    const attestationPath = path.join(artifactsDir, `RLS_ENABLE_ATTESTATION_${timestamp}.json`);
    fs.writeFileSync(attestationPath, JSON.stringify(attestation, null, 2));
    log.success(`Attestation saved: ${attestationPath}`);

    // Generate markdown attestation
    const mdContent = `# RLS Enablement Attestation

**Date**: ${new Date().toISOString()}  
**Operation**: Production Security Enablement (RLS)  
**Status**: ✅ SUCCESS

## Execution Details

- **SQL File**: \`enable-production-security.sql\`
- **SQL Hash**: \`${sqlHash}\`
- **Database**: \`${dbInfo.rows[0].database}\`
- **User**: \`${dbInfo.rows[0].user}\`

## Tables with RLS Enabled

${postCheck.rows.map(r => `- **${r.table_name}**: ${r.rls_enabled ? '✅ ENABLED' : '❌ DISABLED'} (${r.policy_count} policies)`).join('\n')}

## Security Functions Created

${funcCheck.rows.map(r => `- \`${r.function_name}\``).join('\n')}

## Verification Summary

- **All Tables RLS Enabled**: ${allEnabled ? '✅ YES' : '❌ NO'}
- **Total Policies**: ${postCheck.rows.reduce((sum, r) => sum + parseInt(r.policy_count), 0)}
- **Total Functions**: ${funcCheck.rows.length}

## Next Steps

1. ✅ RLS enabled on canonical tables
2. ⏭️ Verify API health and preflight
3. ⏭️ Run E2E validation
4. ⏭️ Monitor for RLS-related errors

---

**Attestation File**: \`${path.basename(attestationPath)}\`  
**Generated**: ${new Date().toISOString()}
`;

    const mdPath = path.join(artifactsDir, `RLS_ENABLE_ATTESTATION_${timestamp}.md`);
    fs.writeFileSync(mdPath, mdContent);
    log.success(`Markdown attestation saved: ${mdPath}`);

    console.log('');
    console.log('='.repeat(80));
    log.success('🔒 RLS ENABLEMENT COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Summary:');
    console.log(`  ✅ RLS enabled on ${postCheck.rows.length} tables`);
    console.log(`  ✅ ${postCheck.rows.reduce((sum, r) => sum + parseInt(r.policy_count), 0)} policies active`);
    console.log(`  ✅ ${funcCheck.rows.length} security functions created`);
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Verify API health: curl http://localhost:3010/api/health');
    console.log('  2. Verify preflight: curl http://localhost:3010/api/domain/picks/preflight');
    console.log('  3. Run E2E validation: .\\scripts\\ops\\industry-standard-e2e-validation.ps1');
    console.log('');

  } catch (err) {
    log.error(`RLS enablement failed: ${err.message}`);
    console.error(err);
    
    // Save failure attestation
    const failureAttestation = {
      timestamp: new Date().toISOString(),
      operation: 'RLS_ENABLEMENT',
      status: 'FAILED',
      error: err.message,
      stack: err.stack
    };
    
    const artifactsDir = path.join(__dirname, '../../out/ops/cutover/metrics/100');
    fs.mkdirSync(artifactsDir, { recursive: true });
    
    const failurePath = path.join(artifactsDir, `RLS_ENABLE_FAILURE_${timestamp}.json`);
    fs.writeFileSync(failurePath, JSON.stringify(failureAttestation, null, 2));
    log.error(`Failure attestation saved: ${failurePath}`);
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

