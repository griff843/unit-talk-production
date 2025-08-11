const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSmartTicketsSchema() {
  try {
    console.log('🔍 Checking smart_tickets table structure...');

    // Try to query the smart_tickets table to see its structure
    const { data, error } = await supabase.from('smart_tickets').select('*').limit(1);

    if (error) {
      console.log('❌ Smart tickets table error:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Smart tickets table exists with columns:', Object.keys(data[0]));
      console.log('📊 Sample data structure:');
      Object.keys(data[0]).forEach(key => {
        console.log(
          `   ${key}: ${typeof data[0][key]} (${data[0][key] === null ? 'null' : typeof data[0][key]})`
        );
      });
    } else {
      console.log('✅ Smart tickets table exists but is empty');
      console.log('🔍 Let me get the table structure...');

      // Try to insert a minimal record to see required fields
      const testInsert = await supabase.from('smart_tickets').insert({}).select();

      console.log('Insert test result:', testInsert);
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

checkSmartTicketsSchema();
