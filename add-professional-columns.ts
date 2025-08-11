/**
 * Add Professional Columns to unified_picks
 *
 * Manually adds the professional grading columns to unified_picks table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_ANON_KEY as string
);

async function addProfessionalColumns() {
  console.log('🔧 Adding Professional Columns to unified_picks...\n');

  const columns = [
    { name: 'professional_score', type: 'DECIMAL(8,4)', description: 'Professional grading score' },
    {
      name: 'devigged_edge',
      type: 'DECIMAL(8,4)',
      description: 'Edge calculated using devigged odds',
    },
    { name: 'kelly_fraction', type: 'DECIMAL(8,4)', description: 'Kelly criterion bet sizing' },
    { name: 'professional_insights', type: 'JSONB', description: 'Professional analysis insights' },
    { name: 'feature_contributions', type: 'JSONB', description: 'Feature contribution analysis' },
    { name: 'risk_assessment', type: 'JSONB', description: 'Risk analysis data' },
    { name: 'processing_time', type: 'INTEGER', description: 'Processing time in milliseconds' },
    { name: 'auto_approved', type: 'BOOLEAN DEFAULT FALSE', description: 'Auto-approval flag' },
  ];

  console.log('📊 Checking current unified_picks structure...');

  // First, check if any data exists and get current columns
  try {
    const { data: sample, error } = await supabase.from('unified_picks').select('*').limit(1);

    if (error) {
      console.log(`❌ Cannot query unified_picks: ${error.message}`);
      return;
    }

    if (sample && sample.length > 0) {
      console.log('✅ unified_picks table accessible');
      console.log('📋 Current columns:', Object.keys(sample[0]).join(', '));

      // Check which professional columns already exist
      const existingCols = Object.keys(sample[0]);
      const missingCols = columns.filter(col => !existingCols.includes(col.name));

      if (missingCols.length === 0) {
        console.log('✅ All professional columns already exist!');
        return;
      }

      console.log(`\n🔍 Missing columns: ${missingCols.map(c => c.name).join(', ')}`);
    } else {
      console.log('📭 unified_picks table is empty, but accessible');
    }
  } catch (err) {
    console.log(`❌ Error checking table: ${err}`);
    return;
  }

  console.log('\n⚠️ Note: Cannot directly ALTER TABLE via Supabase client');
  console.log('📝 You need to add these columns via Supabase Dashboard or direct SQL:');
  console.log('');

  columns.forEach(col => {
    console.log(`ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`);
    console.log(`-- ${col.description}`);
    console.log('');
  });

  console.log('🎯 After adding columns, run the test again to verify GradingAgent compatibility');
}

addProfessionalColumns()
  .then(() => {
    console.log('\n🏁 Professional columns check complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Check failed:', error);
    process.exit(1);
  });
