/**
 * Test Grading Database Operations
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testGradingDatabase() {
  console.log('🧪 TESTING GRADING DATABASE OPERATIONS');
  console.log('='.repeat(45));
  
  // Test 1: Check if grading_results table exists and is writable
  console.log('\n1️⃣ Testing grading_results table...');
  try {
    const testResult = {
      prop_id: 'test-prop-123',
      final_score: 85.5,
      confidence: 0.75,
      tier: 'A',
      edge_score: 12.3,
      kelly_fraction: 0.05,
      position_size: 0.02,
      risk_score: 25.1,
      feature_contributions: { 'test': 0.5 },
      model_contributions: { 'test': 0.3 },
      scenario_analysis: { 'base': 0.8 },
      model_version: '1.0.0',
      config_used: 'test-config',
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('grading_results')
      .insert(testResult)
      .select();
      
    if (error) {
      console.log(`❌ grading_results insert failed: ${error.message}`);
      console.log(`   Code: ${error.code}, Details: ${error.details}`);
    } else {
      console.log(`✅ grading_results insert successful: ${data?.length || 0} record(s)`);
      
      // Clean up test record
      await supabase
        .from('grading_results')
        .delete()
        .eq('prop_id', 'test-prop-123');
    }
  } catch (e: any) {
    console.log(`❌ grading_results test error: ${e.message}`);
  }
  
  // Test 2: Check if unified_picks table is writable
  console.log('\n2️⃣ Testing unified_picks table...');
  try {
    const testPick = {
      raw_prop_id: 'test-prop-456',
      player_name: 'Test Player',
      market_type: 'test_market',
      line: 1.5,
      odds: -110,
      tier: 'A',
      confidence: 0.75,
      score: 85.5,
      edge_score: 12.3,
      position_size: 0.02,
      kelly_fraction: 0.05,
      risk_score: 25.1,
      play_status: 'pending',
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('unified_picks')
      .insert(testPick)
      .select();
      
    if (error) {
      console.log(`❌ unified_picks insert failed: ${error.message}`);
      console.log(`   Code: ${error.code}, Details: ${error.details}`);
    } else {
      console.log(`✅ unified_picks insert successful: ${data?.length || 0} record(s)`);
      
      // Clean up test record
      await supabase
        .from('unified_picks')
        .delete()
        .eq('raw_prop_id', 'test-prop-456');
    }
  } catch (e: any) {
    console.log(`❌ unified_picks test error: ${e.message}`);
  }
  
  // Test 3: Check unified_picks table
  console.log('\n3️⃣ Testing unified_picks table...');
  try {
    const testUnifiedPick = {
      user_id: 'test-user-123',
      player_name: 'Test Player',
      stat_type: 'test_stat',
      line: 1.5,
      over_odds: -110,
      under_odds: 110,
      pick_type: 'over',
      tier: 'A',
      confidence_score: 0.75,
      kelly_fraction: 0.05,
      clv_tracking_id: 'test-clv-123',
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('unified_picks')
      .insert(testUnifiedPick)
      .select();
      
    if (error) {
      console.log(`❌ unified_picks insert failed: ${error.message}`);
      console.log(`   Code: ${error.code}, Details: ${error.details}`);
    } else {
      console.log(`✅ unified_picks insert successful: ${data?.length || 0} record(s)`);
      
      // Clean up test record
      await supabase
        .from('unified_picks')
        .delete()
        .eq('user_id', 'test-user-123');
    }
  } catch (e: any) {
    console.log(`❌ unified_picks test error: ${e.message}`);
  }
  
  console.log('\n🔧 DIAGNOSTIC COMPLETE');
}

testGradingDatabase().then(() => process.exit(0)).catch(console.error);