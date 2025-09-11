import { supabase as supabaseClient, isSupabaseConfigured } from '../../apps/api/src/services/supabaseClient';

async function main() {
  if (!isSupabaseConfigured) {
    console.error('[reset-test] Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(0);
  }

  const supabase = supabaseClient;

  const deleteAll = async (table: string) => {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.warn(`[reset-test] Failed to clear ${table}:`, error.message);
    }
  };

  const tables = [
    'unified_picks',
    'raw_props',
    'slo_incidents',
    'system_metrics',
    'audit_log',
    'shadow_decisions'
  ];

  for (const t of tables) {
    await deleteAll(t);
  }

  // Reset FREEZE_MODE to off
  try { await supabase.from('system_config').upsert({ key: 'FREEZE_MODE', value: false, updated_at: new Date().toISOString() }); } catch {}
  try { await supabase.from('runtime_config').upsert({ key: 'FREEZE_MODE', value: false, updated_at: new Date().toISOString() }); } catch {}

  console.log('[reset-test] Database reset complete.');
}

main().catch((err) => {
  console.error('[reset-test] Unexpected error:', err);
  process.exit(1);
});

