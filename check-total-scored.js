const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('📊 TOTAL SCORING STATUS');
  console.log('='.repeat(80));

  // Total props in database
  const { count: totalCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true });

  // Total props with scores
  const { count: scoredCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .not('professional_score', 'is', null);

  // Unscored props
  const unscoredCount = totalCount - scoredCount;

  console.log(`\n📈 Overall Statistics:`);
  console.log(`  Total props: ${(totalCount || 0).toLocaleString()}`);
  console.log(`  Scored props: ${(scoredCount || 0).toLocaleString()}`);
  console.log(`  Unscored props: ${(unscoredCount || 0).toLocaleString()}`);
  console.log(`  Scoring rate: ${totalCount > 0 ? ((scoredCount / totalCount) * 100).toFixed(1) : '0.0'}%`);

  // Recent scoring activity
  const { count: recentScored } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .not('professional_score', 'is', null)
    .gte('processed_at', new Date(Date.now() - 60*60*1000).toISOString());

  console.log(`\n⏰ Last Hour Activity:`);
  console.log(`  Props scored: ${recentScored.toLocaleString()}`);

  console.log('\n' + '='.repeat(80));
})();
