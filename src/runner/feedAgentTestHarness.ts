import 'dotenv/config';
import { FeedAgent } from '../agents/FeedAgent';
import { supabase } from '../services/supabaseClient'; // your actual supabase client export
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';

async function run() {
  console.log('=== FEED AGENT HARNESS RUN STARTED ===');
  const apiKey = process.env.SPORTS_GAME_ODDS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing SPORTS_GAME_ODDS_API_KEY in environment');
  }

  const config = {
    name: 'FeedAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info' as const,
    metrics: {
      enabled: true,
      interval: 60
    },
    apiKey,
    league: 'MLB'
  };

  const deps = {
    supabase,
    logger,
    errorHandler: new ErrorHandler(logger)
  };


  const agent = new FeedAgent(config, deps);

  // Check if the method exists before calling
  if ('fetchAndStoreProps' in agent && typeof agent.fetchAndStoreProps === 'function') {
    await agent.fetchAndStoreProps();
  } else {
    console.log('fetchAndStoreProps method not available, running default start');
    await agent.start();
  }
}

run().catch(err => {
  console.error('FeedAgent harness error:', err);
  process.exit(1);
});