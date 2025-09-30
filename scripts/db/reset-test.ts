/**
 * Windows-safe DB reset for test environment
 * Clears only existing tables
 */

import { supabase } from "../../apps/api/src/services/supabaseClient"; // ✅ correct path, not ../../src/shared/db

async function resetTestDb() {
  console.log("🔄 Resetting test database...");

  const tables = ["raw_props", "unified_picks", "runtime_config"];

  for (const table of tables) {
    try {
      console.log(`[reset-test] Clearing ${table}...`);
      const { error } = await supabase.from(table).delete().neq("id", ""); 
      if (error) throw error;
    } catch (err: any) {
      console.warn(`[reset-test] Skipped ${table}: ${err.message || err}`);
    }
  }

  // Seed baseline runtime config
  try {
    const { error } = await supabase.from("runtime_config").upsert({
      id: "test-config",
      shadow_mode: false,
      freeze_mode: false,
      safe_mode: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (error) throw error;

    console.log("✅ runtime_config baseline seeded");
  } catch (err: any) {
    console.warn("[reset-test] runtime_config not present, skipped");
  }

  console.log("✅ Test DB reset complete.");
  process.exit(0);
}

resetTestDb().catch((err: any) => {
  console.error("❌ Error resetting test DB:", err.message || err);
  process.exit(1);
});
