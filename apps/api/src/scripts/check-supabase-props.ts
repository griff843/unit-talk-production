import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProps() {
  console.log('🔍 Checking Supabase props...\n');

  // Total picks
  const { count: totalCount, error: totalError } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    console.error('❌ Error counting total picks:', totalError);
    return;
  }

  console.log(`📊 Total picks in database: ${totalCount}`);

  // Today's picks
  const today = new Date().toISOString().split('T')[0];
  const { count: todayCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', today);

  console.log(`📅 Picks for today (${today}): ${todayCount}`);

  // Scored vs unscored today
  const { data: todayProps } = await supabase
    .from('unified_picks')
    .select('professional_score')
    .gte('game_date', today)
    .limit(100);

  const scored = todayProps?.filter(p => p.professional_score !== null).length || 0;
  const unscored = (todayProps?.length || 0) - scored;

  console.log(`✅ Scored today: ${scored}`);
  console.log(`⏳ Unscored today: ${unscored}`);

  // Sample props
  const { data: sampleProps } = await supabase
    .from('unified_picks')
    .select('market, matchup, metadata, professional_score, created_at')
    .gte('game_date', today)
    .order('created_at', { ascending: false })
    .limit(3);

  if (sampleProps && sampleProps.length > 0) {
    console.log('\n📋 Sample Props:');
    sampleProps.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.market} - ${p.matchup}`);
      console.log(`   Player: ${p.metadata?.player_name || 'N/A'}`);
      console.log(`   Professional Score: ${p.professional_score || 'NOT SCORED'}`);
      console.log(`   Created: ${p.created_at}`);
    });
  }
}

checkProps().catch(console.error);
