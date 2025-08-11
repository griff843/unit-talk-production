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

async function showMetrics() {
  try {
    // Get agent metrics from the last hour
    const { data: metrics, error } = await supabase
      .from('agent_metrics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 3600000).toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    if (!metrics || metrics.length === 0) {
      console.log('No metrics found in the last hour');
      return;
    }

    // Group metrics by agent
    const groupedMetrics = metrics.reduce((acc, metric) => {
      if (!acc[metric.agent]) {
        acc[metric.agent] = [];
      }
      acc[metric.agent].push(metric);
      return acc;
    }, {});

    // Print metrics for each agent
    Object.entries(groupedMetrics).forEach(([agent, agentMetrics]) => {
      console.log(`\n=== ${agent} Metrics ===`);
      console.log('Status:', agentMetrics[0].status);
      console.log('Success Count:', agentMetrics[0].successCount);
      console.log('Error Count:', agentMetrics[0].errorCount);
      console.log('Warning Count:', agentMetrics[0].warningCount);
      
      // Print any additional metrics
      const additionalMetrics = Object.entries(agentMetrics[0])
        .filter(([key]) => !['id', 'agent', 'timestamp', 'status', 'successCount', 'errorCount', 'warningCount'].includes(key));
      
      if (additionalMetrics.length > 0) {
        console.log('\nAdditional Metrics:');
        additionalMetrics.forEach(([key, value]) => {
          console.log(`${key}:`, value);
        });
      }
    });

  } catch (error) {
    console.error('Failed to fetch metrics:', error.message);
    process.exit(1);
  }
}

showMetrics(); 