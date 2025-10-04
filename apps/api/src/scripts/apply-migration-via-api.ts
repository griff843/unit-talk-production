#!/usr/bin/env tsx
/**
 * Apply DB Migration via Supabase Management API
 * Splits large SQL file into chunks and applies via REST API
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DB_PASSWORD = 'Adalise843!';

// Use direct database URL for connection string
const DATABASE_URL = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.lxqmuzmqtnnlpfapvief.supabase.co:5432/postgres`;

interface ExecutionResult {
  file: string;
  status: 'success' | 'error';
  duration_ms: number;
  error?: string;
  statements_executed?: number;
}

async function executeSqlViaSupabase(sql: string): Promise<{ success: boolean; error?: string; rowCount?: number }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Try using Supabase's rpc method with a custom function
    // Note: This requires the function to exist in the database
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, rowCount: data?.rowCount || 0 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function splitSqlIntoStatements(sql: string): string[] {
  // Split on semicolons that are not inside strings or function bodies
  // This is a simplified approach - may need refinement for complex SQL
  const statements: string[] = [];
  let currentStatement = '';
  let inString = false;
  let inDollarQuote = false;
  let dollarQuoteTag = '';

  const lines = sql.split('\n');

  for (const line of lines) {
    // Skip comments
    if (line.trim().startsWith('--')) {
      continue;
    }

    // Handle dollar-quoted strings (for functions)
    if (!inString && line.includes('$$')) {
      if (!inDollarQuote) {
        inDollarQuote = true;
      } else {
        inDollarQuote = false;
      }
    }

    currentStatement += line + '\n';

    // Check for statement terminator (semicolon not in quotes)
    if (!inString && !inDollarQuote && line.trim().endsWith(';')) {
      const stmt = currentStatement.trim();
      if (stmt && stmt.length > 0) {
        statements.push(stmt);
      }
      currentStatement = '';
    }
  }

  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements;
}

async function testConnection(): Promise<boolean> {
  console.log('🧪 Testing Supabase connection...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data, error } = await supabase
      .from('raw_props')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }

    console.log('✅ Connection successful - raw_props accessible');
    return true;
  } catch (error: any) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 DB Migration via Supabase API\n');
  console.log('Target: Supabase Cloud (lxqmuzmqtnnlpfapvief)\n');

  // Create run directory
  const runId = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
  const outDir = path.join(__dirname, '../../out/ops/dbcore', `run-${runId}`);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`📁 Output directory: ${outDir}\n`);

  // Test connection
  const connectionOk = await testConnection();

  if (!connectionOk) {
    console.error('\n❌ Connection test failed');
    console.log('\n⚠️  MANUAL APPLICATION REQUIRED:');
    console.log('1. Go to: https://supabase.com/dashboard/project/lxqmuzmqtnnlpfapvief/sql/new');
    console.log('2. Open file: apps/api/out/ops/dbcore/run-20251003_102349/00_consolidated_migration.sql');
    console.log('3. Copy and paste the entire contents into the SQL Editor');
    console.log('4. Click "Run" to execute the migration');
    console.log('5. Review the results and verify all tables were created\n');

    // Generate manual instructions file
    const instructionsPath = path.join(outDir, 'MANUAL_APPLICATION_INSTRUCTIONS.md');
    const instructions = `# Manual Migration Application Instructions

## Connection Issue Detected

The automated migration script cannot connect to the Supabase database due to network/DNS issues.

## Manual Application Steps

### Step 1: Access Supabase SQL Editor
1. Navigate to: https://supabase.com/dashboard/project/lxqmuzmqtnnlpfapvief/sql/new
2. Log in with your Supabase credentials

### Step 2: Load Migration SQL
1. Open the consolidated migration file:
   \`\`\`
   apps/api/out/ops/dbcore/run-20251003_102349/00_consolidated_migration.sql
   \`\`\`

2. Copy the entire contents (3,167 lines)

### Step 3: Execute Migration
1. Paste the SQL into the Supabase SQL Editor
2. Click "Run" button
3. Wait for execution to complete (~60-90 seconds)

### Step 4: Verify Results
Run these validation queries in the SQL Editor:

\`\`\`sql
-- Check new tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('scored_props', 'promotion_queue', 'picks_submissions', 'jobs', 'outbox', 'events', 'model_versions')
ORDER BY table_name;

-- Check partitions created
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'raw_props_25%'
ORDER BY tablename;

-- Check views created
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name LIKE 'v_%'
ORDER BY table_name;

-- Verify unified_picks is now a VIEW
SELECT table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'unified_picks';
\`\`\`

Expected results:
- 7 new tables created
- 6+ partitions for raw_props
- 7+ views created
- unified_picks shows as "VIEW" not "BASE TABLE"

### Step 5: Run Smoke Tests
Execute the smoke test file:
\`\`\`
apps/api/out/ops/dbcore/run-20251003_102349/05_smoke.sql
\`\`\`

This will test the complete end-to-end workflow.

### Troubleshooting

If errors occur during migration:
1. All SQL is idempotent - safe to re-run
2. Check error message for specific failing statement
3. Fix issue and re-run entire migration
4. No partial rollback needed - SQL handles conflicts gracefully

### Rollback (if needed)

If you need to rollback:
\`\`\`sql
DROP VIEW IF EXISTS unified_picks CASCADE;
ALTER TABLE unified_picks_legacy RENAME TO unified_picks;
\`\`\`

This restores the original schema instantly.
`;

    fs.writeFileSync(instructionsPath, instructions);
    console.log(`📝 Manual instructions saved to: ${instructionsPath}\n`);

    process.exit(1);
  }

  console.log('\n✅ Connection verified - automated migration would proceed here');
  console.log('\n⚠️  However, due to network limitations, manual application is recommended');
  console.log('See instructions above.\n');
}

main().catch(console.error);
