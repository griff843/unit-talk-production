/**
 * Scan all tables to find the 1.4M props dataset
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function scanAllTables() {
  console.log('🔍 Scanning all tables for large prop datasets...\n');

  const tablesToCheck = [
    'raw_props',
    'unified_picks',
    'player_props',
    'props',
    'historical_props',
    'market_data',
    'odds_data',
    'betting_props',
    'ml_props',
    'training_data',
    'player_stats',
    'settled_outcomes',
  ];

  const results: any[] = [];

  for (const table of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!error && count !== null) {
        results.push({
          table: table,
          count: count,
          size: count >= 1000000 ? '🔥 LARGE' : count >= 100000 ? '⚡ MEDIUM' : count >= 10000 ? '📊 SMALL' : '📁 TINY',
        });

        if (count > 0) {
          // Get sample row to see structure
          const { data: sample } = await supabase
            .from(table)
            .select('*')
            .limit(1);

          if (sample && sample.length > 0) {
            results[results.length - 1].sample_columns = Object.keys(sample[0]).slice(0, 10).join(', ');
          }
        }
      }
    } catch (err) {
      // Table doesn't exist, skip
    }
  }

  // Sort by count descending
  results.sort((a, b) => b.count - a.count);

  console.log('📊 Table Sizes:\n');
  results.forEach(r => {
    console.log(`${r.size} ${r.table}: ${r.count.toLocaleString()} rows`);
    if (r.sample_columns) {
      console.log(`   Columns: ${r.sample_columns}`);
    }
  });

  // Find tables with > 100k rows
  const largeTables = results.filter(r => r.count >= 100000);

  if (largeTables.length === 0) {
    console.log('\n❌ No tables found with >100k rows');
    console.log('\n💡 The 1.4M props may need to be ingested from the data collection pipeline');
    console.log('   Check if MLBStatsService and NFLStatsService have collected the data');
  } else {
    console.log('\n🔥 Large datasets found:');
    largeTables.forEach(t => {
      console.log(`  - ${t.table}: ${t.count.toLocaleString()} rows`);
    });
  }

  process.exit(0);
}

scanAllTables();
