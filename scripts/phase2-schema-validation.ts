/**
 * Phase 2 — Schema Validation
 *
 * Validates database schema:
 * 1. Required tables exist
 * 2. pick_publish.channel constraint includes 'CANARY'
 * 3. Document schema contract
 */

import { createClient } from '@supabase/supabase-js';
import { loadRootEnv } from '../packages/shared-utils/src/loadRootEnv';
import * as fs from 'fs';
import * as path from 'path';

loadRootEnv();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function validateSchema() {
  console.log('=== Phase 2 — Schema Validation ===\n');

  const results: any = {
    timestamp: new Date().toISOString(),
    tables: {},
    constraints: {},
    summary: {
      tablesChecked: 0,
      tablesExist: 0,
      constraintsChecked: 0,
      constraintsValid: 0,
    },
  };

  // 1. Check required tables exist
  const requiredTables = ['picks', 'pick_publish', 'props', 'users', 'tenants'];

  console.log('## Checking Required Tables:\n');

  for (const table of requiredTables) {
    results.summary.tablesChecked++;

    // Try to select from table (will error if doesn't exist)
    const { error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    const exists = !error;

    if (exists) {
      results.summary.tablesExist++;
      console.log(`✅ ${table}: EXISTS (${count ?? '?'} rows)`);
      results.tables[table] = {
        status: 'EXISTS',
        rowCount: count,
      };
    } else {
      console.log(`❌ ${table}: NOT FOUND`);
      console.log(`   Error: ${error.message}`);
      results.tables[table] = {
        status: 'NOT FOUND',
        error: error.message,
      };
    }
  }

  // 2. Check pick_publish channel constraint
  console.log('\n## Checking pick_publish Channel Constraint:\n');
  results.summary.constraintsChecked++;

  // Try to insert a test record with CANARY channel
  const testPickId = '00000000-0000-0000-0000-000000000000';
  const testTenantId = process.env.DEFAULT_TENANT_ID!;

  const { error: canaryError } = await supabase.from('pick_publish').insert({
    pick_id: testPickId,
    tenant_id: testTenantId,
    channel: 'CANARY',
    status: 'pending',
    discord_channel_id: process.env.CANARY_CHANNEL_ID,
  });

  if (canaryError) {
    if (canaryError.message.includes('check constraint')) {
      console.log('❌ CANARY channel NOT accepted by constraint');
      console.log(`   Error: ${canaryError.message}`);
      console.log('\n⚠️ MIGRATION REQUIRED:');
      console.log('   ALTER TABLE pick_publish');
      console.log('     DROP CONSTRAINT IF EXISTS pick_publish_channel_check;');
      console.log('   ALTER TABLE pick_publish');
      console.log("     ADD CONSTRAINT pick_publish_channel_check CHECK (channel IN ('DISCORD', 'CANARY', 'WEBHOOK', 'EMAIL'));");

      results.constraints.pick_publish_channel = {
        status: 'INVALID',
        error: canaryError.message,
        migrationRequired: true,
      };
    } else if (canaryError.message.includes('foreign key')) {
      console.log('✅ CANARY channel accepted (test failed on FK, which is expected)');
      results.summary.constraintsValid++;
      results.constraints.pick_publish_channel = {
        status: 'VALID',
        note: 'Test record failed on FK violation (expected for fake pick_id)',
      };
    } else {
      console.log(`⚠️ Unexpected error: ${canaryError.message}`);
      results.constraints.pick_publish_channel = {
        status: 'UNKNOWN',
        error: canaryError.message,
      };
    }
  } else {
    console.log('✅ CANARY channel accepted!');
    results.summary.constraintsValid++;
    results.constraints.pick_publish_channel = {
      status: 'VALID',
    };

    // Clean up test record
    console.log('Cleaning up test record...');
    await supabase.from('pick_publish').delete().eq('pick_id', testPickId);
  }

  // 3. Summary
  console.log('\n=== Summary ===');
  console.log(`Tables: ${results.summary.tablesExist}/${results.summary.tablesChecked} exist`);
  console.log(`Constraints: ${results.summary.constraintsValid}/${results.summary.constraintsChecked} valid`);

  const success =
    results.summary.tablesExist === results.summary.tablesChecked &&
    results.summary.constraintsValid === results.summary.constraintsChecked;

  if (success) {
    console.log('\n✅ SCHEMA VALIDATION PASSED');
  } else {
    console.log('\n❌ SCHEMA VALIDATION FAILED - See errors above');
  }

  // Write evidence
  const evidenceDir = path.join(__dirname, '..', 'docs', 'ops', 'live_fire_run_2025-12-12');
  const jsonPath = path.join(evidenceDir, 'phase2_schema_validation.json');
  const mdPath = path.join(evidenceDir, 'phase2_sql_results.md');

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  // Generate markdown report
  const markdown = `# Phase 2 — Schema Validation Results

**Timestamp:** ${results.timestamp}

## Required Tables

${requiredTables
  .map((table) => {
    const result = results.tables[table];
    if (result.status === 'EXISTS') {
      return `- ✅ **${table}**: EXISTS (${result.rowCount ?? '?'} rows)`;
    } else {
      return `- ❌ **${table}**: NOT FOUND\n  - Error: ${result.error}`;
    }
  })
  .join('\n')}

## Constraints

### pick_publish.channel Constraint

${
  results.constraints.pick_publish_channel.status === 'VALID'
    ? `✅ **VALID** - CANARY channel accepted`
    : results.constraints.pick_publish_channel.status === 'INVALID'
    ? `❌ **INVALID** - CANARY channel not accepted

**Migration Required:**
\`\`\`sql
ALTER TABLE pick_publish
  DROP CONSTRAINT IF EXISTS pick_publish_channel_check;

ALTER TABLE pick_publish
  ADD CONSTRAINT pick_publish_channel_check
  CHECK (channel IN ('DISCORD', 'CANARY', 'WEBHOOK', 'EMAIL'));
\`\`\`

**Error:** ${results.constraints.pick_publish_channel.error}
`
    : `⚠️ **UNKNOWN** - ${results.constraints.pick_publish_channel.error}`
}

## Summary

- **Tables Checked:** ${results.summary.tablesChecked}
- **Tables Exist:** ${results.summary.tablesExist}
- **Constraints Checked:** ${results.summary.constraintsChecked}
- **Constraints Valid:** ${results.summary.constraintsValid}

**Result:** ${success ? '✅ PASSED' : '❌ FAILED'}
`;

  fs.writeFileSync(mdPath, markdown);

  console.log(`\n📄 Evidence written to:`);
  console.log(`   ${jsonPath}`);
  console.log(`   ${mdPath}`);

  return { success, results };
}

validateSchema()
  .then(({ success }) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('FATAL ERROR:', error);
    process.exit(1);
  });
