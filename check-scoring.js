const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const tenMinsAgo = new Date(Date.now() - 10*60*1000).toISOString();

  // Check how many props have professional_score
  const { count: totalRecent } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', tenMinsAgo);

  const { count: scoredRecent } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', tenMinsAgo)
    .not('professional_score', 'is', null);

  const { data: sample } = await supabase
    .from('raw_props')
    .select('id, sport, player_name, professional_score, tier, edge_score, created_at')
    .gte('created_at', tenMinsAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('📊 SCORING VALIDATION (Last 10 Minutes)');
  console.log('='.repeat(60));
  console.log('Total props ingested:', totalRecent);
  console.log('Props with professional_score:', scoredRecent || 0);
  console.log('Scoring rate:', totalRecent > 0 ? ((scoredRecent || 0) / totalRecent * 100).toFixed(1) + '%' : '0%');
  console.log('\n📝 Sample Props (checking for scores):');
  if (sample) {
    sample.forEach((p, i) => {
      console.log(`  ${i+1}. [${p.sport}] ${p.player_name}`);
      console.log(`     Score: ${p.professional_score || 'NOT SCORED'} | Tier: ${p.tier || 'N/A'} | Edge: ${p.edge_score || 'N/A'}`);
    });
  }
  console.log('\n' + '='.repeat(60));
  console.log(scoredRecent > 0 ? '✅ SCORING: ACTIVE' : '❌ SCORING: NOT RUNNING');
  console.log('='.repeat(60));

  process.exit(scoredRecent > 0 ? 0 : 1);
})();
