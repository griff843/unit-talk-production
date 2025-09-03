#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkHealth() {
  try {
    // Get latest health check results for all agents
    const { data: healthChecks, error } = await supabase
      .from('agent_health')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    if (!healthChecks || healthChecks.length === 0) {
      console.log('No health check data found');
      return;
    }

    // Group by agent and get latest check
    const latestChecks = healthChecks.reduce((acc, check) => {
      if (!acc[check.agent] || new Date(check.timestamp) > new Date(acc[check.agent].timestamp)) {
        acc[check.agent] = check;
      }
      return acc;
    }, {});

    let hasUnhealthyAgent = false;

    // Print health status for each agent
    Object.entries(latestChecks).forEach(([agent, check]) => {
      console.log(`\n=== ${agent} Health Status ===`);
      console.log('Status:', check.status);
      console.log('Last Check:', new Date(check.timestamp).toLocaleString());

      if (check.details) {
        if (check.details.errors && check.details.errors.length > 0) {
          console.log('\nErrors:');
          check.details.errors.forEach(error => console.log(`- ${error}`));
        }

        if (check.details.warnings && check.details.warnings.length > 0) {
          console.log('\nWarnings:');
          check.details.warnings.forEach(warning => console.log(`- ${warning}`));
        }

        if (check.details.info) {
          console.log('\nInfo:');
          Object.entries(check.details.info).forEach(([key, value]) => {
            console.log(`${key}:`, value);
          });
        }
      }

      if (check.status !== 'healthy') {
        hasUnhealthyAgent = true;
      }
    });

    // Exit with error if any agent is unhealthy
    if (hasUnhealthyAgent) {
      console.error('\n⚠️ One or more agents are not healthy!');
      process.exit(1);
    } else {
      console.log('\n✅ All agents are healthy');
    }

  } catch (error) {
    console.error('Failed to check health:', error.message);
    process.exit(1);
  }
}

checkHealth(); 