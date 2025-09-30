import { supabaseClient } from './src/services/supabaseClient';

console.log('🔍 Checking raw_props table schema\n');

async function checkSchema() {
  try {
    if (!supabaseClient) {
      throw new Error('Supabase client not configured');
    }

    console.log('1. Testing basic query to understand schema...');

    // Get one row to see the actual structure
    const { data, error } = await supabaseClient
      .from('raw_props')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Query failed:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('📭 No data found in raw_props table');
      return;
    }

    console.log('✅ Query successful');
    console.log('📊 Table columns found:');

    const columns = Object.keys(data[0]);
    columns.sort().forEach((col, i) => {
      console.log(`   ${i + 1}. ${col}`);
    });

    console.log('\n🔍 Sample data structure:');
    const sample = data[0];
    Object.keys(sample).slice(0, 10).forEach(key => {
      const value = sample[key];
      const type = typeof value;
      const displayValue = value === null ? 'null' :
                          type === 'string' ? `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"` :
                          String(value);
      console.log(`   ${key}: ${displayValue} (${type})`);
    });

  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

checkSchema().then(() => {
  console.log('\n✅ Schema check complete');
}).catch(error => {
  console.error('\n💥 Error:', error);
});