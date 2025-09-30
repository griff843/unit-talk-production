const { createClient } = require('@supabase/supabase-js');

async function checkScoringStatus() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = new Date().toISOString().split('T')[0];

  console.log('🔍 Checking Scoring Status for Today\'s Props');
  console.log('='.repeat(60));

  try {
    // Check unified_picks with scoring fields
    const { data: picks, count: totalCount } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact' })
      .eq('source', 'odds-api')
      .gte('game_date', today + 'T00:00:00Z')
      .limit(10);

    console.log('\n📊 Total Props (today, odds-api):', totalCount || 0);

    if (picks && picks.length > 0) {
      // Check for scoring fields
      const scoredProps = picks.filter(p => p.professional_score != null);
      const approvedProps = picks.filter(p => p.status === 'approved' || p.tier != null);
      const withCLV = picks.filter(p => p.clv_tracking_id != null);
      const withKelly = picks.filter(p => p.kelly_fraction != null);

      console.log('\n🎯 Scoring Status:');
      console.log('  Props with professional_score:', scoredProps.length, '/', picks.length);
      console.log('  Props with tier assignment:', approvedProps.length, '/', picks.length);
      console.log('  Props with CLV tracking:', withCLV.length, '/', picks.length);
      console.log('  Props with Kelly fraction:', withKelly.length, '/', picks.length);

      console.log('\n📋 Sample Props:');
      picks.slice(0, 5).forEach(p => {
        console.log('  -', p.market?.padEnd(20), '|',
                    'Score:', p.professional_score || 'null', '|',
                    'Tier:', p.tier || 'null', '|',
                    'Status:', p.status || 'pending');
      });

      // Check if any props went through full pipeline
      if (scoredProps.length === 0) {
        console.log('\n⚠️  NO PROPS HAVE BEEN SCORED YET');
        console.log('  Props are in database but ScoringAgent has not processed them');
        console.log('  Need to run: FeedAgent → ScoringAgent → AlertAgent → Discord');
      } else {
        console.log('\n✅ Some props have been scored!');
      }
    } else {
      console.log('\n⚠️  No props found for today from odds-api source');
    }

    // Check agent health
    const { data: agentHealth } = await supabase
      .from('agent_health')
      .select('agent_name, status, last_heartbeat')
      .in('agent_name', ['FeedAgent', 'ScoringAgent', 'AlertAgent'])
      .order('last_heartbeat', { ascending: false });

    if (agentHealth && agentHealth.length > 0) {
      console.log('\n🏥 Agent Health:');
      agentHealth.forEach(a => {
        const lastSeen = new Date(a.last_heartbeat).toLocaleString();
        console.log(`  ${a.agent_name.padEnd(15)}: ${a.status.padEnd(10)} (${lastSeen})`);
      });
    }

  } catch (err) {
    console.log('❌ Error:', err.message);
    process.exit(1);
  }
}

checkScoringStatus();