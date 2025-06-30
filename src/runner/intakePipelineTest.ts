import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { IngestionAgent } from '../agents/IngestionAgent';
import { PromoAgent } from '../agents/PromoAgent';
import { BaseAgentConfig } from '../agents/BaseAgent/types';

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

const promoConfig: BaseAgentConfig = {
  name: 'PromoAgent',
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
  const promoAgent = new PromoAgent(promoConfig, deps);

  // Run full agent lifecycles using BaseAgent.start()
  await ingestionAgent.start();
  await promoAgent.start();

  logger.info('✅ Intake pipeline fully executed.');
}

// Execute
run().catch(error => {
  logger.error('Pipeline execution failed:', error);
  process.exit(1);
});