#!/usr/bin/env tsx
/**
 * Apply constraint fix to Supabase cloud via RPC or direct SQL
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function applyFix() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  console.log('⚠️  IMPORTANT: This script requires running SQL directly in Supabase SQL Editor\n');
  console.log('📋 Copy and paste the following SQL into your Supabase SQL Editor:\n');
  console.log('─'.repeat(80));

  const sql = `
-- Fix NFL props constraint issue
BEGIN;

-- Drop the problematic unique constraint
DROP INDEX IF EXISTS idx_unified_picks_external_ids;

-- Create proper dedup constraints
-- For player props: external_game_id + external_prop_id should be unique (when NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_picks_player_props_dedup
ON unified_picks (external_game_id, external_prop_id)
WHERE external_prop_id IS NOT NULL;

-- For core markets with NULL external_prop_id: use composite key
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_picks_core_markets_dedup
ON unified_picks (
  source,
  market,
  selection,
  bookmaker_key,
  game_date,
  COALESCE(line, 0)
)
WHERE external_prop_id IS NULL;

COMMIT;

-- Verify new constraints
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND (indexname LIKE '%dedup%' OR indexname LIKE '%external%')
ORDER BY indexname;
`;

  console.log(sql);
  console.log('─'.repeat(80));
  console.log('\n✅ After running this SQL in Supabase:');
  console.log('   1. Check the output to confirm both indexes were created');
  console.log('   2. Run the single49ersRams.ts script again');
  console.log('   3. Verify that NFL props write successfully\n');

  console.log('🔗 Supabase SQL Editor URL:');
  console.log(`   ${process.env.SUPABASE_URL}/project/_/sql\n`);
}

applyFix().catch(console.error);
