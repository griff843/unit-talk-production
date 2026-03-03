/**
 * Check Picks Tables
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkPicksTables() {
  console.log('📊 CHECKING PICKS TABLES');
  console.log('='.repeat(30));

  // Check if unified_picks table exists
  try {
    const { error: finalPicksError } = await supabase
      .from('unified_picks')
      .select('count')
      .limit(1);

    if (finalPicksError) {
      console.log(`unified_picks table: ❌ Does not exist (${finalPicksError.message})`);
    } else {
      console.log('unified_picks table: ✅ Exists');
    }
  } catch (e) {
    console.log('unified_picks table: ❌ Does not exist');
  }

  // Check if unified_picks table exists
  try {
    const { count: unifiedCount } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    console.log(`unified_picks table: ✅ Exists (${unifiedCount || 0} records)`);

    // Show unified_picks schema
    const { data: samplePick } = await supabase.from('unified_picks').select('*').limit(1);

    if (samplePick && samplePick.length > 0) {
      console.log('\n📋 unified_picks columns:');
      console.log(Object.keys(samplePick[0]).join(', '));
    }
  } catch (e) {
    console.log('unified_picks table: ❌ Does not exist');
  }

  console.log('\n🔧 ISSUE IDENTIFIED:');
  console.log('✅ GradingAgent tries to insert into unified_picks table');
  console.log('❌ But we use unified_picks table in v3.0.0 database');
  console.log('🚀 Need to update GradingAgent to use unified_picks');

  return true;
}

checkPicksTables()
  .then(() => process.exit(0))
  .catch(console.error);
