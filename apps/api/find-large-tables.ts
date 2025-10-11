import { supabaseClient } from './src/services/supabaseClient';

async function findLargeTables() {
  console.log('🔍 Searching for large tables with historical data...\n');

  const potentialTables = [
    'raw_props',
    'historical_props',
    'props_history',
    'legacy_props',
    'archived_props',
    'market_props_archive',
    'odds_history'
  ];

  const largeTables: Array<{name: string; count: number; sample: any}> = [];

  for (const table of potentialTables) {
    try {
      const { count, error } = await supabaseClient!
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!error && count && count > 0) {
        console.log(`✅ ${table}: ${count.toLocaleString()} rows`);

        // Get a sample row to see the schema
        const { data: sample } = await supabaseClient!
          .from(table)
          .select('*')
          .limit(1);

        if (sample && sample[0]) {
          console.log(`   Columns (${Object.keys(sample[0]).length}):`,
            Object.keys(sample[0]).slice(0, 8).join(', '), '...');

          largeTables.push({
            name: table,
            count,
            sample: sample[0]
          });
        }
        console.log('');
      }
    } catch (e: any) {
      // Table doesn't exist, skip
    }
  }

  if (largeTables.length === 0) {
    console.log('❌ No large tables found');
    return;
  }

  // Find the largest
  largeTables.sort((a, b) => b.count - a.count);
  const largest = largeTables[0];

  console.log('📊 LARGEST TABLE:', largest.name);
  console.log(`   Rows: ${largest.count.toLocaleString()}`);
  console.log(`   Columns: ${Object.keys(largest.sample).length}`);
  console.log('\n🔍 Sample data:');
  console.log(JSON.stringify(largest.sample, null, 2).slice(0, 500) + '...');

  // Check date range
  if (largest.sample.game_date || largest.sample.timestamp || largest.sample.created_at) {
    const dateCol = largest.sample.game_date ? 'game_date' :
                    largest.sample.timestamp ? 'timestamp' : 'created_at';

    const { data: dateRange } = await supabaseClient!
      .from(largest.name)
      .select(dateCol)
      .order(dateCol, { ascending: false })
      .limit(1);

    const { data: oldestDate } = await supabaseClient!
      .from(largest.name)
      .select(dateCol)
      .order(dateCol, { ascending: true })
      .limit(1);

    if (dateRange && oldestDate) {
      console.log(`\n📅 Date Range:`);
      console.log(`   Oldest: ${oldestDate[0][dateCol]}`);
      console.log(`   Newest: ${dateRange[0][dateCol]}`);
    }
  }
}

findLargeTables().then(() => process.exit(0)).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
