const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentData() {
  console.log('=== Checking Recent Data (Last 7 Days) ===\n');
  
  try {
    // 1. Check recent picks
    console.log('1. Recent Picks (last 10):');
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
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (picksError) {
      console.error('Error:', picksError.message);
    } else if (picks && picks.length > 0) {
      picks.forEach(p => {
        const date = new Date(p.created_at).toLocaleDateString();
        const username = p.users?.username || 'Unknown';
        console.log(`   - ${date}: ${username} - ${p.selection || 'N/A'} (${p.workflow_stage})`);
      });
    } else {
      console.log('   No recent picks found');
    }

    // 2. Check recent props
    console.log('\n2. Recent Props (last 10):');
    const { data: props, error: propsError } = await supabase
      .from('raw_props')
      .select('sport, stat_type, player_name, line, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (propsError) {
      console.error('Error:', propsError.message);
    } else if (props && props.length > 0) {
      props.forEach(p => {
        const date = new Date(p.created_at).toLocaleDateString();
        console.log(`   - ${date}: ${p.sport} | ${p.player_name} | ${p.stat_type} | Line: ${p.line}`);
      });
    } else {
      console.log('   No recent props found');
    }

    // 3. Check agent health history
    console.log('\n3. Recent Agent Activity:');
    const { data: health, error: healthError } = await supabase
      .from('agent_health')
      .select('agent, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (healthError) {
      console.error('Error:', healthError.message);
    } else if (health && health.length > 0) {
      health.forEach(h => {
        const date = new Date(h.created_at).toLocaleDateString();
        console.log(`   - ${date}: ${h.agent} - ${h.status}`);
      });
    } else {
      console.log('   No recent agent activity');
    }

    // 4. Check agent logs
    console.log('\n4. Recent Agent Logs:');
    const { data: logs, error: logsError } = await supabase
      .from('agent_logs')
      .select('agent_name, log_level, message, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (logsError) {
      console.error('Error:', logsError.message);
    } else if (logs && logs.length > 0) {
      logs.forEach(l => {
        const date = new Date(l.created_at).toLocaleDateString();
        const time = new Date(l.created_at).toLocaleTimeString();
        console.log(`   - ${date} ${time}: [${l.log_level}] ${l.agent_name}: ${l.message.substring(0, 50)}...`);
      });
    } else {
      console.log('   No recent agent logs');
    }

    console.log('\n=== Data Check Complete ===');

  } catch (error) {
    console.error('Error during check:', error);
  }
}

checkRecentData();