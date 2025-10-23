const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('📊 PROP TIMING ANALYSIS');
  console.log('='.repeat(80));

  // Check when props were created
  const { data: recent, error: recentError } = await supabase
    .from('raw_props')
    .select('created_at, processed_at, professional_score, sport')
    .order('created_at', { ascending: false })
    .limit(20);

  if (recentError) {
    console.error('Error fetching recent props:', recentError);
    return;
  }

  console.log('\n📅 Most Recent Props:');
  recent.forEach((p, i) => {
    const scored = p.professional_score ? '✓ SCORED' : '✗ NOT SCORED';
    console.log(`${i+1}. [${p.sport}] Created: ${p.created_at.slice(0, 19)} | ${scored}`);
  });

  // Check scoring by creation time
  const { data: stats, error: statsError } = await supabase.rpc('get_scoring_stats_by_time');

  if (!statsError && stats) {
    console.log('\n📈 Scoring Stats by Creation Time:');
    console.log(stats);
  }

  // Check when our automatic scoring was deployed
  const { data: scored, error: scoredError } = await supabase
    .from('raw_props')
    .select('created_at, processed_at, professional_score')
    .not('professional_score', 'is', null)
    .order('processed_at', { ascending: true })
    .limit(10);

  if (!scoredError && scored) {
    console.log('\n✅ First Scored Props:');
    scored.forEach((p, i) => {
      console.log(`${i+1}. Created: ${p.created_at.slice(0, 19)} | Processed: ${p.processed_at.slice(0, 19)}`);
    });
  }

  // Get creation time distribution
  const { data: distribution } = await supabase
    .from('raw_props')
    .select('created_at')
    .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString());

  if (distribution) {
    const createdToday = distribution.filter(p => new Date(p.created_at) > new Date(Date.now() - 24*60*60*1000));
    const createdThisHour = distribution.filter(p => new Date(p.created_at) > new Date(Date.now() - 60*60*1000));

    console.log('\n⏰ Creation Time Distribution:');
    console.log(`  Last 24 hours: ${createdToday.length} props`);
    console.log(`  Last 1 hour: ${createdThisHour.length} props`);
  }

  console.log('\n='.repeat(80));
})();
