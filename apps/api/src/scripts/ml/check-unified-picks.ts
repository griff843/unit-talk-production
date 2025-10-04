/**
 * Check unified_picks dataset
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkUnifiedPicks() {
  console.log('🔍 Checking unified_picks table...\n');

  const { count, error } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Total unified_picks: ${count?.toLocaleString()}\n`);

  // Get sample to see structure
  const { data: sample } = await supabase
    .from('unified_picks')
    .select('*')
    .limit(5);

  console.log('Sample picks:');
  console.log(JSON.stringify(sample, null, 2));

  // Get sport breakdown
  const { data: allPicks } = await supabase
    .from('unified_picks')
    .select('sport, game_date, market_type, stat_type');

  const sportBreakdown: Record<string, any> = {};
  allPicks?.forEach(p => {
    const sport = p.sport || 'UNKNOWN';
    if (!sportBreakdown[sport]) {
      sportBreakdown[sport] = { count: 0, minDate: null, maxDate: null };
    }
    sportBreakdown[sport].count++;

    const gameDate = p.game_date;
    if (gameDate) {
      if (!sportBreakdown[sport].minDate || gameDate < sportBreakdown[sport].minDate) {
        sportBreakdown[sport].minDate = gameDate;
      }
      if (!sportBreakdown[sport].maxDate || gameDate > sportBreakdown[sport].maxDate) {
        sportBreakdown[sport].maxDate = gameDate;
      }
    }
  });

  console.log('\nSport Breakdown:');
  console.table(sportBreakdown);

  process.exit(0);
}

checkUnifiedPicks();
