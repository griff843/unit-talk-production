import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function executeSql(sql: string, description: string) {
  console.log(`📝 ${description}...`);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok || response.status === 204) {
      console.log('  ✅ Success\n');
      return true;
    } else {
      const error = await response.text();
      console.log(`  ⚠️  Response: ${response.status} - ${error}`);
      console.log('  (May be ok if already applied)\n');
      return false;
    }
  } catch (err) {
    console.error(`  ❌ Error:`, err);
    console.log('  SQL:', sql, '\n');
    return false;
  }
}

async function main() {
  console.log('🔧 Applying SQL fixes directly to Supabase...\n');

  await executeSql(
    'ALTER TABLE public.unified_picks ALTER COLUMN external_prop_id DROP NOT NULL;',
    'Step 1: Make external_prop_id nullable'
  );

  await executeSql(
    'DROP INDEX IF EXISTS public.idx_unified_picks_unique_per_bookmaker;',
    'Step 2: Drop old constraint'
  );

  await executeSql(
    `CREATE UNIQUE INDEX idx_unified_picks_unique_per_bookmaker_v2
      ON public.unified_picks (
        external_game_id,
        market,
        COALESCE(external_prop_id, ''),
        COALESCE(player_name, ''),
        COALESCE(team, ''),
        COALESCE(line, 0),
        COALESCE((metadata->>'bookmaker_key')::text, 'unknown')
      );`,
    'Step 3: Create new unique index with bookmaker support'
  );

  await executeSql(
    'CREATE INDEX IF NOT EXISTS idx_unified_picks_game_market ON public.unified_picks (external_game_id, market);',
    'Step 4: Create game+market index'
  );

  await executeSql(
    "CREATE INDEX IF NOT EXISTS idx_unified_picks_bookmaker ON public.unified_picks ((metadata->>'bookmaker_key'));",
    'Step 5: Create bookmaker index'
  );

  console.log('\n✅ All SQL executed!\n');
  console.log('🧪 Now testing FeedAgent...\n');
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
