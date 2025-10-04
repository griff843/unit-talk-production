#!/usr/bin/env tsx
/**
 * Check constraints on Supabase cloud database
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function checkConstraints() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  console.log('Checking for existing NFL props in cloud database...\n');

  // Check for existing data for this game
  const { data: existing, error } = await supabase
    .from('unified_picks')
    .select('id, source, market, selection, external_game_id, external_prop_id, bookmaker_key, game_date')
    .eq('external_game_id', 'c4b72eabb3d557e73022ec730d8e3944');

  if (error) {
    console.error('Error querying:', error);
  } else {
    console.log(`Found ${existing?.length || 0} existing picks for this game`);
    if (existing && existing.length > 0) {
      console.log('\nSample existing picks:');
      existing.slice(0, 5).forEach((p, i) => {
        console.log(`${i+1}. ${p.market} - ${p.selection} - ${p.bookmaker_key} - external_prop_id: ${p.external_prop_id}`);
      });

      // Count by external_prop_id
      const withPropId = existing.filter(p => p.external_prop_id !== null).length;
      const withoutPropId = existing.filter(p => p.external_prop_id === null).length;
      console.log(`\nWith external_prop_id: ${withPropId}`);
      console.log(`Without external_prop_id (NULL): ${withoutPropId}`);
    }
  }

  // Check total NFL props
  const { count } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .eq('source', 'odds-api');

  console.log(`\nTotal NFL props from odds-api: ${count || 0}`);
}

checkConstraints().catch(console.error);
