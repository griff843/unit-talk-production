#!/usr/bin/env npx tsx
import { supabaseClient } from '../src/services/supabaseClient';

async function checkRealPlayers() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabaseClient
    .from('raw_props')
    .select('player_name, stat_type, line, over_odds, under_odds, sport')
    .not('player_name', 'eq', 'unknown')
    .not('over_odds', 'is', null)
    .not('under_odds', 'is', null)
    .gte('created_at', today)
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('📊 REAL PLAYER PROPS FROM TODAY:', data?.length || 0);
  data?.forEach((prop, i) => {
    console.log(`${i+1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport})`);
    console.log(`   Over: ${prop.over_odds}, Under: ${prop.under_odds}`);
  });
}

checkRealPlayers().catch(console.error);