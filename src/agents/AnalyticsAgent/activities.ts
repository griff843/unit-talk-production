// src/agents/AnalyticsAgent/activities.ts

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { AnalyticsAgent } from './index';
import { AnalyticsAgentConfig } from './types';

// Safely load env vars, throw descriptive error if missing
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL in environment');
if (!supabaseKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment');

const supabase = createClient(supabaseUrl, supabaseKey);

// Default agent configuration (customize as needed)
const config: AnalyticsAgentConfig = {
  agentName: 'AnalyticsAgent',
  enabled: true,
  analysisConfig: {
    minPicksForAnalysis: 10,
    roiTimeframes: [7, 30, 90],
    streakThreshold: 3,
    trendWindowDays: 30,
  },
  alertConfig: {
    roiAlertThreshold: 15,
    streakAlertThreshold: 5,
    volatilityThreshold: 0.2,
  },
  metricsConfig: {
    interval: 60000,
    prefix: 'analytics_agent',
  },
};

// Default error handling config (customize if needed)
const errorConfig = {
  maxRetries: 3,
  backoffMs: 1000,
};

// Agent instance
const agent = new AnalyticsAgent(
  config,
  supabase,
  errorConfig
);

// Exported Temporal activity
export async function runAnalyticsAgent(): Promise<void> {
  await agent.runAnalysis();
}
