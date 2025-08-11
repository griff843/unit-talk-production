/**
 * Add missing columns needed for professional system
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addMissingColumns() {
  console.log('🔧 ADDING MISSING PROFESSIONAL SYSTEM COLUMNS');
  console.log('='.repeat(60));
  
  const columnsToAdd = [
    'processed_at TIMESTAMPTZ',
    'error_message TEXT',
    'processing_batch_id UUID',
    'grading_version TEXT DEFAULT \'v1.0\'',
    'quality_flags JSONB DEFAULT \'{}\'::jsonb'
  ];
  
  for (const columnDef of columnsToAdd) {
    const columnName = columnDef.split(' ')[0];
    
    try {
      console.log(`Adding column: ${columnName}...`);
      
      const { error } = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS ${columnDef};`
      });
      
      if (error) {
        console.error(`❌ Failed to add ${columnName}:`, error);
      } else {
        console.log(`✅ Added ${columnName}`);
      }
    } catch (error) {
      console.error(`❌ Error adding ${columnName}:`, error);
    }
  }
  
  // Also add missing columns to unified_picks table
  console.log('\n🔧 ADDING MISSING COLUMNS TO UNIFIED_PICKS');
  
  const unifiedPicksColumns = [
    'professional_score DECIMAL(10,4)',
    'devigged_edge DECIMAL(10,6)',
    'clv_tracking_id UUID',
    'kelly_fraction DECIMAL(10,6)',
    'processing_time INTEGER',
    'published BOOLEAN DEFAULT FALSE',
    'feature_contributions JSONB DEFAULT \'{}\'::jsonb',
    'rule_compliance_score DECIMAL(5,2) DEFAULT 0',
    'sharp_grading_version TEXT DEFAULT \'v1.0\'',
    'created_by_processor TEXT DEFAULT \'professional\''
  ];
  
  for (const columnDef of unifiedPicksColumns) {
    const columnName = columnDef.split(' ')[0];
    
    try {
      console.log(`Adding unified_picks column: ${columnName}...`);
      
      const { error } = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS ${columnDef};`
      });
      
      if (error) {
        console.error(`❌ Failed to add ${columnName}:`, error);
      } else {
        console.log(`✅ Added ${columnName} to unified_picks`);
      }
    } catch (error) {
      console.error(`❌ Error adding ${columnName}:`, error);
    }
  }
  
  console.log('\n✅ COLUMN ADDITIONS COMPLETE');
  console.log('Professional system should now be able to process props properly.');
}

addMissingColumns().then(() => {
  console.log('\n✅ SCHEMA UPDATE COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Schema update failed:', error);
  process.exit(1);
});