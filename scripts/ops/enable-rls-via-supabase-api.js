#!/usr/bin/env node
/**
 * Enable Production Security (RLS) via Supabase Management API
 * Date: 2025-10-30
 * 
 * Uses Supabase Management API to execute SQL for RLS enablement
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

async function executeSQL(sql) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  // Extract project ref from URL
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectRef) {
    throw new Error('Could not extract project ref from SUPABASE_URL');
  }

  log.info(`Project ref: ${projectRef}`);

  // Use Supabase Management API to execute SQL
  const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  
  console.log('');
  console.log('='.repeat(80));
  console.log('🔒 PRODUCTION SECURITY ENABLEMENT (RLS) via Supabase API');
  console.log('='.repeat(80));
  console.log('');

  // Load SQL file
  const sqlPath = path.join(__dirname, 'enable-production-security.sql');
  
  if (!fs.existsSync(sqlPath)) {
    log.error(`SQL file not found: ${sqlPath}`);
    process.exit(1);
  }

  let sql = fs.readFileSync(sqlPath, 'utf8');
  
  // Remove psql-specific commands (\echo) and comments
  sql = sql.replace(/\\echo[^\n]*/g, '');
  sql = sql.split('\n').filter(line => !line.trim().startsWith('--') && line.trim()).join('\n');
  
  // Calculate SQL hash for attestation
  const sqlHash = crypto.createHash('sha256').update(sql).digest('hex');
  
  log.info(`SQL file loaded (${sql.length} bytes)`);
  log.info(`SQL SHA256: ${sqlHash.substring(0, 16)}...`);

  try {
    log.info('Executing RLS enablement SQL via Supabase Management API...');
    
    // Split SQL into individual statements (simple approach)
    const statements = sql.split(';').filter(s => s.trim());
    
    log.info(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;
      
      log.info(`  [${i + 1}/${statements.length}] Executing statement...`);
      
      try {
        await executeSQL(stmt + ';');
      } catch (err) {
        // Some statements might fail if already exists - log but continue
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          log.warn(`  Statement ${i + 1} skipped (already exists)`);
        } else {
          throw err;
        }
      }
    }
    
    log.success('All SQL statements executed successfully');

    // Verify RLS is enabled
    log.info('Verifying RLS state...');
    const verifySQL = `
      SELECT 
        c.relname as table_name,
        c.relrowsecurity as rls_enabled,
        (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename=c.relname) as policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relname IN ('picks', 'pick_publish', 'audit_log')
      ORDER BY c.relname;
    `;
    
    const verifyResult = await executeSQL(verifySQL);
    
    log.success('RLS verification results:');
    let allEnabled = true;
    verifyResult.forEach(row => {
      const status = row.rls_enabled ? '✅ ENABLED' : '❌ DISABLED';
      log.info(`  - ${row.table_name}: ${status} (${row.policy_count} policies)`);
      if (!row.rls_enabled) allEnabled = false;
    });

    if (!allEnabled) {
      log.error('RLS enablement verification FAILED - not all tables have RLS enabled');
      process.exit(1);
    }

    // Force PostgREST reload
    log.info('Forcing PostgREST schema reload...');
    await executeSQL(`SELECT pg_notify('pgrst', 'reload schema');`);
    log.success('PostgREST reload notification sent');

    // Generate attestation
    const attestation = {
      timestamp: new Date().toISOString(),
      operation: 'RLS_ENABLEMENT',
      status: 'SUCCESS',
      method: 'SUPABASE_MANAGEMENT_API',
      sql_file: 'enable-production-security.sql',
      sql_hash: sqlHash,
      tables_enabled: verifyResult.map(r => ({
        table: r.table_name,
        rls_enabled: r.rls_enabled,
        policy_count: parseInt(r.policy_count)
      })),
      verification: {
        all_tables_rls_enabled: allEnabled,
        total_policies: verifyResult.reduce((sum, r) => sum + parseInt(r.policy_count), 0)
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
**Method**: Supabase Management API

## Execution Details

- **SQL File**: \`enable-production-security.sql\`
- **SQL Hash**: \`${sqlHash}\`
- **Execution Method**: Supabase Management API

## Tables with RLS Enabled

${verifyResult.map(r => `- **${r.table_name}**: ${r.rls_enabled ? '✅ ENABLED' : '❌ DISABLED'} (${r.policy_count} policies)`).join('\n')}

## Verification Summary

- **All Tables RLS Enabled**: ${allEnabled ? '✅ YES' : '❌ NO'}
- **Total Policies**: ${verifyResult.reduce((sum, r) => sum + parseInt(r.policy_count), 0)}

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
    console.log(`  ✅ RLS enabled on ${verifyResult.length} tables`);
    console.log(`  ✅ ${verifyResult.reduce((sum, r) => sum + parseInt(r.policy_count), 0)} policies active`);
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Verify API health: curl http://localhost:3010/api/health');
    console.log('  2. Verify preflight: curl http://localhost:3010/api/domain/picks/preflight');
    console.log('  3. Run E2E validation');
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
  }
}

main();

