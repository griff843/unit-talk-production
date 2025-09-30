#!/usr/bin/env npx tsx
import { supabaseClient } from '../src/services/supabaseClient';

async function checkPropsToday() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabaseClient
    .from('raw_props')
    .select('player_name, stat_type, line, over_odds, under_odds, sport, created_at')
    .gte('created_at', today)
    .order('created_at', { ascending: false });

  console.log(`Raw props from today (${today}):`, data?.length || 0);
  if (data && data.length > 0) {
    console.log('Sample props:');
    data.slice(0, 5).forEach((prop, i) => {
      console.log(`  ${i+1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport})`);
      console.log(`     Over: ${prop.over_odds}, Under: ${prop.under_odds}`);
    });
  }
}

checkPropsToday().catch(console.error);