const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTodaysStats() {
  console.log('=== Unit Talk Production Status Check ===\n');
  
  // Get today's date in EST
  const now = new Date();
  const estOffset = -5; // EST offset from UTC
  const todayStart = new Date(now);
  todayStart.setUTCHours(estOffset, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(estOffset + 24, 0, 0, 0);
  
  console.log(`Checking stats for: ${todayStart.toLocaleDateString()} (EST)\n`);

  try {
    // 1. Check agent health
    console.log('1. Agent Health Status:');
    const { data: agentHealth, error: healthError } = await supabase
      .from('agent_health')
      .select('agent, status, details, created_at')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (healthError) {
      console.error('Error fetching agent health:', healthError.message);
    } else if (agentHealth && agentHealth.length > 0) {
      const agentStatus = {};
      agentHealth.forEach(h => {
        if (!agentStatus[h.agent]) {
          agentStatus[h.agent] = h.status;
        }
      });
      Object.entries(agentStatus).forEach(([agent, status]) => {
        console.log(`   - ${agent}: ${status}`);
      });
    } else {
      console.log('   No agent health data for today');
    }

    // 2. Check today's picks
    console.log('\n2. Today\'s Picks:');
    const { data: picks, error: picksError } = await supabase
      .from('unified_picks')
      .select(`
        id,
        user_id,
        selection,
        odds,
        workflow_stage,
        created_at,
        users!unified_picks_user_id_fkey (username, tier)
      `)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString())
      .order('created_at', { ascending: false });
    
    if (picksError) {
      console.error('Error fetching picks:', picksError.message);
    } else if (picks && picks.length > 0) {
      console.log(`   Total picks today: ${picks.length}`);
      const byStage = {};
      const byUser = {};
      
      picks.forEach(p => {
        byStage[p.workflow_stage] = (byStage[p.workflow_stage] || 0) + 1;
        const username = p.users?.username || 'Unknown';
        byUser[username] = (byUser[username] || 0) + 1;
      });
      
      console.log('   By workflow stage:');
      Object.entries(byStage).forEach(([stage, count]) => {
        console.log(`     - ${stage}: ${count}`);
      });
      
      console.log('   By capper:');
      Object.entries(byUser).forEach(([user, count]) => {
        console.log(`     - ${user}: ${count}`);
      });
    } else {
      console.log('   No picks found for today');
    }

    // 3. Check raw props (today's games/stats)
    console.log('\n3. Today\'s Props/Stats:');
    const { data: props, error: propsError } = await supabase
      .from('raw_props')
      .select('sport, stat_type, player_name, line')
      .gte('created_at', todayStart.toISOString())
      .limit(100);
    
    if (propsError) {
      console.error('Error fetching props:', propsError.message);
    } else if (props && props.length > 0) {
      const bySport = {};
      const byStatType = {};
      
      props.forEach(p => {
        bySport[p.sport] = (bySport[p.sport] || 0) + 1;
        byStatType[p.stat_type] = (byStatType[p.stat_type] || 0) + 1;
      });
      
      console.log(`   Total props: ${props.length}`);
      console.log('   By sport:');
      Object.entries(bySport).forEach(([sport, count]) => {
        console.log(`     - ${sport}: ${count}`);
      });
      console.log('   By stat type:');
      Object.entries(byStatType).slice(0, 5).forEach(([type, count]) => {
        console.log(`     - ${type}: ${count}`);
      });
    } else {
      console.log('   No props found for today');
    }

    // 4. Check agent metrics
    console.log('\n4. Agent Performance Metrics:');
    const { data: metrics, error: metricsError } = await supabase
      .from('agent_metrics')
      .select('agent_name, metric_type, metric_value, created_at')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (metricsError) {
      console.error('Error fetching metrics:', metricsError.message);
    } else if (metrics && metrics.length > 0) {
      const agentMetrics = {};
      metrics.forEach(m => {
        if (!agentMetrics[m.agent_name]) {
          agentMetrics[m.agent_name] = {};
        }
        agentMetrics[m.agent_name][m.metric_type] = m.metric_value;
      });
      
      Object.entries(agentMetrics).forEach(([agent, metrics]) => {
        console.log(`   ${agent}:`);
        Object.entries(metrics).forEach(([type, value]) => {
          console.log(`     - ${type}: ${value}`);
        });
      });
    } else {
      console.log('   No metrics data for today');
    }

    // 5. Check active users
    console.log('\n5. Active Cappers:');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('username, tier, capper_tier')
      .not('username', 'is', null)
      .order('tier');
    
    if (usersError) {
      console.error('Error fetching users:', usersError.message);
    } else if (users && users.length > 0) {
      users.forEach(u => {
        console.log(`   - ${u.username} (Tier: ${u.tier || u.capper_tier || 'N/A'})`);
      });
    }

    console.log('\n=== Check Complete ===');

  } catch (error) {
    console.error('Error during check:', error);
  }
}

checkTodaysStats();