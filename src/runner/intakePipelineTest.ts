import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { Logger } from '@/utils/logger';
import { FeedAgent } from '@/agents/FeedAgent';
import { IngestionAgent } from '@/agents/IngestionAgent';
import { PromoAgent } from '@/agents/PromoAgent';
import { AgentConfig } from '@/types/agent';

// Load Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize logger
const logger = new Logger('AgentRunner');

// Define configs per agent
const feedConfig: AgentConfig = {
  name: 'FeedAgent',
  enabled: true,
  healthCheckInterval: 0,
  metricsConfig: { interval: 0, prefix: 'feed' },
};

const ingestionConfig: AgentConfig = {
  name: 'IngestionAgent',
  enabled: true,
  healthCheckInterval: 0,
  metricsConfig: { interval: 0, prefix: 'ingestion' },
};

const promoConfig: AgentConfig = {
  name: 'PromoAgent',
  enabled: true,
  healthCheckInterval: 0,
  metricsConfig: { interval: 0, prefix: 'promo' },
};


// Full agent runner
async function run() {
  const feedAgent = new FeedAgent({ supabase, logger, config: feedConfig });

  const ingestionAgent = new IngestionAgent({
    supabase,
    logger,
    config: ingestionConfig,
    feedAgent,
  });

  const promoAgent = new PromoAgent({ supabase, logger, config: promoConfig });

  // Run full agent lifecycles using BaseAgent.start()
  await ingestionAgent.start();
  await promoAgent.start();

  logger.info('✅ Intake pipeline fully executed.');
}

// Execute
run().catch((err) => console.error(err));
