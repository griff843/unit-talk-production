#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testWNBASupport() {
  console.log('🏀 Testing WNBA Support...');

  try {
    const testTicket = {
      bet_slip_id: crypto.randomUUID(),
      capper: 'AutoTest',
      ticket_type: 'single',
      sport: 'WNBA',
      game_date: new Date().toISOString().split('T')[0],
      user_tier: 'vip_plus',
      unit_size: 2.0,
      odds_format: 'AMERICAN',
      auto_parlay: false,
      confidence_level: 8,
      bet_type: 'player_prop',
      market_type: 'player_prop',
      status: 'submitted',
      timestamp: new Date().toISOString(),
      timezone: 'America/New_York',
      current_step: 4,
      completed_steps: [1, 2, 3, 4],
      legs: JSON.stringify([
        {
          id: crypto.randomUUID(),
          sport: 'WNBA',
          player_name: "A'ja Wilson",
          prop_type: 'points',
          line: '22.5',
          odds: '-110',
          bet_type: 'player_prop',
          team: 'Las Vegas Aces',
          opponent: 'Seattle Storm',
        },
      ]),
      game_selections: JSON.stringify([
        {
          game_id: crypto.randomUUID(),
          selection: "A'ja Wilson Over 22.5 Points",
          odds: '-110',
          line: '22.5',
        },
      ]),
      notes: "WNBA test - A'ja Wilson points prop",
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('smart_tickets')
      .insert([testTicket])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ WNBA Support: SUCCESS');
    console.log(`   → Created WNBA ticket: ${data.bet_slip_id}`);
    console.log(`   → Player: A'ja Wilson | Prop: Points O22.5`);
    console.log(`   → Sport: ${data.sport} | Market: ${data.market_type}`);

    // Cleanup
    await supabase.from('smart_tickets').delete().eq('bet_slip_id', data.bet_slip_id);
    console.log('   → Test data cleaned up');

    return true;
  } catch (error) {
    console.error('❌ WNBA Support: FAILED', error.message);
    return false;
  }
}

async function testEnhancedNCAAF() {
  console.log('🏈 Testing Enhanced NCAAF Support...');

  try {
    const testTicket = {
      bet_slip_id: crypto.randomUUID(),
      capper: 'AutoTest',
      ticket_type: 'parlay',
      sport: 'NCAAF',
      game_date: new Date().toISOString().split('T')[0],
      user_tier: 'vip_plus',
      unit_size: 3.0,
      odds_format: 'AMERICAN',
      auto_parlay: true,
      confidence_level: 9,
      bet_type: 'parlay',
      market_type: 'pre_game',
      status: 'submitted',
      timestamp: new Date().toISOString(),
      timezone: 'America/New_York',
      current_step: 4,
      completed_steps: [1, 2, 3, 4],
      legs: JSON.stringify([
        {
          id: crypto.randomUUID(),
          sport: 'NCAAF',
          player_name: 'Caleb Williams',
          prop_type: 'passing_yards',
          line: '285.5',
          odds: '-110',
          bet_type: 'player_prop',
          team: 'USC',
          opponent: 'Oregon',
        },
        {
          id: crypto.randomUUID(),
          sport: 'NCAAF',
          bet_type: 'spread',
          line: '-7.5',
          odds: '-110',
          team: 'Georgia',
          opponent: 'Alabama',
        },
      ]),
      game_selections: JSON.stringify([
        {
          game_id: crypto.randomUUID(),
          selection: 'Caleb Williams Over 285.5 Passing Yards',
          odds: '-110',
          line: '285.5',
        },
        {
          game_id: crypto.randomUUID(),
          selection: 'Georgia -7.5',
          odds: '-110',
          line: '-7.5',
        },
      ]),
      notes: 'Enhanced NCAAF test - 2-leg parlay with passing yards prop + spread',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('smart_tickets')
      .insert([testTicket])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Enhanced NCAAF: SUCCESS');
    console.log(`   → Created NCAAF parlay: ${data.bet_slip_id}`);
    console.log(`   → 2-leg parlay: Passing yards prop + spread`);
    console.log(`   → Sport: ${data.sport} | Type: ${data.ticket_type}`);

    // Cleanup
    await supabase.from('smart_tickets').delete().eq('bet_slip_id', data.bet_slip_id);
    console.log('   → Test data cleaned up');

    return true;
  } catch (error) {
    console.error('❌ Enhanced NCAAF: FAILED', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing WNBA & Enhanced NCAAF Support');
  console.log('='.repeat(50));

  const wnbaResult = await testWNBASupport();
  const ncaafResult = await testEnhancedNCAAF();

  console.log('\n📊 Results:');
  console.log(`   WNBA Support: ${wnbaResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Enhanced NCAAF: ${ncaafResult ? '✅ PASS' : '❌ FAIL'}`);

  const overallSuccess = wnbaResult && ncaafResult;
  console.log(`\n🎯 Overall: ${overallSuccess ? '✅ SUCCESS (100%)' : '❌ PARTIAL SUCCESS'}`);

  if (overallSuccess) {
    console.log('\n🏆 Sports expansion complete! Ready for elite styling phase.');
  }
}

main().catch(console.error);
