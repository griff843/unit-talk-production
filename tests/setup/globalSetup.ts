import { supabase as supabaseClient, isSupabaseConfigured } from '../../apps/api/src/services/supabaseClient';

/**
 * Global Jest setup: clear real tables and seed baseline runtime_config
 * Windows-safe, uses the repo's Supabase client.
 */
module.exports = async () => {
  if (!isSupabaseConfigured) {
    console.warn('[globalSetup] Supabase not configured. Skipping DB reset.');
    return;
  }

  const supabase = supabaseClient;

  const tables = ['raw_props', 'unified_picks', 'runtime_config'];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '');
      if (error) {
        console.warn(`[globalSetup] Failed to clear ${table}: ${error.message}`);
      }
    } catch (e: any) {
      console.warn(`[globalSetup] Skipped ${table}: ${e?.message || e}`);
    }
  }

  // Seed baseline runtime configuration if table exists
  try {
    const { error } = await supabase.from('runtime_config').upsert({
      id: 'test-config',
      shadow_mode: false,
      freeze_mode: false,
      safe_mode: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (error) {
      console.warn(`[globalSetup] Failed to seed runtime_config: ${error.message}`);
    } else {
      console.log('[globalSetup] Seeded baseline runtime_config');
    }
  } catch (e: any) {
    console.warn('[globalSetup] runtime_config not present, skipped');
  }

  console.log('[globalSetup] Database reset complete.');
};
