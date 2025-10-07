#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkMNF() {
  console.log('🏈 MONDAY NIGHT FOOTBALL - Chiefs vs Jags (Oct 6, 2025)\n');
  console.log('='.repeat(70));

  // Check most recent NFL props to understand the data
  console.log('\n📅 MOST RECENT NFL PROPS:');
  const { data: recent } = await supabase
    .from('market_props')
    .select('player_name, game_date, market, line, odds, created_at')
    .eq('sport', 'NFL')
    .order('created_at', { ascending: false })
    .limit(10);

  if (recent && recent.length > 0) {
    recent.forEach((p, i) => {
      const gameDate = new Date(p.game_date).toLocaleDateString();
      const createdDate = new Date(p.created_at).toLocaleString();
      console.log(`  ${i + 1}. ${p.player_name} - ${p.market} ${p.line}`);
      console.log(`     Game: ${gameDate} | Ingested: ${createdDate}`);
    });
  } else {
    console.log('  ⚠️ No recent NFL props found');
  }

  // Check total NFL props
  console.log('\n📊 NFL DATA SUMMARY:');
  const { count: totalNFL } = await supabase
    .from('market_props')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');

  console.log(`   Total NFL props in system: ${totalNFL || 0}`);

  // Check if data is current or historical
  const { data: dateRange } = await supabase
    .from('market_props')
    .select('game_date')
    .eq('sport', 'NFL')
    .order('game_date', { ascending: false })
    .limit(1);

  if (dateRange && dateRange.length > 0) {
    const latestGame = new Date(dateRange[0].game_date);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - latestGame.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`   Latest NFL game date: ${latestGame.toLocaleDateString()}`);
    console.log(`   Days ago: ${daysDiff}`);

    if (daysDiff > 7) {
      console.log('\n   ⚠️  NFL data appears to be outdated (>7 days old)');
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🎯 DIAGNOSIS:\n');

  if (!totalNFL || totalNFL === 0) {
    console.log('❌ NO NFL DATA - Ingestion not working');
    console.log('\n🚨 TIER 1 STATUS: ❌ NOT CONFIRMED');
  } else {
    const latestGame = dateRange && dateRange.length > 0 ? new Date(dateRange[0].game_date) : null;
    const isRecent = latestGame && (new Date().getTime() - latestGame.getTime()) < 7 * 24 * 60 * 60 * 1000;

    if (isRecent) {
      console.log('✅ NFL DATA PRESENT AND RECENT');
      console.log(`   ${totalNFL} props available`);
      console.log('\n🎯 TIER 1 STATUS: ✅ CONFIRMED');
    } else {
      console.log('⚠️  NFL DATA PRESENT BUT OUTDATED');
      console.log('   Data ingestion may need restart or API issue');
      console.log('\n🎯 TIER 1 STATUS: ⚠️  PARTIAL - Historical data only');
    }
  }

  console.log('');
}

checkMNF().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
