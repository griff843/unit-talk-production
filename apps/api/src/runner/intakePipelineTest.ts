// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
import { createClient } from '@supabase/supabase-js';

import { BaseAgentConfig } from '../agents/BaseAgent/types';
import { CampaignAgent } from '../agents/CampaignAgent';
import { IngestionAgent } from '../agents/IngestionAgent';
import { ErrorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';

// Load Supabase credentials from environment
const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize error handler
const errorHandler = new ErrorHandler(logger);

// Define configs per agent
const ingestionConfig: BaseAgentConfig = {
  name: 'IngestionAgent',
  version: '1.0.0',
  enabled: true,
  logLevel: 'info',
  metrics: {
    enabled: true,
    interval: 60
  },
};

const campaignConfig: BaseAgentConfig = {
  name: 'CampaignAgent',
  version: '1.0.0',
  enabled: true,
  logLevel: 'info',
  metrics: {
    enabled: true,
    interval: 60
  },
};

const deps = {
  supabase,
  logger,
  errorHandler
};

// Full agent runner
async function run() {
  const ingestionAgent = new IngestionAgent(ingestionConfig, deps);
  const campaignAgent = new CampaignAgent(campaignConfig, deps);

  // Run full agent lifecycles using BaseAgent.start()
  await ingestionAgent.start();
  await campaignAgent.start();

  logger.info('✅ Intake pipeline fully executed.');
}

// Execute
run().catch(error => {
  logger.error('Pipeline execution failed:', error);
  process.exit(1);
});