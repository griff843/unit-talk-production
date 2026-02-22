#!/usr/bin/env tsx

/**
 * Schema Discovery Script
 * Checks the actual database schema to understand table structure
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cqfnsozknjzvyiziwicl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');

  try {
    // Check games table
    console.log('📊 Games table structure:');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .limit(1);

    if (gamesError) {
      console.log(`❌ Games table error: ${gamesError.message}`);
    } else if (games && games.length > 0) {
      console.log('✅ Games table columns:', Object.keys(games[0]));
      console.log('📝 Sample game:', games[0]);
    } else {
      console.log('⚠️ Games table is empty');
    }

    console.log('\n');

    // Check players table
    console.log('👥 Players table structure:');
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .limit(1);

    if (playersError) {
      console.log(`❌ Players table error: ${playersError.message}`);
    } else if (players && players.length > 0) {
      console.log('✅ Players table columns:', Object.keys(players[0]));
      console.log('📝 Sample player:', players[0]);
    } else {
      console.log('⚠️ Players table is empty');
    }

    console.log('\n');

    // Check props table
    console.log('🎯 Props table structure:');
    const { data: props, error: propsError } = await supabase
      .from('props')
      .select('*')
      .limit(1);

    if (propsError) {
      console.log(`❌ Props table error: ${propsError.message}`);
    } else if (props && props.length > 0) {
      console.log('✅ Props table columns:', Object.keys(props[0]));
      console.log('📝 Sample prop:', props[0]);
    } else {
      console.log('⚠️ Props table is empty');
    }

    console.log('\n');

    // Check events table (might be used instead of games)
    console.log('🏟️ Events table structure:');
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .limit(1);

    if (eventsError) {
      console.log(`❌ Events table error: ${eventsError.message}`);
    } else if (events && events.length > 0) {
      console.log('✅ Events table columns:', Object.keys(events[0]));
      console.log('📝 Sample event:', events[0]);
    } else {
      console.log('⚠️ Events table is empty');
    }

    console.log('\n');

    // Check raw_props table
    console.log('📊 Raw Props table structure:');
    const { data: rawProps, error: rawPropsError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(1);

    if (rawPropsError) {
      console.log(`❌ Raw Props table error: ${rawPropsError.message}`);
    } else if (rawProps && rawProps.length > 0) {
      console.log('✅ Raw Props table columns:', Object.keys(rawProps[0]));
      console.log('📝 Sample raw prop:', rawProps[0]);
    } else {
      console.log('⚠️ Raw Props table is empty');
    }

    // Get counts of all tables
    console.log('\n📊 TABLE COUNTS:');
    
    const tables = ['games', 'events', 'players', 'props', 'raw_props'];
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`❌ ${table}: Error - ${error.message}`);
        } else {
          console.log(`✅ ${table}: ${count} records`);
        }
      } catch (e) {
        console.log(`❌ ${table}: Exception - ${e}`);
      }
    }

  } catch (error) {
    console.error('💥 Error checking schema:', error);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  checkSchema()
    .then(() => {
      console.log('\n🎉 Schema check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Schema check failed:', error);
      process.exit(1);
    });
}

export { checkSchema };