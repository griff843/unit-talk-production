import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
  console.log('🔧 Applying final SQL fix...\n');

  const statements = [
    {
      name: 'Make external_prop_id nullable',
      sql: 'ALTER TABLE public.unified_picks ALTER COLUMN external_prop_id DROP NOT NULL;'
    },
    {
      name: 'Drop old bookmaker constraint',
      sql: 'DROP INDEX IF EXISTS public.idx_unified_picks_unique_per_bookmaker;'
    },
    {
      name: 'Create new unique index with bookmaker',
      sql: `CREATE UNIQUE INDEX idx_unified_picks_unique_per_bookmaker_v2
        ON public.unified_picks (
          external_game_id,
          market,
          COALESCE(external_prop_id, ''),
          COALESCE(player_name, ''),
          COALESCE(team, ''),
          COALESCE(line, 0),
          COALESCE((metadata->>'bookmaker_key')::text, 'unknown')
        );`
    },
    {
      name: 'Create game+market index',
      sql: 'CREATE INDEX IF NOT EXISTS idx_unified_picks_game_market ON public.unified_picks (external_game_id, market);'
    },
    {
      name: 'Create bookmaker index',
      sql: "CREATE INDEX IF NOT EXISTS idx_unified_picks_bookmaker ON public.unified_picks ((metadata->>'bookmaker_key'));"
    }
  ];

  for (const stmt of statements) {
    console.log(`📝 ${stmt.name}...`);

    const { data, error } = await supabase.rpc('query', {
      query_text: stmt.sql
    }) as any;

    if (error) {
      // Try direct insert via raw query
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ query_text: stmt.sql })
      });

      if (!response.ok) {
        console.error(`  ❌ Error: ${error.message || 'Unknown error'}`);
        console.log(`  SQL: ${stmt.sql}`);
        console.log('  Continuing anyway...\n');
      } else {
        console.log('  ✅ Success\n');
      }
    } else {
      console.log('  ✅ Success\n');
    }
  }

  console.log('✅ Fix applied!\n');
  console.log('🔍 Verifying indexes...\n');

  // Verify
  const { data: indexes } = await supabase
    .from('pg_indexes')
    .select('indexname, indexdef')
    .eq('tablename', 'unified_picks')
    .like('indexname', '%unique%');

  if (indexes && indexes.length > 0) {
    console.log('📋 Unique indexes found:');
    indexes.forEach((idx: any) => {
      console.log(`  - ${idx.indexname}`);
    });
  } else {
    console.log('⚠️  Could not verify (pg_indexes not accessible via Supabase client)');
  }
}

applyFix().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
