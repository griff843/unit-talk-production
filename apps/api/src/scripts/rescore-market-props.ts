#!/usr/bin/env tsx
/**
 * Re-score today's market_props through Enhanced45Factor Engine
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function rescoreMarketProps() {
  console.log('🎯 Re-scoring today\'s market_props through Enhanced45Factor Engine...\n');

  const today = new Date().toISOString().split('T')[0];

  console.log(`Fetching unscored market_props for ${today}...\n`);

  // Get unscored props using the helper function
  const { data: props, error } = await supabase
    .rpc('get_unscored_market_props', { limit_count: 100 });

  if (error) {
    console.error('❌ Error fetching unscored market_props:', error.message);
    return;
  }

  console.log(`Found ${props?.length || 0} unscored props\n`);

  if (!props || props.length === 0) {
    console.log('No props to score - all props are already scored');
    return;
  }

  let scored = 0;
  let errors = 0;

  // NOTE: This is a placeholder - actual scoring would call the ScoringAgent
  // For now, just verify the props are retrievable
  console.log('Sample unscored props:');
  console.log('-'.repeat(70));

  for (const prop of props.slice(0, 10)) {
    console.log(`${prop.sport} | ${prop.market} | ${prop.player_name} | ${prop.line} | ${prop.odds}`);
  }

  console.log('\n⚠️  Note: This script retrieves unscored props.');
  console.log('To actually score them, run the ScoringAgent:');
  console.log('  npx tsx src/runner/runScoringAgent.ts');
  console.log('\nOr trigger scoring via API endpoint:');
  console.log('  curl -X POST http://localhost:3000/api/scoring/trigger');

  // Verify current scoring status
  const { data: scoredCount } = await supabase
    .from('scored_props')
    .select('id', { count: 'exact', head: true })
    .gte('updated_at', `${today}T00:00:00Z`);

  console.log(`\nCurrent scored_props today: ${scoredCount || 0}`);
}

rescoreMarketProps().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
