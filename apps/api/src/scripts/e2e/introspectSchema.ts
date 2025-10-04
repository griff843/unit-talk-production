#!/usr/bin/env tsx
/**
 * Comprehensive Supabase Schema Introspection
 * Uses Supabase client + PostgREST for schema discovery
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SchemaReport {
  generated_at: string;
  tables: Array<{
    name: string;
    columns: any[];
    sample_row?: any;
    row_count?: number;
  }>;
  views: string[];
  enums: any[];
  summary: any;
}

async function introspectSchema() {
  console.log('\n🔍 Starting Supabase Schema Introspection...\n');

  const report: SchemaReport = {
    generated_at: new Date().toISOString(),
    tables: [],
    views: [],
    enums: [],
    summary: {}
  };

  // Get list of tables from information_schema via RPC or direct query
  // Since we can't use arbitrary SQL, we'll discover tables by trying to query them
  const knownTables = [
    'unified_picks',
    'users',
    'raw_props',
    'scored_props',
    'promotion_queue',
    'picks',
    'picks_submissions',
    'settled_outcomes',
    'games',
    'teams',
    'players',
    'player_stats',
    'line_history',
    'jobs',
    'outbox',
    'events',
    'model_versions',
    'feature_flags',
    'agent_health',
    'agent_metrics',
    'bridge_outbox',
    'prop_scores',
    'pick_history',
    'user_picks',
    'user_profiles',
    'cappers',
    'bookmakers',
    'leagues',
    'seasons',
    'contests',
    'leaderboards',
    'notifications',
    'audit_logs',
    'system_config',
    'migrations',
    'schema_migrations'
  ];

  console.log(`📋 Checking ${knownTables.length} potential tables...\n`);

  for (const tableName of knownTables) {
    try {
      // Try to get table structure by querying with limit 0
      const { data: structure, error: structError } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);

      if (structError) {
        // Table doesn't exist or no access
        continue;
      }

      // Get row count
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      // Get a sample row to see column structure
      const { data: sample, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)
        .single();

      const tableInfo: any = {
        name: tableName,
        row_count: count || 0,
        columns: [],
        sample_row: sample || null
      };

      // Extract column names and types from sample
      if (sample) {
        tableInfo.columns = Object.keys(sample).map(colName => ({
          name: colName,
          type: typeof sample[colName],
          sample_value: sample[colName]
        }));
      }

      report.tables.push(tableInfo);
      console.log(`✅ ${tableName}: ${count || 0} rows, ${tableInfo.columns.length} columns`);

    } catch (err: any) {
      // Silently skip tables that don't exist
      continue;
    }
  }

  // Try to get views (we know unified_picks might be a view)
  console.log('\n🔍 Checking for views...\n');

  // Check if unified_picks is a view by trying to insert (should fail for views)
  try {
    const { error } = await supabase
      .from('unified_picks')
      .insert({ test: 'value' });

    if (error && error.message.includes('view')) {
      report.views.push('unified_picks');
      console.log('✅ Detected view: unified_picks');
    }
  } catch (err) {
    // Ignore
  }

  // Summary
  report.summary = {
    total_tables: report.tables.length,
    total_views: report.views.length,
    total_rows: report.tables.reduce((sum, t) => sum + (t.row_count || 0), 0),
    tables_with_data: report.tables.filter(t => (t.row_count || 0) > 0).length
  };

  // Save report
  const outDir = path.join(process.cwd(), 'out', 'ops', 'dbcore');
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'schema_introspection.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdPath = path.join(outDir, '00_mapping_report.md');
  generateMappingReport(report, mdPath);

  console.log(`\n✅ Schema report saved to: ${jsonPath}`);
  console.log(`✅ Mapping report saved to: ${mdPath}\n`);

  // Print summary
  console.log('📊 SCHEMA SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tables Found: ${report.summary.total_tables}`);
  console.log(`Tables with Data: ${report.summary.tables_with_data}`);
  console.log(`Total Rows: ${report.summary.total_rows.toLocaleString()}`);
  console.log(`Views: ${report.summary.total_views}`);
  console.log('='.repeat(60));
  console.log('\n📋 TABLES WITH DATA:\n');

  report.tables
    .filter(t => (t.row_count || 0) > 0)
    .sort((a, b) => (b.row_count || 0) - (a.row_count || 0))
    .forEach(table => {
      console.log(`  ${table.name.padEnd(30)} ${(table.row_count || 0).toLocaleString().padStart(10)} rows`);
    });

  console.log('\n✅ Introspection complete!\n');

  return report;
}

function generateMappingReport(report: SchemaReport, outputPath: string) {
  const lines: string[] = [];

  lines.push('# Schema Mapping Report');
  lines.push('');
  lines.push(`Generated: ${report.generated_at}`);
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`- **Total Tables**: ${report.summary.total_tables}`);
  lines.push(`- **Tables with Data**: ${report.summary.tables_with_data}`);
  lines.push(`- **Total Rows**: ${report.summary.total_rows.toLocaleString()}`);
  lines.push(`- **Views**: ${report.summary.total_views}`);
  lines.push('');
  lines.push('## Layered Model Mapping');
  lines.push('');
  lines.push('### 1. Sources (Append-Only)');
  lines.push('');

  const sourceTables = report.tables.filter(t =>
    ['raw_props', 'line_history', 'player_stats', 'games', 'teams', 'players', 'events', 'outbox'].includes(t.name)
  );

  if (sourceTables.length > 0) {
    lines.push('| Table | Rows | Status | Notes |');
    lines.push('|-------|------|--------|-------|');
    sourceTables.forEach(t => {
      lines.push(`| ${t.name} | ${(t.row_count || 0).toLocaleString()} | ✅ EXISTS | ${t.columns.length} columns |`);
    });
  } else {
    lines.push('⚠️ **Missing source tables**: raw_props, line_history, player_stats need to be created');
  }

  lines.push('');
  lines.push('### 2. Computed Read-Models');
  lines.push('');

  const readModelTables = report.tables.filter(t =>
    ['scored_props', 'prop_scores'].includes(t.name)
  );

  if (readModelTables.length > 0) {
    lines.push('| Table | Rows | Status | Notes |');
    lines.push('|-------|------|--------|-------|');
    readModelTables.forEach(t => {
      lines.push(`| ${t.name} | ${(t.row_count || 0).toLocaleString()} | ✅ EXISTS | ${t.columns.length} columns |`);
    });
  } else {
    lines.push('⚠️ **Missing**: scored_props table needs to be created');
  }

  lines.push('');
  lines.push('### 3. Workflow State');
  lines.push('');

  const workflowTables = report.tables.filter(t =>
    ['promotion_queue', 'picks', 'picks_submissions'].includes(t.name)
  );

  if (workflowTables.length > 0) {
    lines.push('| Table | Rows | Status | Notes |');
    lines.push('|-------|------|--------|-------|');
    workflowTables.forEach(t => {
      lines.push(`| ${t.name} | ${(t.row_count || 0).toLocaleString()} | ✅ EXISTS | ${t.columns.length} columns |`);
    });
  } else {
    lines.push('⚠️ **Missing**: promotion_queue, picks, picks_submissions need to be created');
  }

  lines.push('');
  lines.push('### 4. Results Sink');
  lines.push('');

  const resultsTables = report.tables.filter(t =>
    ['settled_outcomes'].includes(t.name)
  );

  if (resultsTables.length > 0) {
    lines.push('| Table | Rows | Status | Notes |');
    lines.push('|-------|------|--------|-------|');
    resultsTables.forEach(t => {
      lines.push(`| ${t.name} | ${(t.row_count || 0).toLocaleString()} | ✅ EXISTS | ${t.columns.length} columns |`);
    });
  } else {
    lines.push('⚠️ **Missing**: settled_outcomes table needs to be created');
  }

  lines.push('');
  lines.push('### 5. Ops/Audit');
  lines.push('');

  const opsTables = report.tables.filter(t =>
    ['jobs', 'outbox', 'events', 'model_versions', 'feature_flags', 'audit_logs', 'agent_health', 'agent_metrics'].includes(t.name)
  );

  if (opsTables.length > 0) {
    lines.push('| Table | Rows | Status | Notes |');
    lines.push('|-------|------|--------|-------|');
    opsTables.forEach(t => {
      lines.push(`| ${t.name} | ${(t.row_count || 0).toLocaleString()} | ✅ EXISTS | ${t.columns.length} columns |`);
    });
  } else {
    lines.push('⚠️ **Partial**: Some ops/audit tables missing');
  }

  lines.push('');
  lines.push('### 6. Compatibility Façade');
  lines.push('');

  const unifiedPicks = report.tables.find(t => t.name === 'unified_picks');
  if (unifiedPicks || report.views.includes('unified_picks')) {
    lines.push(`✅ **unified_picks** exists with ${unifiedPicks?.row_count || 0} rows`);
    if (report.views.includes('unified_picks')) {
      lines.push('   - Type: VIEW (good for compatibility)');
    }
  } else {
    lines.push('⚠️ **unified_picks** not found - needs to be created as a VIEW');
  }

  lines.push('');
  lines.push('## Column Analysis');
  lines.push('');

  // Analyze unified_picks columns
  if (unifiedPicks && unifiedPicks.columns.length > 0) {
    lines.push('### unified_picks columns:');
    lines.push('');
    unifiedPicks.columns.forEach(col => {
      lines.push(`- \`${col.name}\` (${col.type})`);
    });
  }

  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  lines.push('### Schema Adjustments Needed:');
  lines.push('');

  // Generate recommendations
  if (!sourceTables.find(t => t.name === 'raw_props')) {
    lines.push('1. ⚠️ **CREATE raw_props table** for append-only prop ingestion');
  }
  if (!sourceTables.find(t => t.name === 'line_history')) {
    lines.push('2. ⚠️ **CREATE line_history table** for price snapshots');
  }
  if (!readModelTables.find(t => t.name === 'scored_props')) {
    lines.push('3. ⚠️ **CREATE scored_props table** for scoring results');
  }
  if (!workflowTables.find(t => t.name === 'promotion_queue')) {
    lines.push('4. ⚠️ **CREATE promotion_queue table** for Command Center workflow');
  }
  if (!resultsTables.find(t => t.name === 'settled_outcomes')) {
    lines.push('5. ⚠️ **CREATE settled_outcomes table** for settlement results');
  }

  lines.push('');
  lines.push('### Partitioning Recommendations:');
  lines.push('');
  lines.push('Apply monthly partitioning to high-volume tables:');
  lines.push('');

  const highVolumeTables = report.tables.filter(t => (t.row_count || 0) > 10000);
  highVolumeTables.forEach(t => {
    lines.push(`- \`${t.name}\` (${(t.row_count || 0).toLocaleString()} rows) - partition on game_date`);
  });

  lines.push('');
  lines.push('### Index Recommendations:');
  lines.push('');
  lines.push('Based on discovered tables, add indexes for:');
  lines.push('');
  lines.push('- `raw_props`: (sport, market, game_date), (player_name, market)');
  lines.push('- `line_history`: (prop_ref, observed_at)');
  lines.push('- `scored_props`: (edge DESC), (prop_ref)');
  lines.push('- `promotion_queue`: (status, created_at)');
  lines.push('- `picks`: (status, publish_at)');
  lines.push('');

  fs.writeFileSync(outputPath, lines.join('\n'));
}

introspectSchema().catch(console.error);
