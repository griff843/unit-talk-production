import path from 'node:path';
import fs from 'node:fs';
import { supabase as supabaseClient, isSupabaseConfigured } from '../../apps/api/src/services/supabaseClient';

/**
 * Global Jest setup: truncate relevant tables and seed baseline runtime config
 * Windows-safe, uses Supabase client from the repo.
 */
module.exports = async () => {
  if (!isSupabaseConfigured) {
    console.warn('[globalSetup] Supabase not configured. Skipping DB reset.');
    return;
  }

  const supabase = supabaseClient;

  const deleteAll = async (table: string) => {
    // Delete all rows in a portable way
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.warn(`[globalSetup] Failed to clear ${table}:`, error.message);
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

  // Baseline runtime/system config if such a table exists
  const tryUpsert = async (table: string, row: any) => {
    try {
      const { error } = await supabase.from(table).upsert(row, { onConflict: 'key' });
      if (error) console.warn(`[globalSetup] Upsert into ${table} failed: ${error.message}`);
    } catch (e: any) {
      // Silently ignore if table doesn't exist
    }
  };

  await tryUpsert('system_config', { key: 'FREEZE_MODE', value: false, updated_at: new Date().toISOString() });
  await tryUpsert('runtime_config', { key: 'FREEZE_MODE', value: false, updated_at: new Date().toISOString() });

  console.log('[globalSetup] Database reset complete.');
};

