/**
 * Check Tier Constraint - Phase 13
 * Query the actual tier constraint in production database
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

async function checkTierConstraint() {
  console.log('[Check Tier Constraint] Starting...');

  try {
    // Query the actual constraint definition
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          conname AS constraint_name,
          pg_get_constraintdef(oid) AS constraint_definition
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname LIKE '%tier%';
      `
    });

    if (error) {
      console.error('[Check Tier Constraint] Error:', error);
      throw error;
    }

    console.log('[Check Tier Constraint] Results:');
    console.log(JSON.stringify(data, null, 2));

    // Also check what tier values exist in the table
    const { data: tierData, error: tierError } = await supabase
      .from('users')
      .select('tier')
      .limit(10);

    if (!tierError) {
      console.log('[Check Tier Constraint] Sample tier values:');
      console.log(JSON.stringify(tierData, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('[Check Tier Constraint] Failed:', error);
    process.exit(1);
  }
}

checkTierConstraint();

