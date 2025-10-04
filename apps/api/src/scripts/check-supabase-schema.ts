#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function checkSchema() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  console.log('Checking unified_picks schema in Supabase...\n');

  // Try to query the table structure
  const { data, error } = await supabase
    .from('unified_picks')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error querying table:', error);
  } else {
    console.log('Sample row (if any):', data);
    if (data && data.length > 0) {
      console.log('\nColumns found:', Object.keys(data[0]));
    }
  }

  // Try inserting a test row to see what columns are expected
  const testRow = {
    user_id: 1,
    pick_type: 'single',
    source: 'test',
    market: 'h2h',
    matchup: 'Test @ Test',
    game_date: new Date().toISOString(),
    price: 100,
    sport: 'NFL',
  };

  console.log('\nTrying to insert test row:', testRow);
  const { error: insertError } = await supabase
    .from('unified_picks')
    .insert(testRow);

  if (insertError) {
    console.error('Insert error:', insertError);
  } else {
    console.log('Insert successful!');
  }
}

checkSchema().catch(console.error);
