#!/usr/bin/env tsx
/**
 * Simple test to validate raw_props schema and insert capability
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testInsert() {
  console.log('Testing raw_props insert with minimal data...\n');

  const testProp = {
    external_game_id: `test_game_${Date.now()}`,
    external_prop_id: `test_prop_${Date.now()}_${Math.random()}`,
    sport: 'baseball_mlb',
    game_date: new Date().toISOString(),
    home_team: 'Test Team A',
    away_team: 'Test Team B',
    bookmaker_key: 'draftkings',
    bookmaker_title: 'DraftKings',
    market: 'h2h',
    player_name: 'Test Player',
    stat_type: 'hits',
    line: 1.5,
    over_odds: -110,
    under_odds: -110,
    outcome_name: 'over',
    price: -110,
    odds: -110
  };

  try {
    const { data, error } = await supabase
      .from('raw_props')
      .insert([testProp])
      .select('id, external_prop_id');

    if (error) {
      console.error('❌ Insert failed:', error.message);
      console.error('Details:', error);
      return false;
    }

    console.log('✅ Insert successful!');
    console.log('Inserted prop:', data);
    return true;
  } catch (err) {
    console.error('❌ Exception:', err);
    return false;
  }
}

testInsert().then(success => {
  process.exit(success ? 0 : 1);
});
