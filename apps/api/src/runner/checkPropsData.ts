/**
 * Check Props Data - Verify our props insertion worked
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPropsData() {
  console.log('📊 CHECKING PROPS DATA');
  console.log('='.repeat(30));
  
  const today = '2025-08-05';
  
  // Check props by source
  console.log('📋 PROPS BY SOURCE:');
  const { data: allProps } = await supabase
    .from('raw_props')
    .select('source, game_date, over_odds, under_odds')
    .eq('game_date', today);
    
  if (allProps) {
    const sourceCounts = allProps.reduce((acc, prop) => {
      const source = prop.source || 'null';
      if (!acc[source]) {
        acc[source] = { total: 0, withOdds: 0 };
      }
      acc[source].total++;
      if (prop.over_odds && prop.under_odds) {
        acc[source].withOdds++;
      }
      return acc;
    }, {} as Record<string, { total: number; withOdds: number }>);
    
    Object.entries(sourceCounts).forEach(([source, counts]) => {
      const percentage = counts.total > 0 ? (counts.withOdds / counts.total * 100).toFixed(1) : '0.0';
      console.log(`   ${source}: ${counts.total} props (${counts.withOdds} with odds = ${percentage}%)`);
    });
  }
  
  // Total counts
  const { count: totalToday } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('game_date', today);
    
  const { count: totalWithOdds } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('game_date', today)
    .not('over_odds', 'is', null)
    .not('under_odds', 'is', null);
    
  console.log(`\nTotal props for ${today}: ${totalToday || 0}`);
  console.log(`Props with complete odds: ${totalWithOdds || 0}`);
  
  if (totalToday && totalWithOdds) {
    const quality = (totalWithOdds / totalToday * 100).toFixed(1);
    console.log(`Overall odds quality: ${quality}%`);
  }
  
  // Sample recent good props
  const { data: goodProps } = await supabase
    .from('raw_props')
    .select('player_name, stat_type, over_odds, under_odds, source, created_at')
    .eq('game_date', today)
    .not('over_odds', 'is', null)
    .not('under_odds', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (goodProps && goodProps.length > 0) {
    console.log('\n📋 Recent props with complete odds:');
    goodProps.forEach((prop, i) => {
      console.log(`${i+1}. ${prop.player_name} ${prop.stat_type} - Over: ${prop.over_odds}, Under: ${prop.under_odds} (${prop.source})`);
    });
  }
}

checkPropsData().then(() => process.exit(0)).catch(console.error);