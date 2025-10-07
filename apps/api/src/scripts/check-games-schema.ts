import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o'
);

async function checkSchema() {
  // Get a sample game
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('league', 'NFL')
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Sample NFL game columns:');
  console.log(JSON.stringify(data, null, 2));
}

checkSchema();
