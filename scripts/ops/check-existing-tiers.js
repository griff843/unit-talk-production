/**
 * Check Existing Tiers - Phase 13
 * Query existing tier values to understand the constraint
 * 
 * @date 2025-10-31
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env.shared' });
require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkExistingTiers() {
  console.log('[Check Existing Tiers] Starting...');

  try {
    // Get distinct tier values
    const { data: users, error } = await supabase
      .from('users')
      .select('tier, username')
      .limit(20);

    if (error) {
      console.error('[Check Existing Tiers] Error:', error);
      throw error;
    }

    console.log('[Check Existing Tiers] Sample users and their tiers:');
    console.log(JSON.stringify(users, null, 2));

    // Get unique tier values
    const uniqueTiers = [...new Set(users.map(u => u.tier))];
    console.log('\n[Check Existing Tiers] Unique tier values in database:');
    console.log(JSON.stringify(uniqueTiers, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('[Check Existing Tiers] Failed:', error);
    process.exit(1);
  }
}

checkExistingTiers();

