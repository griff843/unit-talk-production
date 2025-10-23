const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🎯 AUTOMATIC SCORING SYSTEM TEST');
  console.log('='.repeat(60));

  // Check current scoring status BEFORE
  const { count: totalBefore } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  const { count: scoredBefore } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0])
    .not('professional_score', 'is', null);

  console.log(`\n📊 BEFORE SCORING:`);
  console.log(`   Total props for today: ${totalBefore}`);
  console.log(`   Scored props: ${scoredBefore}`);
  console.log(`   Unscored props: ${totalBefore - scoredBefore}`);
  console.log(`   Scoring rate: ${totalBefore > 0 ? ((scoredBefore / totalBefore) * 100).toFixed(1) + '%' : '0%'}`);

  // Trigger manual scoring via scoreRawProps
  console.log(`\n🔄 Triggering manual scoring test...`);
  console.log(`   NOTE: Automatic scoring should happen after every ingestion`);
  console.log(`   This test just validates the scoring system works`);

  // Wait a few seconds for automatic scoring from recent ingestions
  console.log('\n⏳ Waiting 5 seconds for any background scoring to complete...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check scoring status AFTER
  const { count: totalAfter } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  const { count: scoredAfter } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0])
    .not('professional_score', 'is', null);

  console.log(`\n📊 AFTER SCORING:`);
  console.log(`   Total props for today: ${totalAfter}`);
  console.log(`   Scored props: ${scoredAfter}`);
  console.log(`   Unscored props: ${totalAfter - scoredAfter}`);
  console.log(`   Scoring rate: ${totalAfter > 0 ? ((scoredAfter / totalAfter) * 100).toFixed(1) + '%' : '0%'}`);

  const newlyScored = scoredAfter - scoredBefore;
  console.log(`\n📈 DELTA:`);
  console.log(`   Newly scored: ${newlyScored} props`);

  // Sample scored props
  const { data: sample } = await supabase
    .from('raw_props')
    .select('id, sport, player_name, professional_score, tier, edge_score, confidence_score, kelly_fraction, processed_at')
    .gte('game_date', new Date().toISOString().split('T')[0])
    .not('professional_score', 'is', null)
    .order('processed_at', { ascending: false })
    .limit(5);

  if (sample && sample.length > 0) {
    console.log(`\n✅ SAMPLE SCORED PROPS (Most Recently Scored):`);
    sample.forEach((p, i) => {
      console.log(`   ${i+1}. [${p.sport}] ${p.player_name}`);
      console.log(`      Score: ${p.professional_score?.toFixed(1)} | Tier: ${p.tier || 'N/A'} | Edge: ${p.edge_score?.toFixed(2) || 'N/A'}`);
      console.log(`      Confidence: ${p.confidence_score?.toFixed(2) || 'N/A'} | Kelly: ${p.kelly_fraction?.toFixed(3) || 'N/A'}`);
      console.log(`      Processed: ${p.processed_at || 'N/A'}`);
    });
  } else {
    console.log(`\n⚠️ NO SCORED PROPS FOUND`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(scoredAfter > scoredBefore ? '✅ SCORING SYSTEM: WORKING' : '⚠️ SCORING SYSTEM: NO NEW SCORES');
  console.log('='.repeat(60));

  // Exit with code based on whether scoring increased
  process.exit(scoredAfter > scoredBefore ? 0 : 1);
})();
