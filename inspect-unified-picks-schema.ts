/**
 * Inspect Unified Picks Schema
 *
 * Check the actual structure of the unified_picks table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_ANON_KEY as string
);

async function inspectUnifiedPicksSchema() {
  console.log('🔍 Inspecting unified_picks table schema...\n');

  try {
    // Get a few sample records to understand the structure
    const { data: samplePicks, error } = await supabase.from('unified_picks').select('*').limit(3);

    if (error) {
      console.log(`❌ Query failed: ${error.message}`);
      return;
    }

    if (!samplePicks || samplePicks.length === 0) {
      console.log('📭 No data found in unified_picks table');
      return;
    }

    console.log(`✅ Found ${samplePicks.length} records in unified_picks`);
    console.log('\n📋 Table Structure (from sample data):');

    const sampleRecord = samplePicks[0];
    Object.keys(sampleRecord).forEach(key => {
      const value = sampleRecord[key];
      const type = value === null ? 'null' : typeof value;
      console.log(`   ${key}: ${type} (${value})`);
    });

    console.log('\n🎯 Professional Grading Columns Check:');
    const professionalColumns = [
      'professional_score',
      'devigged_edge',
      'kelly_fraction',
      'professional_insights',
      'feature_contributions',
      'risk_assessment',
      'processing_time',
      'auto_approved',
    ];

    professionalColumns.forEach(col => {
      const exists = col in sampleRecord;
      console.log(`   ${col}: ${exists ? '✅ exists' : '❌ missing'}`);
    });

    console.log('\n📊 Sample Records:');
    samplePicks.forEach((pick, i) => {
      console.log(`\n   Record ${i + 1}:`);
      console.log(`   ID: ${pick.id}`);
      console.log(`   User ID: ${pick.user_id}`);
      console.log(`   Sport: ${pick.sport || 'N/A'}`);
      console.log(`   Status: ${pick.status || 'N/A'}`);
      console.log(`   Created: ${pick.created_at}`);
    });
  } catch (error) {
    console.error('❌ Inspection failed:', error);
  }
}

inspectUnifiedPicksSchema()
  .then(() => {
    console.log('\n🏁 Schema inspection complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Inspection failed:', error);
    process.exit(1);
  });
