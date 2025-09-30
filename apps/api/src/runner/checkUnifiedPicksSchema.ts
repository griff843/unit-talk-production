/**
 * Check Unified Picks Schema
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

async function checkUnifiedPicksSchema() {
  console.log('📊 CHECKING UNIFIED_PICKS SCHEMA');
  console.log('='.repeat(40));
  
  try {
    // Get current record count
    const supabaseClient = requireSupabase();
      const { count } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });
      
    console.log(`Records in unified_picks: ${count || 0}`);
    
    // Get sample record to see current schema
    const supabaseClient = requireSupabase();
      const { data: samplePick } = await supabase
      .from('unified_picks')
      .select('*')
      .limit(1);
      
    if (samplePick && samplePick.length > 0) {
      console.log('\n📋 Current unified_picks columns:');
      const columns = Object.keys(samplePick[0]);
      columns.forEach(col => console.log(`  - ${col}`));
      
      console.log('\n🔍 Professional grading columns check:');
      const professionalColumns = [
        'professional_score',
        'devigged_edge', 
        'kelly_fraction',
        'professional_insights',
        'feature_contributions',
        'risk_assessment',
        'processing_time',
        'auto_approved'
      ];
      
      professionalColumns.forEach(col => {
        const exists = columns.includes(col);
        console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      });
      
      // Show sample data structure
      console.log('\n📋 Sample record structure:');
      console.log(JSON.stringify(samplePick[0], null, 2));
    } else {
      console.log('\n❌ No records found in unified_picks table');
    }
    
  } catch (error: any) {
    console.log(`❌ Error checking unified_picks: ${error.message}`);
  }
}

checkUnifiedPicksSchema().then(() => process.exit(0)).catch(console.error);