#!/usr/bin/env tsx

/**
 * Check Recent Props Data
 * Analyzes the raw_props table for recent data to see if ingestion is working
 */

import { createClient } from '@supabase/supabase-js';

import 'dotenv/config'
const SUPABASE_URL = process.env.SUPABASE_URL as string
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env for script: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkRecentProps() {
  console.log('🕐 Checking raw_props for recent data...\n');
  
  try {
    // Check most recent props by created_at timestamp
    console.log('📊 Most recent props by created_at:');
    const { data: recentProps, error } = await supabase
      .from('raw_props')
      .select('id, sport, player_name, stat_type, game_time, created_at, updated_at, external_game_id')
      .eq('sport', 'MLB')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error('❌ Error fetching recent props:', error);
      return;
    }
    
    recentProps?.forEach((prop, i) => {
      console.log(`   ${i+1}. ${prop.player_name} - ${prop.stat_type}`);
      console.log(`      Created: ${prop.created_at}`);
      console.log(`      Game Time: ${prop.game_time}`);
      console.log(`      External ID: ${prop.external_game_id}`);
      console.log('');
    });
    
    // Check props from today specifically
    const today = new Date().toISOString().split('T')[0];
    console.log(`🗓️ Checking props created today (${today}):`);
    
    const { data: todayProps, error: todayError } = await supabase
      .from('raw_props')
      .select('id, sport, player_name, stat_type, created_at, game_time')
      .eq('sport', 'MLB')
      .gte('created_at', today)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (todayError) {
      console.error('❌ Today error:', todayError);
    } else {
      console.log(`✅ Found ${todayProps?.length || 0} props created today`);
      todayProps?.forEach((prop, i) => {
        console.log(`   ${i+1}. ${prop.player_name} - ${prop.stat_type}`);
        console.log(`      Created: ${prop.created_at}`);
        console.log(`      Game Time: ${prop.game_time}`);
      });
    }

    // Check props from the last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`\n⏰ Checking props from last 24 hours (since ${last24Hours}):`);
    
    const { data: recent24Props, error: recent24Error } = await supabase
      .from('raw_props')
      .select('id, sport, player_name, stat_type, created_at, game_time')
      .eq('sport', 'MLB')
      .gte('created_at', last24Hours)
      .order('created_at', { ascending: false })
      .limit(15);
      
    if (recent24Error) {
      console.error('❌ Last 24h error:', recent24Error);
    } else {
      console.log(`✅ Found ${recent24Props?.length || 0} props from last 24 hours`);
      recent24Props?.slice(0, 5).forEach((prop, i) => {
        console.log(`   ${i+1}. ${prop.player_name} - ${prop.stat_type}`);
        console.log(`      Created: ${prop.created_at}`);
        console.log(`      Game Time: ${prop.game_time}`);
      });
    }

    // Check the actual date range of all props data
    console.log(`\n📈 Overall props data range:`);
    const { data: dateRange, error: dateError } = await supabase
      .from('raw_props')
      .select('created_at')
      .eq('sport', 'MLB')
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: oldestDate, error: oldestError } = await supabase
      .from('raw_props')
      .select('created_at')
      .eq('sport', 'MLB')
      .order('created_at', { ascending: true })
      .limit(1);
      
    if (!dateError && !oldestError && dateRange && oldestDate) {
      console.log(`   Newest: ${dateRange[0]?.created_at}`);
      console.log(`   Oldest: ${oldestDate[0]?.created_at}`);
    }

  } catch (error) {
    console.error('💥 Error checking recent props:', error);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  checkRecentProps()
    .then(() => {
      console.log('\n🎉 Recent props check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Recent props check failed:', error);
      process.exit(1);
    });
}

export { checkRecentProps };