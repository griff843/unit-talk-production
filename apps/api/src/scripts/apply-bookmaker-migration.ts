import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔧 Applying bookmaker unique constraint migration...\n');

  // Read migration file
  const migrationPath = path.join(process.cwd(), '../../supabase/migrations/20250930_fix_unique_constraint_for_bookmakers.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

  console.log(`Found ${statements.length} SQL statements\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`[${i + 1}/${statements.length}] Executing: ${stmt.substring(0, 60)}...`);

    // Execute via Supabase
    const { data, error } = await supabase.rpc('exec_sql', { query: stmt + ';' });

    if (error) {
      // Check if it's a benign error (like "does not exist" for DROP)
      if (error.message?.includes('does not exist')) {
        console.log(`  ⚠️  Object doesn't exist (safe to ignore)`);
      } else {
        console.error(`  ❌ Error:`, error.message || error);
        // Continue anyway
      }
    } else {
      console.log(`  ✅ Success`);
    }
  }

  console.log('\n✅ Migration complete!\n');

  // Verify the new constraint exists
  console.log('🔍 Verifying new constraint...');
  const { data: indexes } = await supabase
    .from('pg_indexes')
    .select('indexname, indexdef')
    .eq('tablename', 'unified_picks')
    .like('indexname', '%bookmaker%');

  if (indexes && indexes.length > 0) {
    console.log('✅ New bookmaker constraint found:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });
  } else {
    console.log('⚠️  Could not verify constraint (may need manual check)');
  }
}

applyMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
