#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

async function checkPropTypes() {
  console.log('Checking prop types in raw_props...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  
  try {
    const { data, error } = await supabase
      .from('raw_props')
      .select('stat_type, market_type, bet_type, player_name, line, sport, external_game_id')
      .not('external_game_id', 'is', null)
      .is('outcome', null)
      .limit(10);
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('\nSample ungraded props:');
    data?.forEach((prop, i) => {
      console.log(`${i+1}. ${prop.player_name} - ${prop.stat_type} - ${prop.sport} - Line: ${prop.line} - Game: ${prop.external_game_id}`);
    });
    
    // Get distinct stat types
    const { data: statTypes } = await supabase
      .from('raw_props')
      .select('stat_type')
      .not('stat_type', 'is', null)
      .limit(50);
    
    const uniqueStatTypes = [...new Set(statTypes?.map(s => s.stat_type) || [])];
    console.log('\nDistinct stat types found:');
    console.log(uniqueStatTypes.slice(0, 20).join(', '));
    
    // Check specific player for MLB
    const { data: mlbSample } = await supabase
      .from('raw_props')
      .select('*')
      .eq('sport', 'MLB')
      .not('external_game_id', 'is', null)
      .is('outcome', null)
      .limit(1);
    
    if (mlbSample && mlbSample.length > 0) {
      console.log('\nSample MLB prop structure:');
      console.log('External Game ID:', mlbSample[0].external_game_id);
      console.log('Player:', mlbSample[0].player_name);
      console.log('Stat Type:', mlbSample[0].stat_type);
      console.log('Line:', mlbSample[0].line);
      console.log('Game Date:', mlbSample[0].game_date);
    }
    
  } catch (err) {
    console.error('Failed to check prop types:', err);
  }
}

checkPropTypes();