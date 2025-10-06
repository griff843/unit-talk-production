#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function comprehensiveCheck() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('🔍 COMPREHENSIVE SPORT DISTRIBUTION CHECK\n');
  console.log('='.repeat(80));

  // Get total count
  const { count: totalCount } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal records in table: ${totalCount?.toLocaleString()}\n`);

  // Check each major sport individually
  const sports = ['MLB', 'NFL', 'NBA', 'NHL'];
  
  console.log('Sport-by-Sport Count:');
  console.log('-'.repeat(50));
  
  for (const sport of sports) {
    const { count } = await supabase
      .from('settled_outcomes')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    console.log(`${sport.padEnd(10)} ${(count || 0).toLocaleString().padStart(12)}`);
  }

  // Check for unknown/null sports
  const { count: unknownCount } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true })
    .is('sport', null);

  console.log(`${'NULL'.padEnd(10)} ${(unknownCount || 0).toLocaleString().padStart(12)}`);

  // Get sample from each sport with actual_value
  console.log('\n\nSample Data by Sport:');
  console.log('='.repeat(80));

  for (const sport of sports) {
    const { data, count } = await supabase
      .from('settled_outcomes')
      .select('player_name, market_type, line, actual_value, outcome, game_date', { count: 'exact' })
      .eq('sport', sport)
      .not('actual_value', 'is', null)
      .limit(3);

    console.log(`\n${sport} (${(count || 0).toLocaleString()} with actual_value):`);
    console.log('-'.repeat(80));

    if (data && data.length > 0) {
      data.forEach(r => {
        console.log(`  ${r.player_name?.substring(0, 20).padEnd(20)} | ${r.market_type?.substring(0, 20).padEnd(20)} | Line: ${r.line?.toFixed(1).padStart(5)} | Actual: ${r.actual_value?.toFixed(1).padStart(5)} | ${r.outcome} | ${r.game_date}`);
      });
    } else {
      console.log('  No data found');
    }
  }

  // Check date range
  console.log('\n\nDate Range Analysis:');
  console.log('='.repeat(80));

  const { data: dateRange } = await supabase
    .from('settled_outcomes')
    .select('game_date')
    .order('game_date', { ascending: true })
    .limit(1);

  const { data: dateRangeMax } = await supabase
    .from('settled_outcomes')
    .select('game_date')
    .order('game_date', { ascending: false })
    .limit(1);

  console.log(`Earliest date: ${dateRange?.[0]?.game_date || 'N/A'}`);
  console.log(`Latest date:   ${dateRangeMax?.[0]?.game_date || 'N/A'}`);

  // Check settlement quality
  console.log('\n\nSettlement Quality:');
  console.log('='.repeat(80));

  const { count: withActualValue } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true })
    .not('actual_value', 'is', null);

  const { count: nullActualValue } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true })
    .is('actual_value', null);

  console.log(`Records with actual_value:     ${(withActualValue || 0).toLocaleString()}`);
  console.log(`Records with NULL actual_value: ${(nullActualValue || 0).toLocaleString()}`);
  console.log(`Settlement rate: ${((withActualValue || 0) / (totalCount || 1) * 100).toFixed(2)}%`);

  console.log('\n' + '='.repeat(80));
}

comprehensiveCheck().catch(console.error);
