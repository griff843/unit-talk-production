/**
 * Comprehensive Database Check for ANY Settled Data
 *
 * Checks all possible tables for any historical outcomes or settled picks
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableStructure(tableName: string) {
  console.log(`\n🔍 Checking ${tableName} table structure...`);

  try {
    // Get first row to see all columns
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ Error accessing ${tableName}:`, error.message);
      return null;
    }

    if (!data || data.length === 0) {
      console.log(`⚠️  ${tableName} is empty`);
      return { columns: [], rowCount: 0 };
    }

    const columns = Object.keys(data[0]);
    console.log(`   Columns: ${columns.join(', ')}`);

    // Check for outcome-related columns
    const outcomeColumns = columns.filter((col) =>
      ['result', 'actual', 'outcome', 'won', 'status', 'settled', 'final'].some((keyword) =>
        col.toLowerCase().includes(keyword)
      )
    );

    if (outcomeColumns.length > 0) {
      console.log(`   🎯 Found outcome columns: ${outcomeColumns.join(', ')}`);

      // Check how many rows have non-null outcomes
      for (const col of outcomeColumns) {
        const { count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .not(col, 'is', null);

        console.log(`   📊 ${col}: ${count || 0} non-null values`);

        // Sample values
        const { data: sampleData } = await supabase
          .from(tableName)
          .select(col)
          .not(col, 'is', null)
          .limit(10);

        if (sampleData && sampleData.length > 0) {
          const uniqueValues = [...new Set(sampleData.map((row: any) => row[col]))];
          console.log(`      Sample values: ${uniqueValues.slice(0, 5).join(', ')}`);
        }
      }
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    return { columns, outcomeColumns, rowCount: totalCount || 0 };
  } catch (err: any) {
    console.log(`❌ ${tableName} does not exist or is not accessible`);
    return null;
  }
}

async function comprehensiveCheck() {
  console.log('🔍 COMPREHENSIVE SETTLED DATA CHECK');
  console.log('==========================================\n');

  const tablesToCheck = [
    'raw_props',
    'unified_picks',
    'picks',
    'props',
    'player_props',
    'team_props',
    'game_props',
    'historical_picks',
    'historical_props',
    'sgo_props',
    'settled_picks',
    'bet_results',
    'pick_results',
  ];

  const results: any = {};

  for (const table of tablesToCheck) {
    const result = await checkTableStructure(table);
    if (result) {
      results[table] = result;
    }
  }

  console.log('\n\n📊 SUMMARY');
  console.log('==========================================');

  let foundSettledData = false;
  Object.entries(results).forEach(([table, data]: [string, any]) => {
    if (data.outcomeColumns && data.outcomeColumns.length > 0) {
      console.log(`\n✅ ${table}:`);
      console.log(`   Total rows: ${data.rowCount.toLocaleString()}`);
      console.log(`   Outcome columns: ${data.outcomeColumns.join(', ')}`);
      foundSettledData = true;
    }
  });

  if (!foundSettledData) {
    console.log('\n❌ NO SETTLED DATA FOUND IN ANY TABLE');
    console.log('\n🚨 CRITICAL ISSUE: Cannot train ML models without historical outcomes');
    console.log('\n📋 OPTIONS:');
    console.log('   1. Import historical settled props from external source (SGO, OddsAPI archive, etc.)');
    console.log('   2. Wait for current picks to settle (weeks/months)');
    console.log('   3. Use synthetic data for initial testing (not recommended for production)');
    console.log('   4. Start with simpler rule-based system until we have data');
  } else {
    console.log('\n✅ Found settled data! Ready to proceed with ML training.');
  }

  // Save results
  const reportPath = './comprehensive-data-check.json';
  const fs = require('fs');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Full report saved to: ${reportPath}`);
}

comprehensiveCheck().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
