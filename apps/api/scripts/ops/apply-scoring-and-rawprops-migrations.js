#!/usr/bin/env node

/**
 * Local copy for running scoring + raw_props migrations **inside the api container**.
 *
 * Source of truth: scripts/ops/apply-scoring-and-rawprops-migrations.js
 * This wrapper simply adjusts paths so that it can be executed from
 * /app/apps/api where the api service runs.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const MIGRATIONS = [
  {
    filename: '20251030_scoring_infrastructure.sql',
    description: 'Scoring infrastructure (clv_tracking, internal_scores, score_audit_log, capper_calibration)'
  },
  {
    filename: '20251120_raw_props_performance_index.sql',
    description: 'raw_props performance index for ProfessionalPropProcessor.getUnprocessedRawProps()'
  },
  {
    filename: '20251122_raw_props_professional_columns.sql',
    description:
      'Phase 15 – raw_props professional processing columns (processed_at/processed_by/error_message/error_at, book, market_open_time)'
  }
];

function log(msg, extra) {
  const ts = new Date().toISOString();
  if (extra) {
    console.log(`[${ts}] ${msg}`, extra);
  } else {
    console.log(`[${ts}] ${msg}`);
  }
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials. Require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  log('Using Supabase URL ' + supabaseUrl);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

async function applyMigration(supabase, migration, report) {
  // IMPORTANT: api container has monorepo root mounted at /app
  const migrationPath = path.join('/app', 'supabase', 'migrations', migration.filename);

  if (!fs.existsSync(migrationPath)) {
    const msg = `Migration file not found: ${migrationPath}`;
    console.error('❌ ' + msg);
    report.events.push({ step: 'load-sql', migration: migration.filename, status: 'error', message: msg });
    throw new Error(msg);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  log(`📄 Loaded migration ${migration.filename} (${sql.length} bytes)`);
  report.events.push({
    step: 'load-sql',
    migration: migration.filename,
    status: 'ok',
    message: `Loaded ${migration.filename} (${sql.length} bytes)`
  });

  log(`⚡ Executing migration via exec_sql RPC: ${migration.description}`);
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    const msg = `exec_sql RPC failed for ${migration.filename}: ${error.message || String(error)}`;
    console.error('❌ ' + msg);
    report.events.push({ step: 'exec-sql', migration: migration.filename, status: 'error', message: msg });
    throw new Error(msg);
  }

  log(`✅ Migration applied via exec_sql for ${migration.filename}`);
  report.events.push({
    step: 'exec-sql',
    migration: migration.filename,
    status: 'ok',
    message: 'Applied via exec_sql RPC'
  });

  if (data) {
    report.migrationResults[migration.filename] = data;
  }
}

async function triggerPostgrestReload(supabase, report) {
  log('🔄 Triggering PostgREST schema reload via pgrst_reload RPC (if available)...');

  try {
    const { data, error } = await supabase.rpc('pgrst_reload', {
      p_triggered_by: 'apply-scoring-and-rawprops-migrations',
      p_reason: 'scoring infrastructure + raw_props index migrations via RPC (api container copy)'
    });

    if (error) {
      const msg = `pgrst_reload RPC failed: ${error.message || String(error)}`;
      console.warn('⚠️  ' + msg);
      report.events.push({ step: 'pgrst-reload', status: 'warn', message: msg });
      return;
    }

    log('✅ PostgREST reload triggered', data);
    report.events.push({ step: 'pgrst-reload', status: 'ok', message: 'PostgREST reload triggered', data });
  } catch (err) {
    const msg = `Exception during pgrst_reload: ${err.message || String(err)}`;
    console.warn('⚠️  ' + msg);
    report.events.push({ step: 'pgrst-reload', status: 'warn', message: msg });
  }
}

async function verifySchema(supabase, report) {
  log('🔍 Verifying scoring infrastructure visibility via PostgREST...');

  try {
    const { error } = await supabase.from('clv_tracking').select('id').limit(1);

    if (error) {
      const msg = `clv_tracking not visible via PostgREST: ${error.message || String(error)}`;
      console.error('❌ ' + msg);
      report.events.push({ step: 'verify-clv-tracking', status: 'error', message: msg });
    } else {
      log('✅ clv_tracking table visible via PostgREST');
      report.events.push({ step: 'verify-clv-tracking', status: 'ok', message: 'clv_tracking visible via PostgREST' });
    }
  } catch (err) {
    const msg = `Exception verifying clv_tracking: ${err.message || String(err)}`;
    console.error('❌ ' + msg);
    report.events.push({ step: 'verify-clv-tracking', status: 'error', message: msg });
  }
}

function writeReport(report) {
  // Write inside /app/apps/api/logs so it is mounted to host
  const outDir = path.join('/app', 'apps', 'api', 'logs', 'cutover-migrations');
  fs.mkdirSync(outDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `SCORING_AND_RAWPROPS_MIGRATION_${ts}`;

  const jsonPath = path.join(outDir, `${baseName}.json`);
  const mdPath = path.join(outDir, `${baseName}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const lines = [];
  lines.push('# Scoring + raw_props Migration Report (api container copy)');
  lines.push('');
  lines.push(`- Run at: ${report.runAt}`);
  lines.push(`- Status: ${report.status}`);
  lines.push('');
  lines.push('## Migrations');
  for (const m of report.migrations) {
    lines.push(`- ${m.filename}: ${m.description}`);
  }
  lines.push('');
  lines.push('## Events');
  for (const e of report.events) {
    lines.push(`- [${e.status}] ${e.step}${e.migration ? ' (' + e.migration + ')' : ''}: ${e.message}`);
  }

  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');

  log(`📄 Migration report written: ${mdPath}`);
}

async function main() {
  const report = {
    runAt: new Date().toISOString(),
    status: 'unknown',
    migrations: MIGRATIONS,
    events: [],
    migrationResults: {}
  };

  try {
    const supabase = getSupabaseClient();

    for (const migration of MIGRATIONS) {
      await applyMigration(supabase, migration, report);
    }

    await triggerPostgrestReload(supabase, report);
    await verifySchema(supabase, report);

    report.status = 'ok';
    writeReport(report);

    log('🎉 Scoring + raw_props migrations applied successfully (api container copy)');
    process.exit(0);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error('❌ Migration script failed:', msg);
    report.status = 'error';
    report.events.push({ step: 'fatal', status: 'error', message: msg });
    writeReport(report);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Unhandled error in migration script:', err.message || String(err));
    process.exit(1);
  });
}

