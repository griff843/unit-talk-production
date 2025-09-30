#!/usr/bin/env node

/**
 * Agent Health Update Script
 * Updates agent health status in the database
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_service_key';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const coreAgents = [
  'FeedAgent',
  'ScoringAgent',
  'AlertAgent',
  'RecapAgent',
  'NotificationAgent'
];

async function updateAgentHealth() {
  console.log('🏥 Updating agent health status...\n');

  const now = new Date().toISOString();

  for (const agentName of coreAgents) {
    try {
      // Update or insert agent health record
      const { error } = await supabase
        .from('agent_health')
        .upsert({
          agent_name: agentName,
          status: 'healthy',
          last_heartbeat: now
        }, {
          onConflict: 'agent_name'
        });

      if (error) {
        console.error(`❌ Failed to update ${agentName}:`, error.message);
      } else {
        console.log(`✅ ${agentName}: Health updated`);
      }

    } catch (error) {
      console.error(`❌ Error updating ${agentName}:`, error.message);
    }
  }

  // Check current health status
  console.log('\n📊 Current Agent Health Status:');
  try {
    const { data: healthData, error } = await supabase
      .from('agent_health')
      .select('*')
      .order('last_heartbeat', { ascending: false });

    if (error) {
      console.error('❌ Failed to fetch health data:', error.message);
    } else {
      healthData?.forEach(agent => {
        const timeDiff = Math.floor((Date.now() - new Date(agent.last_heartbeat).getTime()) / 1000);
        console.log(`${agent.status === 'healthy' ? '✅' : '❌'} ${agent.agent_name}: ${agent.status} (${timeDiff}s ago)`);
      });
    }
  } catch (error) {
    console.error('❌ Error fetching health data:', error.message);
  }
}

updateAgentHealth().then(() => {
  console.log('\n🎯 Agent health update completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Health update failed:', error.message);
  process.exit(1);
});