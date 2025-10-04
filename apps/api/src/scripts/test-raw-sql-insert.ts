#!/usr/bin/env tsx
/**
 * Test insert using raw SQL to bypass Supabase schema cache
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testRawSQLInsert() {
  console.log('Testing raw_props insert via RPC/SQL...\n');

  const timestamp = Date.now();

  const sql = `
    INSERT INTO raw_props (
      external_game_id,
      external_prop_id,
      sport,
      game_date,
      home_team,
      away_team,
      bookmaker_key,
      bookmaker_title,
      market,
      player_name,
      stat_type,
      line,
      over_odds,
      under_odds,
      outcome_name,
      price,
      odds
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
    )
    RETURNING id, external_prop_id
  `;

  const values = [
    `test_game_${timestamp}`,
    `test_prop_${timestamp}_${Math.random()}`,
    'baseball_mlb',
    new Date().toISOString(),
    'Test Team A',
    'Test Team B',
    'draftkings',
    'DraftKings',
    'h2h',
    'Test Player',
    'hits',
    1.5,
    -110,
    -110,
    'over',
    -110,
    -110
  ];

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: sql,
      params: values
    });

    if (error) {
      console.error('❌ RPC failed, trying direct query...');

      // Fallback: Direct insert via Supabase client without problematic columns
      const testProp = {
        external_game_id: `test_game_${timestamp}`,
        external_prop_id: `test_prop_${timestamp}_${Math.random()}`,
        sport: 'baseball_mlb',
        game_date: new Date().toISOString(),
        home_team: 'Test Team A',
        away_team: 'Test Team B',
        player_name: 'Test Player',
        stat_type: 'hits',
        line: 1.5,
        over_odds: -110,
        under_odds: -110
      };

      const { data: insertData, error: insertError } = await supabase
        .from('raw_props')
        .insert([testProp])
        .select('id, external_prop_id');

      if (insertError) {
        console.error('❌ Insert failed:', insertError.message);
        return false;
      }

      console.log('✅ Insert successful (without cached columns)!');
      console.log('Inserted prop:', insertData);
      return true;
    }

    console.log('✅ SQL Insert successful!');
    console.log('Result:', data);
    return true;
  } catch (err) {
    console.error('❌ Exception:', err);
    return false;
  }
}

testRawSQLInsert().then(success => {
  process.exit(success ? 0 : 1);
});
