import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o'
);

async function checkNFLDates() {
  console.log('Checking NFL game dates in raw_props...\n');

  const { data, error } = await supabase
    .from('raw_props')
    .select('game_date, sport')
    .eq('sport', 'NFL')
    .gte('game_date', '2025-01-01')
    .order('game_date', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Group by date
  const dates = new Map<string, number>();
  data?.forEach(row => {
    const date = row.game_date.split('T')[0];
    dates.set(date, (dates.get(date) || 0) + 1);
  });

  console.log('Available NFL game dates:');
  Array.from(dates.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count} props`);
    });
}

checkNFLDates();
