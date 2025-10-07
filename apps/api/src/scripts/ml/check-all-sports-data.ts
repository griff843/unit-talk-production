import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkAllSports() {
  console.log('🔍 Checking ACTUAL data for ALL sports\n');

  const sports = ['MLB', 'NBA', 'NHL', 'NFL'];

  for (const sport of sports) {
    const { count, error } = await supabase
      .from('settled_outcomes')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('actual_value', 'is', null)
      .in('outcome', ['win', 'loss']);

    if (error) {
      console.log(`❌ ${sport}: Error - ${error.message}`);
    } else {
      console.log(`${sport.padEnd(4)}: ${(count || 0).toLocaleString().padStart(10)} trainable outcomes`);
    }
  }

  // Also check total
  const { count: total } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true })
    .not('actual_value', 'is', null)
    .in('outcome', ['win', 'loss']);

  console.log('='.repeat(50));
  console.log(`TOTAL: ${(total || 0).toLocaleString().padStart(10)} trainable outcomes`);
}

checkAllSports();
