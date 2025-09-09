const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getTableSchema() {
  try {
    console.log('Raw Props Table Schema Analysis');
    console.log('='.repeat(50));
    
    const { data, error } = await supabase
      .from('raw_props')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log(`Table has ${columns.length} columns:`);
      console.log();
      
      columns.forEach(col => {
        const value = data[0][col];
        const type = typeof value;
        const displayValue = value === null ? 'NULL' : String(value).substring(0, 30);
        console.log(`${col.padEnd(20)} | ${type.padEnd(10)} | ${displayValue}`);
      });
      
      console.log('\n🔍 FEEDAGENT TRANSFORMATION ISSUE:');
      console.log('FeedAgent expects these fields but table has different schema:');
      console.log();
      console.log('FeedAgent Fields     →  Actual Table Fields');
      console.log('-'.repeat(50));
      console.log('market              →  stat_type');
      console.log('over                →  odds (need to split)');
      console.log('under               →  odds (need to split)');
      console.log('market_type         →  (missing?)');
      console.log('scraped_at          →  created_at');
      
    } else {
      console.log('Table is empty, cannot determine schema from data');
      
      // Try to get a sample of what FeedAgent is trying to insert
      console.log('\nLet me check what FeedAgent is trying to insert...');
    }
    
  } catch (error) {
    console.error('Schema check failed:', error.message);
  }
}

getTableSchema();