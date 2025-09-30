/**
 * Check Database Tables
 * 
 * Verify which professional system database tables exist
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
import { requireSupabase } from '../utils/supabaseUtils';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_ANON_KEY as string
);

async function checkTables() {
  console.log('🔍 Checking Professional System Database Tables...\n');
  
  try {
    // Check for clv_tracking table
    const supabaseClient = requireSupabase();
      const { data: clvData, error: clvError } = await supabase
      .from('clv_tracking')
      .select('*')
      .limit(1);
    
    console.log('CLV Tracking table exists:', !clvError);
    if (clvError) console.log('CLV Error:', clvError.message);
    
    // Check for processing_logs table
    const supabaseClient = requireSupabase();
      const { data: logsData, error: logsError } = await supabase
      .from('processing_logs')
      .select('*')
      .limit(1);
    
    console.log('Processing logs table exists:', !logsError);
    if (logsError) console.log('Logs Error:', logsError.message);
    
    // Check core tables
    const tablesToCheck = [
      'raw_props',
      'unified_picks', 
      'users',
      'agent_health',
      'agent_metrics'
    ];
    
    console.log('\n📊 Core Tables Status:');
    for (const table of tablesToCheck) {
      try {
        const supabaseClient = requireSupabase();
      const { error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        console.log(`${table}: ${!error ? '✅' : '❌'}`);
        if (error) console.log(`  Error: ${error.message}`);
      } catch (err) {
        console.log(`${table}: ❌ (Exception)`);
      }
    }
    
  } catch (error) {
    console.error('Error checking tables:', error);
  }
}

checkTables().then(() => {
  console.log('\n🏁 Database check complete');
  process.exit(0);
}).catch(error => {
  console.error('Check failed:', error);
  process.exit(1);
});