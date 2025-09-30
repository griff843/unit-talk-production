/**
 * Test Field Ranges for raw_props
 * Following claude.md rules - identify valid ranges for confidence field
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
import { requireSupabase } from '../utils/supabaseUtils';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testFieldRanges() {
  console.log('🔍 TESTING FIELD RANGES');
  console.log('='.repeat(30));
  
  try {
    const supabaseClient = requireSupabase();
      const { data: testProp } = await supabase
      .from('sports_game_odds')
      .select('id')
      .limit(1)
      .single();
      
    if (!testProp) {
      console.log('❌ No test prop found');
      return;
    }
    
    console.log(`Testing with prop: ${testProp.id}`);
    
    // Test confidence field ranges
    console.log('\n📊 TESTING CONFIDENCE FIELD:');
    const confidenceValues = [0, 1, 10, 50, 79, 99, 100];
    
    for (const value of confidenceValues) {
      const supabaseClient = requireSupabase();
      const { error } = await supabase
        .from('sports_game_odds')
        .update({ confidence: value })
        .eq('id', testProp.id);
      
      console.log(`confidence = ${value}: ${error ? '❌ ' + error.message : '✅ SUCCESS'}`);
    }
    
    // Test edge_score field ranges  
    console.log('\n📈 TESTING EDGE_SCORE FIELD:');
    const edgeScoreValues = [0, 1, 5, 10, 50, 100, 500, 1000];
    
    for (const value of edgeScoreValues) {
      const supabaseClient = requireSupabase();
      const { error } = await supabase
        .from('sports_game_odds')
        .update({ edge_score: value })
        .eq('id', testProp.id);
      
      console.log(`edge_score = ${value}: ${error ? '❌ ' + error.message : '✅ SUCCESS'}`);
    }
    
    // Test a minimal update with only tier
    console.log('\n🎯 TESTING MINIMAL UPDATE:');
    const supabaseClient = requireSupabase();
      const { error: minimalError } = await supabase
      .from('sports_game_odds')
      .update({
        tier: 'B',
        updated_at: new Date().toISOString()
      })
      .eq('id', testProp.id);
      
    console.log(`Minimal update: ${minimalError ? '❌ ' + minimalError.message : '✅ SUCCESS'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFieldRanges().then(() => process.exit(0)).catch(console.error);