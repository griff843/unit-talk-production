import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkRealData() {
  console.log('📊 Checking REAL data distribution in settled_outcomes\n');

  // Get 10K sample with win/loss filter to see actual trainable data
  const { data, error } = await supabase
    .from('settled_outcomes')
    .select('sport, outcome')
    .not('actual_value', 'is', null)
    .in('outcome', ['win', 'loss'])
    .limit(10000);

  if (error) {
    console.log('❌ Error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('❌ No trainable data found (win/loss outcomes with actual_value)');
    process.exit(1);
  }

  const sportCounts: Record<string, number> = {};
  data.forEach(row => {
    sportCounts[row.sport] = (sportCounts[row.sport] || 0) + 1;
  });

  console.log(`Sample size: ${data.length} outcomes\n`);
  console.log('Sport Distribution (trainable win/loss data):');
  console.log('='.repeat(60));

  const totalEstimate = 2298561;
  Object.entries(sportCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      const pct = ((count / data.length) * 100).toFixed(1);
      const estimated = Math.round((count / data.length) * totalEstimate);
      console.log(`${sport.padEnd(6)} : ${count.toString().padStart(5)} samples (${pct.padStart(5)}%) -> ~${estimated.toLocaleString().padStart(10)} total`);
    });

  console.log('='.repeat(60));

  // Now check if we can actually fetch some MLB data
  console.log('\n🔍 Testing MLB data fetch (limit 1000)...\n');

  const { data: mlbData, error: mlbError } = await supabase
    .from('settled_outcomes')
    .select('*')
    .eq('sport', 'MLB')
    .not('actual_value', 'is', null)
    .in('outcome', ['win', 'loss'])
    .limit(1000);

  if (mlbError) {
    console.log('❌ MLB fetch error:', mlbError.message);
  } else if (mlbData) {
    console.log(`✅ Successfully fetched ${mlbData.length} MLB outcomes`);
    console.log('First outcome:', {
      sport: mlbData[0]?.sport,
      player: mlbData[0]?.player_name,
      market: mlbData[0]?.market_type,
      line: mlbData[0]?.line,
      actual: mlbData[0]?.actual_value,
      outcome: mlbData[0]?.outcome
    });
  }

  process.exit(0);
}

checkRealData();
