import 'dotenv/config';
import { FeedAgent } from '../agents/FeedAgent';
import { supabase } from '../services/supabaseClient'; // your actual supabase client export

async function run() {
  console.log('=== FEED AGENT HARNESS RUN STARTED ===');
  const apiKey = process.env.SPORTS_GAME_ODDS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing SPORTS_GAME_ODDS_API_KEY in environment');
  }
  // You can change 'MLB' to 'NBA' or another league if you want to test different leagues.
  const agent = new FeedAgent(supabase, apiKey, 'MLB');

  await agent.fetchAndStoreProps();
}

run().catch(err => {
  console.error('FeedAgent harness error:', err);
  process.exit(1);
});
