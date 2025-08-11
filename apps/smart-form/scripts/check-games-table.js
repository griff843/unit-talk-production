const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGamesTable() {
  try {
    console.log('🔍 Checking games table structure...');

    // Try to query the games table to see its structure
    const { data, error } = await supabase.from('games').select('*').limit(1);

    if (error) {
      console.log('❌ Games table error:', error.message);

      // If table doesn't exist, let's check what tables do exist
      console.log('🔍 Checking available tables...');

      // Try some common table names
      const tablesToCheck = [
        'raw_props',
        'daily_picks',
        'unified_picks',
        'smart_tickets',
        'picks',
        'props',
      ];

      for (const tableName of tablesToCheck) {
        try {
          const { data: tableData, error: tableError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

          if (!tableError) {
            console.log(`✅ Found table: ${tableName}`);
            if (tableData && tableData.length > 0) {
              console.log(`   📊 Sample columns:`, Object.keys(tableData[0]));
            }
          }
        } catch (e) {
          // Table doesn't exist, continue
        }
      }

      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Games table exists with columns:', Object.keys(data[0]));
      console.log('📊 Sample data:', data[0]);
    } else {
      console.log('✅ Games table exists but is empty');
      console.log('🔍 Let me get the table structure...');

      // Try to insert a minimal record to see required fields
      const testInsert = await supabase.from('games').insert({}).select();

      console.log('Insert test result:', testInsert);
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

checkGamesTable();
