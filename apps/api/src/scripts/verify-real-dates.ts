#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function verifyActualDates() {
  const today = new Date();
  console.log('🗓️  TODAY IS:', today.toDateString(), '\n');
  console.log('='.repeat(70));

  // Check actual NFL data dates
  const { data: nflDates } = await supabase
    .from('market_props')
    .select('game_date, created_at, player_name, market')
    .eq('sport', 'NFL')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n🏈 NFL PROPS - ACTUAL DATES:');
  if (nflDates && nflDates.length > 0) {
    nflDates.forEach((p, i) => {
      const gameDate = new Date(p.game_date);
      const createdDate = new Date(p.created_at);
      console.log(`  [${i + 1}] ${p.player_name} - ${p.market}`);
      console.log(`      Game Date: ${gameDate.toDateString()}`);
      console.log(`      Ingested: ${createdDate.toDateString()} ${createdDate.toTimeString().split(' ')[0]}`);
    });
  } else {
    console.log('  ⚠️  No NFL props found');
  }

  // Check MLB data dates
  const { data: mlbDates } = await supabase
    .from('market_props')
    .select('game_date, created_at, player_name, market')
    .eq('sport', 'MLB')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n⚾ MLB PROPS - ACTUAL DATES:');
  if (mlbDates && mlbDates.length > 0) {
    mlbDates.forEach((p, i) => {
      const gameDate = new Date(p.game_date);
      const createdDate = new Date(p.created_at);
      console.log(`  [${i + 1}] ${p.player_name} - ${p.market}`);
      console.log(`      Game Date: ${gameDate.toDateString()}`);
      console.log(`      Ingested: ${createdDate.toDateString()} ${createdDate.toTimeString().split(' ')[0]}`);
    });
  } else {
    console.log('  ⚠️  No MLB props found');
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 VALIDATION:\n');

  const todayStr = today.toDateString();
  const nflToday = nflDates?.some(p => new Date(p.created_at).toDateString() === todayStr);
  const mlbToday = mlbDates?.some(p => new Date(p.created_at).toDateString() === todayStr);

  console.log(`NFL props ingested TODAY: ${nflToday ? '✅ YES' : '❌ NO'}`);
  console.log(`MLB props ingested TODAY: ${mlbToday ? '✅ YES' : '❌ NO'}`);

  if (nflToday && mlbToday) {
    console.log('\n🎯 TIER 1 STATUS: ✅ CONFIRMED - Props flowing today');
  } else {
    console.log('\n🎯 TIER 1 STATUS: ❌ NOT CONFIRMED - Data ingestion issue');
    console.log('\n🔧 ACTION NEEDED: Check FeedAgent and data ingestion pipeline');
  }

  console.log('');
}

verifyActualDates().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
