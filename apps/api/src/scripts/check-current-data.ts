#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  console.log('📊 Current Data Status\n');

  // Check market_props
  const { data: sample, count: total } = await supabase
    .from('market_props')
    .select('player_name, market, sport, selection', { count: 'exact' })
    .gte('game_date', new Date().toISOString().split('T')[0])
    .limit(20);

  console.log(`Total market_props today: ${total}\n`);
  console.log('Sample props:');
  sample?.forEach((p, i) => {
    console.log(`  ${i+1}. ${p.player_name} | ${p.market} | ${p.selection || 'N/A'} | ${p.sport}`);
  });

  // Market breakdown
  const { data: allMarkets } = await supabase
    .from('market_props')
    .select('market')
    .gte('game_date', new Date().toISOString().split('T')[0]);

  const counts: Record<string, number> = {};
  allMarkets?.forEach(m => {
    counts[m.market] = (counts[m.market] || 0) + 1;
  });

  console.log('\nMarket breakdown:');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([market, count]) => {
      console.log(`  ${market}: ${count}`);
    });
}

check().catch(console.error);
