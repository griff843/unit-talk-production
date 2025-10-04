import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyConstraints() {
  console.log('🔍 Checking unified_picks indexes and constraints...\n');

  // Check all indexes on unified_picks table
  const { data: indexes, error } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = 'unified_picks'
          AND schemaname = 'public'
        ORDER BY indexname;
      `
    }) as any;

  if (error) {
    console.error('❌ Error fetching indexes:', error);
    return;
  }

  console.log('📋 Current Indexes on unified_picks:\n');
  if (indexes && indexes.length > 0) {
    indexes.forEach((idx: any) => {
      console.log(`Index: ${idx.indexname}`);
      console.log(`Definition: ${idx.indexdef}`);
      console.log('');
    });
  } else {
    console.log('No indexes found');
  }

  // Check for the specific old and new constraints
  const oldConstraintName = 'idx_unified_picks_external_ids';
  const newConstraintName = 'idx_unified_picks_unique_per_bookmaker';

  const hasOld = indexes?.some((idx: any) => idx.indexname === oldConstraintName);
  const hasNew = indexes?.some((idx: any) => idx.indexname === newConstraintName);

  console.log('\n🔍 Constraint Status:');
  console.log(`❌ Old constraint (${oldConstraintName}): ${hasOld ? 'STILL EXISTS (PROBLEM!)' : 'Dropped ✅'}`);
  console.log(`✅ New constraint (${newConstraintName}): ${hasNew ? 'Exists ✅' : 'MISSING (PROBLEM!)'}`);

  if (hasOld) {
    console.log('\n⚠️  CRITICAL: Old constraint still blocking multiple bookmakers!');
    console.log('   You need to manually drop it in Supabase SQL Editor:');
    console.log(`   DROP INDEX IF EXISTS public.${oldConstraintName};`);
  }

  if (!hasNew) {
    console.log('\n⚠️  CRITICAL: New bookmaker constraint not created!');
    console.log('   You need to run the migration in APPLY_THIS_SQL_TO_SUPABASE.sql');
  }
}

verifyConstraints().catch(console.error);
