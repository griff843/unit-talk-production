/**
 * Find Unified Picks Columns by Testing
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

async function findUnifiedPicksColumns() {
  console.log('🔍 FINDING UNIFIED_PICKS COLUMNS');
  console.log('='.repeat(35));
  
  // Try minimal insert to find basic schema
  const basicColumns = {
    user_id: 'test-basic',
    player_name: 'Test Player',
    stat_type: 'test',
    line: 1.5,
    pick_type: 'over',
    created_at: new Date().toISOString()
  };
  
  console.log('\n1️⃣ Testing minimal columns...');
  try {
    const supabaseClient = requireSupabase();
      const { data, error } = await supabase
      .from('unified_picks')
      .insert(basicColumns)
      .select();
      
    if (error) {
      console.log(`❌ Minimal insert failed: ${error.message}`);
    } else {
      console.log(`✅ Minimal insert successful`);
      console.log('Basic columns that work:', Object.keys(basicColumns));
      
      // Clean up
      const supabaseClient = requireSupabase();
    await supabase
        .from('unified_picks')
        .delete()
        .eq('user_id', 'test-basic');
    }
  } catch (e: any) {
    console.log(`❌ Minimal test error: ${e.message}`);
  }
  
  // Test common columns one by one
  const testColumns = [
    'over_odds',
    'under_odds', 
    'tier',
    'confidence_score',
    'status',
    'sport',
    'game_date',
    'professional_score',
    'devigged_edge',
    'kelly_fraction'
  ];
  
  console.log('\n2️⃣ Testing individual columns...');
  for (const column of testColumns) {
    const testData = {
      ...basicColumns,
      user_id: `test-${column}`,
      [column]: column === 'confidence_score' ? 0.75 : 
                column === 'professional_score' ? 85.5 :
                column === 'devigged_edge' ? 12.3 :
                column === 'kelly_fraction' ? 0.05 :
                column === 'over_odds' ? -110 :
                column === 'under_odds' ? 110 :
                column === 'tier' ? 'A' :
                column === 'status' ? 'pending' :
                column === 'sport' ? 'MLB' :
                column === 'game_date' ? '2025-01-05' :
                'test_value'
    };
    
    try {
      const supabaseClient = requireSupabase();
      const { error } = await supabase
        .from('unified_picks')
        .insert(testData)
        .select();
        
      if (error) {
        console.log(`❌ ${column}: Missing`);
      } else {
        console.log(`✅ ${column}: Exists`);
        
        // Clean up
        const supabaseClient = requireSupabase();
    await supabase
          .from('unified_picks')
          .delete()
          .eq('user_id', `test-${column}`);
      }
    } catch (e: any) {
      console.log(`❌ ${column}: Error testing`);
    }
  }
  
  console.log('\n📋 COLUMN DISCOVERY COMPLETE');
}

findUnifiedPicksColumns().then(() => process.exit(0)).catch(console.error);