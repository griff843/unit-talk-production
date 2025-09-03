/**
 * Test Unified Picks Columns
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testUnifiedPicksColumns() {
  console.log('🧪 TESTING UNIFIED_PICKS COLUMNS');
  console.log('='.repeat(35));
  
  // Test basic insert to see what columns exist
  const testRecord = {
    user_id: 'test-user-123',
    player_name: 'Test Player',
    stat_type: 'test_stat',
    line: 1.5,
    over_odds: -110,
    under_odds: 110,
    pick_type: 'over',
    tier: 'A',
    confidence_score: 0.75,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  
  console.log('\n1️⃣ Testing basic unified_picks columns...');
  try {
    const { data, error } = await supabase
      .from('unified_picks')
      .insert(testRecord)
      .select();
      
    if (error) {
      console.log(`❌ Basic insert failed: ${error.message}`);
      console.log(`   Code: ${error.code}, Details: ${JSON.stringify(error.details)}`);
    } else {
      console.log(`✅ Basic insert successful`);
      
      // Clean up test record
      await supabase
        .from('unified_picks')
        .delete()
        .eq('user_id', 'test-user-123');
    }
  } catch (e: any) {
    console.log(`❌ Basic test error: ${e.message}`);
  }
  
  // Test professional grading columns
  console.log('\n2️⃣ Testing professional grading columns...');
  const professionalTestRecord = {
    ...testRecord,
    user_id: 'test-user-456',
    professional_score: 85.5,
    devigged_edge: 12.3,
    kelly_fraction: 0.05,
    professional_insights: { test: 'value' },
    feature_contributions: { test: 0.5 },
    risk_assessment: { test: 'low' },
    processing_time: 150,
    auto_approved: true
  };
  
  try {
    const { data, error } = await supabase
      .from('unified_picks')
      .insert(professionalTestRecord)
      .select();
      
    if (error) {
      console.log(`❌ Professional columns missing: ${error.message}`);
      console.log(`   Need to add professional grading columns to unified_picks`);
    } else {
      console.log(`✅ Professional columns exist`);
      
      // Clean up test record
      await supabase
        .from('unified_picks')
        .delete()
        .eq('user_id', 'test-user-456');
    }
  } catch (e: any) {
    console.log(`❌ Professional test error: ${e.message}`);
  }
  
  console.log('\n📋 SCHEMA ANALYSIS COMPLETE');
}

testUnifiedPicksColumns().then(() => process.exit(0)).catch(console.error);