#!/usr/bin/env tsx
/**
 * Minimal test with only columns that exist in Supabase schema cache
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testMinimalInsert() {
  console.log('Testing with absolute minimum columns...\n');

  // Based on the schema we saw earlier, use only these confirmed columns:
  const testProp = {
    sport: 'baseball_mlb',
    player_name: 'Test Player',
    stat_type: 'hits',
    line: 1.5,
    over_odds: -110,
    under_odds: -110,
    external_id: `test_${Date.now()}_${Math.random()}`,
    game_id: `game_${Date.now()}`
  };

  try {
    const { data, error } = await supabase
      .from('raw_props')
      .insert([testProp])
      .select('id, external_id');

    if (error) {
      console.error('❌ Insert failed:', error.message);
      console.error('Details:', error);
      return false;
    }

    console.log('✅ Insert successful!');
    console.log('Inserted:', data);
    return true;
  } catch (err) {
    console.error('❌ Exception:', err);
    return false;
  }
}

testMinimalInsert().then(success => {
  process.exit(success ? 0 : 1);
});
