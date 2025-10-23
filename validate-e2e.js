const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 E2E SYSTEM VALIDATION');
  console.log('='.repeat(60));

  // Check last 10 minutes
  const tenMinsAgo = new Date(Date.now() - 10*60*1000).toISOString();
  const { count: total } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', tenMinsAgo);

  const { data: bySport } = await supabase
    .from('raw_props')
    .select('sport')
    .gte('created_at', tenMinsAgo);

  const sportCounts = {};
  if (bySport) {
    bySport.forEach(p => {
      sportCounts[p.sport] = (sportCounts[p.sport] || 0) + 1;
    });
  }

  const { data: latest5 } = await supabase
    .from('raw_props')
    .select('id, sport, player_name, stat_type, source, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`\n📊 Total props ingested (last 10 min): ${total}`);
  console.log(`\n🏅 By Sport:`);
  Object.entries(sportCounts).sort((a, b) => b[1] - a[1]).forEach(([sport, count]) => {
    console.log(`   ${sport}: ${count} props`);
  });

  console.log(`\n📝 5 Most Recent Props:`);
  if (latest5) {
    latest5.forEach((p, i) => {
      console.log(`   ${i+1}. [${p.sport}] ${p.player_name} - ${p.stat_type}`);
      console.log(`      Source: ${p.source} | Time: ${p.created_at}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ VALIDATION: ${total > 0 ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Real Data: ${bySport && bySport.length > 0 ? 'YES' : 'NO'}`);
  console.log(`✅ Source: ${latest5 && latest5[0] ? latest5[0].source : 'N/A'}`);
  console.log('='.repeat(60));

  process.exit(total > 0 ? 0 : 1);
})();
