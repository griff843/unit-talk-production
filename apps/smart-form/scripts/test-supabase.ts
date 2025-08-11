import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from '../lib/supabase';

async function checkTables() {
  try {
    // Check cappers
    const { data: cappers, error: cappersError } = await supabase.from('cappers').select('*');

    if (cappersError) throw cappersError;
    console.log('✅ Cappers table exists with', cappers?.length || 0, 'records');

    // Check teams
    const { data: teams, error: teamsError } = await supabase.from('teams').select('*');

    if (teamsError) throw teamsError;
    console.log('✅ Teams table exists with', teams?.length || 0, 'records');

    // Check players
    const { data: players, error: playersError } = await supabase.from('players').select('*');

    if (playersError) throw playersError;
    console.log('✅ Players table exists with', players?.length || 0, 'records');

    // Check games
    const { data: games, error: gamesError } = await supabase.from('games').select('*');

    if (gamesError) throw gamesError;
    console.log('✅ Games table exists with', games?.length || 0, 'records');

    // Check raw_props
    const { data: props, error: propsError } = await supabase.from('raw_props').select('*');

    if (propsError) throw propsError;
    console.log('✅ Raw props table exists with', props?.length || 0, 'records');

    // Check smart_tickets
    const { data: tickets, error: ticketsError } = await supabase.from('smart_tickets').select('*');

    if (ticketsError) throw ticketsError;
    console.log('✅ Smart tickets table exists with', tickets?.length || 0, 'records');
  } catch (error) {
    console.error('❌ Error checking tables:', error);
  }
}

async function main() {
  try {
    // Test basic connection
    const { data, error } = await supabase.from('cappers').select('count').single();
    if (error) throw error;
    console.log('✅ Connected to Supabase');

    // Check tables
    await checkTables();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
